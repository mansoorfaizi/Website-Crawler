package services

import (
	"fmt"
	"io"
	"net/http"
	"net/url"
	"regexp"
	"strings"
	"sync"
	"time"

	"github.com/sykell/website-analyzer/models"
	"golang.org/x/net/html"
)

var (
	htmlVersionRegex = regexp.MustCompile(`<!DOCTYPE\s+html[^>]*>`)
	loginFormRegex   = regexp.MustCompile(`(?i)(login|sign in|signin)`)
)

// Crawler represents a website crawler
type Crawler struct {
	website    *models.Website
	baseURL    *url.URL
	httpClient *http.Client
	mutex      sync.Mutex
}

// NewCrawler creates a new crawler for a website
func NewCrawler(website *models.Website) (*Crawler, error) {
	baseURL, err := url.Parse(website.URL)
	if err != nil {
		return nil, fmt.Errorf("invalid URL: %w", err)
	}

	httpClient := &http.Client{
		Timeout: 30 * time.Second,
		CheckRedirect: func(req *http.Request, via []*http.Request) error {
			if len(via) >= 10 {
				return fmt.Errorf("too many redirects")
			}
			return nil
		},
	}

	return &Crawler{
		website:    website,
		baseURL:    baseURL,
		httpClient: httpClient,
		mutex:      sync.Mutex{},
	}, nil
}

// Crawl crawls the website and collects data
func (c *Crawler) Crawl() error {
	// Update status to running
	err := models.UpdateWebsiteStatus(c.website.ID, "running", "")
	if err != nil {
		return err
	}

	// Get the HTML content
	resp, err := c.httpClient.Get(c.website.URL)
	if err != nil {
		errMsg := fmt.Sprintf("Failed to fetch URL: %v", err)
		models.UpdateWebsiteStatus(c.website.ID, "error", errMsg)
		return err
	}
	defer resp.Body.Close()

	// Check if the response is successful
	if resp.StatusCode != http.StatusOK {
		errMsg := fmt.Sprintf("HTTP status code: %d", resp.StatusCode)
		models.UpdateWebsiteStatus(c.website.ID, "error", errMsg)
		return fmt.Errorf(errMsg)
	}

	// Read the HTML content
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		errMsg := fmt.Sprintf("Failed to read response body: %v", err)
		models.UpdateWebsiteStatus(c.website.ID, "error", errMsg)
		return err
	}
	htmlContent := string(body)

	// Parse the HTML
	doc, err := html.Parse(strings.NewReader(htmlContent))
	if err != nil {
		errMsg := fmt.Sprintf("Failed to parse HTML: %v", err)
		models.UpdateWebsiteStatus(c.website.ID, "error", errMsg)
		return err
	}

	// Initialize data structures
	c.website.HeadingCounts = &models.HeadingCounts{WebsiteID: c.website.ID}
	c.website.LinkCounts = &models.LinkCounts{WebsiteID: c.website.ID}
	c.website.BrokenLinks = []models.BrokenLink{}

	// Extract information
	htmlVersion := c.detectHTMLVersion(htmlContent)
	c.website.HTMLVersionStr = htmlVersion
	
	title := c.extractTitle(doc)
	c.website.TitleStr = title
	
	c.extractHeadingCounts(doc)
	c.extractLinks(doc)
	
	// Check for login form
	c.website.LinkCounts.HasLoginForm = c.detectLoginForm(doc, htmlContent)

	// Update status to done
	c.website.Status = "done"
	err = models.UpdateWebsiteData(c.website)
	if err != nil {
		errMsg := fmt.Sprintf("Failed to update website data: %v", err)
		models.UpdateWebsiteStatus(c.website.ID, "error", errMsg)
		return err
	}

	return nil
}

// detectHTMLVersion detects the HTML version of the document
func (c *Crawler) detectHTMLVersion(htmlContent string) string {
	// Check for HTML5
	if matches := htmlVersionRegex.FindStringSubmatch(htmlContent); len(matches) > 0 {
		doctype := matches[0]
		if strings.Contains(doctype, "HTML 4.01") {
			return "HTML 4.01"
		} else if strings.Contains(doctype, "XHTML 1.0") {
			return "XHTML 1.0"
		} else if strings.Contains(doctype, "XHTML 1.1") {
			return "XHTML 1.1"
		} else if strings.Contains(doctype, "html") && !strings.Contains(doctype, "DTD") {
			return "HTML5"
		}
	}

	// Default to unknown
	return "Unknown"
}

// extractTitle extracts the title of the document
func (c *Crawler) extractTitle(doc *html.Node) string {
	var title string
	var extractTitleFunc func(*html.Node)
	extractTitleFunc = func(n *html.Node) {
		if n.Type == html.ElementNode && n.Data == "title" {
			for child := n.FirstChild; child != nil; child = child.NextSibling {
				if child.Type == html.TextNode {
					title = child.Data
					return
				}
			}
		}
		for child := n.FirstChild; child != nil; child = child.NextSibling {
			extractTitleFunc(child)
		}
	}
	extractTitleFunc(doc)
	return title
}

// extractHeadingCounts counts the number of heading tags by level
func (c *Crawler) extractHeadingCounts(doc *html.Node) {
	var countHeadingsFunc func(*html.Node)
	countHeadingsFunc = func(n *html.Node) {
		if n.Type == html.ElementNode {
			switch n.Data {
			case "h1":
				c.website.HeadingCounts.H1Count++
			case "h2":
				c.website.HeadingCounts.H2Count++
			case "h3":
				c.website.HeadingCounts.H3Count++
			case "h4":
				c.website.HeadingCounts.H4Count++
			case "h5":
				c.website.HeadingCounts.H5Count++
			case "h6":
				c.website.HeadingCounts.H6Count++
			}
		}
		for child := n.FirstChild; child != nil; child = child.NextSibling {
			countHeadingsFunc(child)
		}
	}
	countHeadingsFunc(doc)
}

// extractLinks extracts and categorizes links in the document
func (c *Crawler) extractLinks(doc *html.Node) {
	var links []string
	var extractLinksFunc func(*html.Node)
	extractLinksFunc = func(n *html.Node) {
		if n.Type == html.ElementNode && n.Data == "a" {
			for _, attr := range n.Attr {
				if attr.Key == "href" {
					links = append(links, attr.Val)
					break
				}
			}
		}
		for child := n.FirstChild; child != nil; child = child.NextSibling {
			extractLinksFunc(child)
		}
	}
	extractLinksFunc(doc)

	// Process the links in batches to check accessibility
	var wg sync.WaitGroup
	semaphore := make(chan struct{}, 10) // Limit concurrency

	for _, link := range links {
		// Parse the link
		parsedLink, err := c.resolveURL(link)
		if err != nil {
			continue
		}

		// Check if the link is internal or external
		if c.isInternalLink(parsedLink) {
			c.mutex.Lock()
			c.website.LinkCounts.InternalLinks++
			c.mutex.Unlock()
		} else {
			c.mutex.Lock()
			c.website.LinkCounts.ExternalLinks++
			c.mutex.Unlock()
		}

		// Check if the link is accessible
		wg.Add(1)
		go func(url string) {
			defer wg.Done()
			semaphore <- struct{}{} // Acquire token
			defer func() { <-semaphore }() // Release token

			statusCode, err := c.checkLinkAccessibility(url)
			if err != nil || statusCode >= 400 {
				c.mutex.Lock()
				c.website.BrokenLinks = append(c.website.BrokenLinks, models.BrokenLink{
					WebsiteID:  c.website.ID,
					URL:        url,
					StatusCode: statusCode,
				})
				c.mutex.Unlock()
			}
		}(parsedLink.String())
	}

	wg.Wait() // Wait for all link checks to complete
}

// resolveURL resolves a relative URL to an absolute URL
func (c *Crawler) resolveURL(href string) (*url.URL, error) {
	// Handle empty hrefs
	if href == "" || href == "#" || strings.HasPrefix(href, "javascript:") {
		return nil, fmt.Errorf("invalid URL")
	}

	// Parse the href
	parsedURL, err := url.Parse(href)
	if err != nil {
		return nil, err
	}

	// If the URL is already absolute, return it
	if parsedURL.IsAbs() {
		return parsedURL, nil
	}

	// Resolve the relative URL against the base URL
	return c.baseURL.ResolveReference(parsedURL), nil
}

// isInternalLink checks if a URL is internal to the website
func (c *Crawler) isInternalLink(parsedURL *url.URL) bool {
	return parsedURL.Host == "" || parsedURL.Host == c.baseURL.Host
}

// checkLinkAccessibility checks if a link is accessible
func (c *Crawler) checkLinkAccessibility(link string) (int, error) {
	// Create a new request
	req, err := http.NewRequest("HEAD", link, nil)
	if err != nil {
		return 0, err
	}

	// Set a user agent
	req.Header.Set("User-Agent", "WebsiteAnalyzer/1.0")

	// Send the request
	client := &http.Client{
		Timeout: 5 * time.Second,
		CheckRedirect: func(req *http.Request, via []*http.Request) error {
			if len(via) >= 5 {
				return fmt.Errorf("too many redirects")
			}
			return nil
		},
	}

	resp, err := client.Do(req)
	if err != nil {
		return 0, err
	}
	defer resp.Body.Close()

	return resp.StatusCode, nil
}

// detectLoginForm detects if the page contains a login form
func (c *Crawler) detectLoginForm(doc *html.Node, htmlContent string) bool {
	// Check for login form based on text content
	if loginFormRegex.MatchString(htmlContent) {
		return true
	}

	// Check for input fields with type="password"
	var hasPasswordField bool
	var checkFormsFunc func(*html.Node)
	checkFormsFunc = func(n *html.Node) {
		if n.Type == html.ElementNode && n.Data == "input" {
			var isPassword bool
			for _, attr := range n.Attr {
				if attr.Key == "type" && attr.Val == "password" {
					isPassword = true
					break
				}
			}
			if isPassword {
				hasPasswordField = true
				return
			}
		}
		for child := n.FirstChild; child != nil; child = child.NextSibling {
			checkFormsFunc(child)
		}
	}
	checkFormsFunc(doc)

	return hasPasswordField
} 
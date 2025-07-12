# Website Analyzer Backend

This document provides a detailed explanation of how the Website Analyzer backend processes, analyzes, and stores website data.

## Table of Contents

1. [System Overview](#system-overview)
2. [Database Schema](#database-schema)
3. [Website Processing Flow](#website-processing-flow)
4. [API Endpoints](#api-endpoints)
5. [Website Analysis](#website-analysis)

## System Overview

The Website Analyzer backend is built using Go with the Gin web framework. It provides a RESTful API for analyzing websites and extracting key information such as HTML version, heading structure, links, and more. The system uses a MySQL database for data persistence.

## Database Schema

The database consists of the following tables:

```sql
-- Users table
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    email VARCHAR(100) UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Websites table
CREATE TABLE IF NOT EXISTS websites (
    id INT AUTO_INCREMENT PRIMARY KEY,
    url VARCHAR(2048) NOT NULL,
    title VARCHAR(255),
    html_version VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    user_id INT,
    status ENUM('queued', 'running', 'done', 'error') DEFAULT 'queued',
    error_message TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_url (url(255)),
    INDEX idx_status (status)
);

-- HeadingCounts table
CREATE TABLE IF NOT EXISTS heading_counts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    website_id INT NOT NULL,
    h1_count INT DEFAULT 0,
    h2_count INT DEFAULT 0,
    h3_count INT DEFAULT 0,
    h4_count INT DEFAULT 0,
    h5_count INT DEFAULT 0,
    h6_count INT DEFAULT 0,
    FOREIGN KEY (website_id) REFERENCES websites(id) ON DELETE CASCADE
);

-- LinkCounts table
CREATE TABLE IF NOT EXISTS link_counts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    website_id INT NOT NULL,
    internal_links INT DEFAULT 0,
    external_links INT DEFAULT 0,
    has_login_form BOOLEAN DEFAULT FALSE,
    FOREIGN KEY (website_id) REFERENCES websites(id) ON DELETE CASCADE
);

-- BrokenLinks table
CREATE TABLE IF NOT EXISTS broken_links (
    id INT AUTO_INCREMENT PRIMARY KEY,
    website_id INT NOT NULL,
    url VARCHAR(2048) NOT NULL,
    status_code INT NOT NULL,
    FOREIGN KEY (website_id) REFERENCES websites(id) ON DELETE CASCADE,
    INDEX idx_website_id (website_id)
);
```

## Website Processing Flow

### 1. URL Submission

When a user submits a URL for analysis, the following process occurs:

```go
// CreateWebsite creates a new website to analyze
func CreateWebsite(c *gin.Context) {
    var website models.Website

    // Bind the request body to the website struct
    if err := c.ShouldBindJSON(&website); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
        return
    }

    // Get the user ID from the context (set by the AuthMiddleware)
    userID, exists := c.Get("userID")
    if !exists {
        c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
        return
    }
    website.UserID = userID.(int)

    // Create the website
    createdWebsite, err := models.CreateWebsite(&website)
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
        return
    }

    // Return the created website
    c.JSON(http.StatusCreated, createdWebsite)
}
```

The URL is saved to the database with an initial status of "queued":

```go
// CreateWebsite creates a new website record in the database
func CreateWebsite(website *Website) (*Website, error) {
    // Start a transaction
    tx, err := database.DB.Begin()
    if err != nil {
        return nil, err
    }
    defer tx.Rollback()

    // Insert the website
    result, err := tx.Exec(
        "INSERT INTO websites (url, user_id, status) VALUES (?, ?, ?)",
        website.URL, website.UserID, "queued",
    )
    if err != nil {
        return nil, err
    }

    // Get the ID of the newly created website
    id, err := result.LastInsertId()
    if err != nil {
        return nil, err
    }
    website.ID = int(id)
    website.Status = "queued"
    website.CreatedAt = time.Now()
    website.UpdatedAt = time.Now()

    // Commit the transaction
    if err := tx.Commit(); err != nil {
        return nil, err
    }

    return website, nil
}
```

### 2. Starting the Analysis

When the user initiates the analysis, the `StartAnalysis` endpoint is called:

```go
// StartAnalysis starts the analysis of a website
func StartAnalysis(c *gin.Context) {
    // Get the website ID from the URL parameter
    id, err := strconv.Atoi(c.Param("id"))
    if err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid website ID"})
        return
    }

    // Get the user ID from the context (set by the AuthMiddleware)
    userID, exists := c.Get("userID")
    if !exists {
        c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
        return
    }

    // Get the website from the database
    website, err := models.GetWebsiteByID(id)
    if err != nil {
        c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
        return
    }

    // Check if the website belongs to the authenticated user
    if website.UserID != userID.(int) {
        c.JSON(http.StatusForbidden, gin.H{"error": "You don't have permission to access this website"})
        return
    }

    // Check if the website is already being analyzed
    if website.Status == "running" {
        c.JSON(http.StatusConflict, gin.H{"error": "Website is already being analyzed"})
        return
    }

    // Create a crawler for the website
    crawler, err := services.NewCrawler(website)
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
        return
    }

    // Start the analysis in a separate goroutine
    go func() {
        err := crawler.Crawl()
        if err != nil {
            models.UpdateWebsiteStatus(website.ID, "error", err.Error())
        }
    }()

    // Update the website status to running
    err = models.UpdateWebsiteStatus(website.ID, "running", "")
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
        return
    }

    // Return the website status
    c.JSON(http.StatusOK, gin.H{
        "status": "running",
        "message": "Website analysis started",
    })
}
```

The analysis is performed asynchronously in a separate goroutine to prevent blocking the API response.

### 3. Website Analysis Process

The actual analysis is performed by the `Crawler` service:

```go
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
```

## Website Analysis

The analysis extracts several pieces of information from the website:

### 1. HTML Version Detection

```go
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
```

### 2. Title Extraction

```go
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
```

### 3. Heading Count Analysis

```go
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
```

### 4. Link Analysis

```go
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
```

### 5. Login Form Detection

```go
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
```

### 6. Storing Analysis Results

After the analysis is complete, the results are stored in the database:

```go
// UpdateWebsiteData updates the data of a website after analysis
func UpdateWebsiteData(website *Website) error {
    // Start a transaction
    tx, err := database.DB.Begin()
    if err != nil {
        return err
    }
    defer tx.Rollback()

    // Update the website
    _, err = tx.Exec(
        "UPDATE websites SET title = ?, html_version = ?, status = ?, updated_at = NOW() WHERE id = ?",
        website.TitleStr, website.HTMLVersionStr, website.Status, website.ID,
    )
    if err != nil {
        return err
    }

    // Update or insert the heading counts
    if website.HeadingCounts != nil {
        _, err = tx.Exec(
            "INSERT INTO heading_counts (website_id, h1_count, h2_count, h3_count, h4_count, h5_count, h6_count) VALUES (?, ?, ?, ?, ?, ?, ?) "+
                "ON DUPLICATE KEY UPDATE h1_count = VALUES(h1_count), h2_count = VALUES(h2_count), h3_count = VALUES(h3_count), "+
                "h4_count = VALUES(h4_count), h5_count = VALUES(h5_count), h6_count = VALUES(h6_count)",
            website.ID, website.HeadingCounts.H1Count, website.HeadingCounts.H2Count, website.HeadingCounts.H3Count,
            website.HeadingCounts.H4Count, website.HeadingCounts.H5Count, website.HeadingCounts.H6Count,
        )
        if err != nil {
            return err
        }
    }

    // Update or insert the link counts
    if website.LinkCounts != nil {
        _, err = tx.Exec(
            "INSERT INTO link_counts (website_id, internal_links, external_links, has_login_form) VALUES (?, ?, ?, ?) "+
                "ON DUPLICATE KEY UPDATE internal_links = VALUES(internal_links), external_links = VALUES(external_links), has_login_form = VALUES(has_login_form)",
            website.ID, website.LinkCounts.InternalLinks, website.LinkCounts.ExternalLinks, website.LinkCounts.HasLoginForm,
        )
        if err != nil {
            return err
        }
    }

    // Delete existing broken links and insert new ones
    if len(website.BrokenLinks) > 0 {
        _, err = tx.Exec("DELETE FROM broken_links WHERE website_id = ?", website.ID)
        if err != nil {
            return err
        }

        for _, link := range website.BrokenLinks {
            _, err = tx.Exec(
                "INSERT INTO broken_links (website_id, url, status_code) VALUES (?, ?, ?)",
                website.ID, link.URL, link.StatusCode,
            )
            if err != nil {
                return err
            }
        }
    }

    // Commit the transaction
    if err := tx.Commit(); err != nil {
        return err
    }

    return nil
}
```

## API Endpoints

The backend provides the following API endpoints for website analysis:

1. **POST /api/websites** - Create a new website for analysis
2. **GET /api/websites/:id** - Get a specific website by ID
3. **GET /api/websites** - Get all websites for the authenticated user
4. **POST /api/websites/:id/start** - Start the analysis of a website
5. **POST /api/websites/:id/stop** - Stop the analysis of a website
6. **DELETE /api/websites/:id** - Delete a website
7. **POST /api/websites/bulk/delete** - Delete multiple websites
8. **POST /api/websites/bulk/start** - Start analysis for multiple websites

These endpoints are defined in the `api/routes.go` file and implemented in the `api/website_handlers.go` file.

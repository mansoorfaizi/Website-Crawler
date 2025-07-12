# Website Analyzer Backend

A breakdown of how I built the Go backend for the Website Analyzer tool - focusing on the crawler implementation, database design, and API architecture.

## Table of Contents

1. [System Overview](#system-overview)
2. [Database Schema](#database-schema)
3. [Website Processing Flow](#website-processing-flow)
4. [API Endpoints](#api-endpoints)
5. [Website Analysis](#website-analysis)

## System Overview

I built this backend using Go with Gin because I needed something that could handle concurrent website crawling efficiently. Go's goroutines are perfect for this since they let me process multiple websites simultaneously without using too many system resources. The REST API connects to a MySQL database which stores all the analysis results and user data.

Key components:
- **API layer** - Handles HTTP requests and authentication (using JWT)
- **Crawler service** - Does the actual website analysis 
- **Data models** - Manages database interactions
- **Middleware** - Handles auth, rate limiting, etc.

## Database Schema

The database uses a relational schema with foreign keys to maintain data integrity:

```sql
-- Users table
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL, -- Stored with bcrypt hashing
    email VARCHAR(100) UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Websites table - main table for storing analysis requests
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
    INDEX idx_url (url(255)), -- Added index for faster URL lookups
    INDEX idx_status (status) -- Added index for status filtering
);

-- HeadingCounts table - stores h1-h6 counts for SEO analysis
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

-- LinkCounts table - stores link metrics
CREATE TABLE IF NOT EXISTS link_counts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    website_id INT NOT NULL,
    internal_links INT DEFAULT 0,
    external_links INT DEFAULT 0,
    has_login_form BOOLEAN DEFAULT FALSE,
    FOREIGN KEY (website_id) REFERENCES websites(id) ON DELETE CASCADE
);

-- BrokenLinks table - stores details about each broken link
CREATE TABLE IF NOT EXISTS broken_links (
    id INT AUTO_INCREMENT PRIMARY KEY,
    website_id INT NOT NULL,
    url VARCHAR(2048) NOT NULL,
    status_code INT NOT NULL,
    FOREIGN KEY (website_id) REFERENCES websites(id) ON DELETE CASCADE,
    INDEX idx_website_id (website_id)
);
```

I've kept things normalized to make querying efficient, but used joined queries when fetching data to minimize round trips to the database.

## Website Processing Flow

Here's how a website goes from submission to analysis:

### 1. URL Submission

When someone adds a new URL, we don't analyze it right away. Instead, we store it with a "queued" status:

```go
// CreateWebsite creates a new website record in the database
func CreateWebsite(website *Website) (*Website, error) {
    tx, err := database.DB.Begin()
    if err != nil {
        return nil, err
    }
    defer tx.Rollback()

    // Insert with "queued" status - analysis happens later
    result, err := tx.Exec(
        "INSERT INTO websites (url, user_id, status) VALUES (?, ?, ?)",
        website.URL, website.UserID, "queued",
    )
    if err != nil {
        return nil, err
    }

    // Get the new ID and set up the response object
    id, _ := result.LastInsertId()
    website.ID = int(id)
    website.Status = "queued"
    website.CreatedAt = time.Now()
    website.UpdatedAt = time.Now()

    tx.Commit()
    return website, nil
}
```

This approach lets users queue up multiple websites without waiting for analysis.

### 2. Starting the Analysis

The analysis only starts when explicitly requested. I used goroutines to handle this asynchronously:

```go
// StartAnalysis kicks off the website crawling process
func StartAnalysis(c *gin.Context) {
    id, _ := strconv.Atoi(c.Param("id"))
    userID := c.Get("userID").(int)
    
    // Get the website info
    website, err := models.GetWebsiteByID(id)
    if err != nil {
        c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
        return
    }
    
    // Security check - users can only analyze their own websites
    if website.UserID != userID {
        c.JSON(http.StatusForbidden, gin.H{"error": "You don't have permission to access this website"})
        return
    }
    
    // Don't restart analysis that's already running
    if website.Status == "running" {
        c.JSON(http.StatusConflict, gin.H{"error": "Website is already being analyzed"})
        return
    }
    
    // Create a crawler and run it in the background
    crawler, _ := services.NewCrawler(website)
    go func() {
        err := crawler.Crawl()
        if err != nil {
            models.UpdateWebsiteStatus(website.ID, "error", err.Error())
        }
    }()
    
    // Update status and return immediately (don't wait for completion)
    models.UpdateWebsiteStatus(website.ID, "running", "")
    c.JSON(http.StatusOK, gin.H{
        "status": "running",
        "message": "Website analysis started",
    })
}
```

The frontend polls for status updates while analysis is running.

### 3. Bulk Operations

I recently added bulk operations to improve efficiency when working with multiple websites:

```go
// BulkStartAnalysis starts analysis for multiple websites at once
func BulkStartAnalysis(c *gin.Context) {
    var request struct {
        IDs []int `json:"ids" binding:"required"`
    }
    c.ShouldBindJSON(&request)
    
    userID := c.Get("userID").(int)
    
    // Process each website in the list
    for _, id := range request.IDs {
        website, err := models.GetWebsiteByID(id)
        if err != nil || website.UserID != userID || website.Status == "running" {
            continue // Skip invalid entries
        }
        
        // Start each analysis in a separate goroutine
        crawler, _ := services.NewCrawler(website)
        go func() {
            err := crawler.Crawl()
            if err != nil {
                models.UpdateWebsiteStatus(website.ID, "error", err.Error())
            }
        }()
        
        models.UpdateWebsiteStatus(website.ID, "running", "")
    }
    
    c.JSON(http.StatusOK, gin.H{
        "message": "Websites analysis started",
    })
}
```

This makes the UI much more responsive when working with multiple sites.

## Website Analysis

The crawler is where the real work happens. Here's how it analyzes a website:

1. Fetches the HTML content using Go's `http` package
2. Parses the HTML using the `golang.org/x/net/html` parser
3. Extracts key information:
   - HTML version from the doctype
   - Page title from the title tag
   - Headings (h1-h6) and their counts
   - Internal and external links
   - Checks for login forms
   - Validates links to find broken ones

The link checking is the most complex part. I implemented it using concurrency with worker limits to avoid overwhelming the target server:

```go
func (c *Crawler) extractLinks(doc *html.Node) {
    var links []string
    // Find all links in the document
    extractLinksFunc(doc, &links)

    // Process links with limited concurrency
    var wg sync.WaitGroup
    semaphore := make(chan struct{}, 10) // Max 10 concurrent requests
    
    for _, link := range links {
        parsedLink, err := c.resolveURL(link)
        if err != nil {
            continue
        }
        
        // Categorize as internal or external
        if c.isInternalLink(parsedLink) {
            c.mutex.Lock()
            c.website.LinkCounts.InternalLinks++
            c.mutex.Unlock()
        } else {
            c.mutex.Lock()
            c.website.LinkCounts.ExternalLinks++
            c.mutex.Unlock()
        }
        
        // Check link accessibility in a goroutine
        wg.Add(1)
        go func(url string) {
            defer wg.Done()
            semaphore <- struct{}{} // Acquire slot
            defer func() { <-semaphore }() // Release slot
            
            statusCode, err := c.checkLinkAccessibility(url)
            if err != nil || statusCode >= 400 {
                c.mutex.Lock()
                c.website.BrokenLinks = append(c.website.BrokenLinks, models.BrokenLink{
                    WebsiteID: c.website.ID,
                    URL: url,
                    StatusCode: statusCode,
                })
                c.mutex.Unlock()
            }
        }(parsedLink.String())
    }
    
    wg.Wait() // Wait for all link checks to complete
}
```

This approach balances speed with courtesy to the target site.

## API Endpoints

The API follows REST principles with JWT authentication:

### Auth Endpoints
- `POST /api/auth/register` - Create a new user account
- `POST /api/auth/login` - Get authentication token

### Website Endpoints
- `POST /api/websites` - Add a new website
- `GET /api/websites` - List all websites with pagination
- `GET /api/websites/:id` - Get detailed website analysis
- `POST /api/websites/:id/start` - Begin website analysis
- `POST /api/websites/:id/stop` - Cancel analysis
- `DELETE /api/websites/:id` - Remove a website
- `POST /api/websites/bulk-delete` - Remove multiple websites
- `POST /api/websites/bulk-start` - Analyze multiple websites

All website endpoints require authentication via the JWT middleware.

## Performance Considerations

Some optimization techniques I used:
- **Goroutines** for non-blocking concurrent analysis
- **Connection pooling** for database operations
- **Rate limiting** to prevent abuse of the API
- **Pagination** for large datasets
- **Database indexes** on frequently queried fields
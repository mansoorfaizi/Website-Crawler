# Website Analyzer Backend Documentation

## Overview

The Website Analyzer backend is a robust Go-based API server that powers the website analysis functionality. It's built using the Go programming language with a clean architectural approach, utilizing the Gin framework for HTTP routing and middleware, and MySQL for data persistence.

## System Architecture

The backend follows a modular architecture with clear separation of concerns:

```
backend/
├── api/          # HTTP handlers and routing
├── database/     # Database connection and utilities
├── models/       # Data models and database operations
├── services/     # Business logic and core functionality
├── utils/        # Utility functions
├── main.go       # Application entry point
├── go.mod        # Go module definitions
├── go.sum        # Go module checksums
└── schema.sql    # Database schema definition
```

## Core Components

### Main Application (main.go)

The entry point of the application is responsible for:
- Initializing the database connection
- Setting up the HTTP router with appropriate middleware
- Registering API routes
- Starting the HTTP server

```go
func main() {
    // Set up the database connection
    if err := database.InitDB(); err != nil {
        log.Fatalf("Failed to initialize database: %v", err)
    }

    // Set up the router
    r := setupRouter()

    // Use hardcoded port instead of environment variable
    port := "8080"

    // Start the server
    if err := r.Run(":" + port); err != nil {
        log.Fatalf("Failed to start server: %v", err)
    }
}
```

### API Layer (api/)

The API layer handles HTTP requests, processes input data, and returns appropriate responses. It's organized into several handler files:

#### api/routes.go

Defines all API routes and groups them logically:
- Public routes (health check, authentication)
- Protected routes (user info, website management)

```go
func RegisterRoutes(r *gin.Engine) {
    // Public routes
    public := r.Group("/api")
    {
        public.GET("/health", func(c *gin.Context) {
            c.JSON(200, gin.H{
                "status": "ok",
                "message": "API is running",
            })
        })

        // Authentication routes
        auth := public.Group("/auth")
        {
            auth.POST("/register", Register)
            auth.POST("/login", Login)
        }
    }

    // Protected routes (require authentication)
    protected := r.Group("/api")
    protected.Use(AuthMiddleware())
    {
        // User routes
        user := protected.Group("/user")
        {
            user.GET("/me", GetCurrentUser)
        }

        // Website routes
        websites := protected.Group("/websites")
        {
            websites.POST("", CreateWebsite)
            websites.GET("", GetWebsites)
            websites.GET("/:id", GetWebsite)
            websites.DELETE("/:id", DeleteWebsite)
            websites.POST("/:id/start", StartAnalysis)
            websites.POST("/:id/stop", StopAnalysis)
            websites.POST("/bulk-delete", BulkDeleteWebsites)
            websites.POST("/bulk-start", BulkStartAnalysis)
        }
    }
}
```

#### api/auth_handlers.go

Implements authentication-related endpoints:
- User registration
- User login (with JWT token generation)
- Current user information retrieval

#### api/website_handlers.go

Handles website-related operations:
- Creating new websites for analysis
- Retrieving website information
- Listing websites with filtering and pagination
- Starting and stopping website analysis
- Deleting websites
- Bulk operations for managing multiple websites

#### api/middleware.go

Provides middleware for:
- Authentication using JWT tokens
- Request logging
- CORS handling
- Error recovery

### Models Layer (models/)

The models layer defines data structures and database operations for the application.

#### models/website.go

Defines the Website entity and related structures:
- Website struct with properties like URL, title, HTML version
- HeadingCounts for tracking heading tags (h1-h6)
- LinkCounts for internal/external link tracking
- BrokenLinks for storing inaccessible URLs

Key operations include:
- Creating websites
- Retrieving website information
- Updating website status and data
- Listing websites with filters and pagination
- Deleting websites

```go
// Website represents a website that has been analyzed
type Website struct {
    ID           int            `json:"id"`
    URL          string         `json:"url" binding:"required,url"`
    Title        sql.NullString `json:"-"`
    TitleStr     string         `json:"title"`
    HTMLVersion  sql.NullString `json:"-"`
    HTMLVersionStr string       `json:"html_version"`
    CreatedAt    time.Time      `json:"created_at"`
    UpdatedAt    time.Time      `json:"updated_at"`
    UserID       int            `json:"user_id"`
    Status       string         `json:"status"`
    ErrorMessage sql.NullString `json:"-"`
    ErrorMessageStr string      `json:"error_message,omitempty"`
    
    // Relations
    HeadingCounts *HeadingCounts `json:"heading_counts,omitempty"`
    LinkCounts    *LinkCounts    `json:"link_counts,omitempty"`
    BrokenLinks   []BrokenLink   `json:"broken_links,omitempty"`
}
```

#### models/user.go

Manages user data and authentication:
- User registration
- Password hashing and verification
- Retrieving user information

### Services Layer (services/)

The services layer contains the core business logic of the application.

#### services/crawler.go

Implements the website crawler functionality:
- HTML parsing and analysis
- Link extraction and categorization
- Heading tag counting
- HTML version detection
- Login form detection
- Broken link identification

```go
// Crawler provides functionality to crawl and analyze websites
type Crawler struct {
    website *models.Website
    client  *http.Client
}

// Crawl performs the website analysis
func (c *Crawler) Crawl() error {
    // Fetch the website
    resp, err := c.client.Get(c.website.URL)
    if err != nil {
        return err
    }
    defer resp.Body.Close()

    // Parse the HTML
    doc, err := goquery.NewDocumentFromReader(resp.Body)
    if err != nil {
        return err
    }

    // Extract title
    c.website.Title = sql.NullString{
        String: doc.Find("title").Text(),
        Valid:  true,
    }

    // Detect HTML version
    c.detectHTMLVersion(doc)

    // Count headings
    headingCounts := &models.HeadingCounts{
        WebsiteID: c.website.ID,
    }
    c.countHeadings(doc, headingCounts)

    // Analyze links
    linkCounts := &models.LinkCounts{
        WebsiteID: c.website.ID,
    }
    brokenLinks := c.analyzeLinks(doc, linkCounts)

    // Detect login form
    linkCounts.HasLoginForm = c.detectLoginForm(doc)

    // Update the database with the results
    return c.saveResults(headingCounts, linkCounts, brokenLinks)
}
```

### Database Layer (database/)

Manages database connections and operations:

#### database/db.go

- Initializes the database connection
- Provides access to the database instance
- Handles connection pooling

```go
// DB is the global database instance
var DB *sql.DB

// InitDB initializes the database connection
func InitDB() error {
    // Get database configuration
    dsn := "user:password@tcp(localhost:3306)/website_analyzer?parseTime=true"

    // Open connection
    var err error
    DB, err = sql.Open("mysql", dsn)
    if err != nil {
        return err
    }

    // Configure connection pool
    DB.SetMaxIdleConns(10)
    DB.SetMaxOpenConns(100)
    DB.SetConnMaxLifetime(time.Hour)

    // Test the connection
    if err := DB.Ping(); err != nil {
        return err
    }

    return nil
}
```

### Utilities (utils/)

Contains helper functions for various tasks:

#### utils/http.go

- HTTP client configuration with proper timeouts
- URL validation
- Response handling utilities

#### utils/html.go

- HTML parsing utilities
- DOCTYPE detection for HTML version identification
- Element selection helpers

## Database Schema

The database schema is defined in `schema.sql` and includes the following tables:

### Users Table

Stores user information for authentication and ownership of websites.

```sql
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    email VARCHAR(100) UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

### Websites Table

Stores basic website information and analysis status.

```sql
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
```

### HeadingCounts Table

Stores counts of heading tags (h1-h6) for each website.

```sql
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
```

### LinkCounts Table

Stores link statistics and login form detection results.

```sql
CREATE TABLE IF NOT EXISTS link_counts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    website_id INT NOT NULL,
    internal_links INT DEFAULT 0,
    external_links INT DEFAULT 0,
    has_login_form BOOLEAN DEFAULT FALSE,
    FOREIGN KEY (website_id) REFERENCES websites(id) ON DELETE CASCADE
);
```

### BrokenLinks Table

Stores information about broken links found during analysis.

```sql
CREATE TABLE IF NOT EXISTS broken_links (
    id INT AUTO_INCREMENT PRIMARY KEY,
    website_id INT NOT NULL,
    url VARCHAR(2048) NOT NULL,
    status_code INT NOT NULL,
    FOREIGN KEY (website_id) REFERENCES websites(id) ON DELETE CASCADE,
    INDEX idx_website_id (website_id)
);
```

## API Endpoints

### Authentication

#### POST /api/auth/register

Registers a new user.

**Request Body:**
```json
{
    "username": "newuser",
    "email": "user@example.com",
    "password": "securepassword"
}
```

**Response:**
```json
{
    "id": 123,
    "username": "newuser",
    "email": "user@example.com",
    "token": "jwt_token_here"
}
```

#### POST /api/auth/login

Authenticates a user and returns a JWT token.

**Request Body:**
```json
{
    "username": "existinguser",
    "password": "password123"
}
```

**Response:**
```json
{
    "user": {
        "id": 123,
        "username": "existinguser",
        "email": "user@example.com"
    },
    "token": "jwt_token_here"
}
```

### User Management

#### GET /api/user/me

Returns information about the current authenticated user.

**Response:**
```json
{
    "id": 123,
    "username": "currentuser",
    "email": "user@example.com"
}
```

### Website Management

#### POST /api/websites

Creates a new website for analysis.

**Request Body:**
```json
{
    "url": "https://example.com"
}
```

**Response:**
```json
{
    "id": 456,
    "url": "https://example.com",
    "title": "",
    "html_version": "",
    "created_at": "2023-10-15T10:30:00Z",
    "updated_at": "2023-10-15T10:30:00Z",
    "user_id": 123,
    "status": "queued"
}
```

#### GET /api/websites

Lists websites with filtering, sorting, and pagination.

**Query Parameters:**
- `page`: Page number (default: 1)
- `page_size`: Items per page (default: 10)
- `search`: Text to search in URL or title
- `sort_field`: Field to sort by (url, title, created_at, etc.)
- `sort_direction`: Sort direction (asc or desc)
- `status`: Filter by status (queued, running, done, error)

**Response:**
```json
{
    "websites": [
        {
            "id": 456,
            "url": "https://example.com",
            "title": "Example Website",
            "html_version": "HTML5",
            "created_at": "2023-10-15T10:30:00Z",
            "updated_at": "2023-10-15T10:35:00Z",
            "user_id": 123,
            "status": "done",
            "heading_counts": {
                "h1_count": 1,
                "h2_count": 5,
                "h3_count": 10,
                "h4_count": 2,
                "h5_count": 0,
                "h6_count": 0
            },
            "link_counts": {
                "internal_links": 25,
                "external_links": 8,
                "has_login_form": true
            }
        }
    ],
    "total_count": 1,
    "page": 1,
    "page_size": 10,
    "total_pages": 1
}
```

#### GET /api/websites/:id

Retrieves detailed information about a specific website.

**Response:**
```json
{
    "id": 456,
    "url": "https://example.com",
    "title": "Example Website",
    "html_version": "HTML5",
    "created_at": "2023-10-15T10:30:00Z",
    "updated_at": "2023-10-15T10:35:00Z",
    "user_id": 123,
    "status": "done",
    "heading_counts": {
        "h1_count": 1,
        "h2_count": 5,
        "h3_count": 10,
        "h4_count": 2,
        "h5_count": 0,
        "h6_count": 0
    },
    "link_counts": {
        "internal_links": 25,
        "external_links": 8,
        "has_login_form": true
    },
    "broken_links": [
        {
            "url": "https://example.com/broken-page",
            "status_code": 404
        }
    ]
}
```

#### POST /api/websites/:id/start

Starts the analysis for a website.

**Response:**
```json
{
    "status": "running",
    "message": "Website analysis started"
}
```

#### POST /api/websites/:id/stop

Stops an ongoing analysis for a website.

**Response:**
```json
{
    "status": "stopped",
    "message": "Website analysis stopped"
}
```

#### DELETE /api/websites/:id

Deletes a website.

**Response:**
```json
{
    "message": "Website deleted successfully"
}
```

#### POST /api/websites/bulk-delete

Deletes multiple websites.

**Request Body:**
```json
{
    "ids": [456, 457, 458]
}
```

**Response:**
```json
{
    "message": "3 websites deleted successfully"
}
```

#### POST /api/websites/bulk-start

Starts analysis for multiple websites.

**Request Body:**
```json
{
    "ids": [456, 457, 458]
}
```

**Response:**
```json
{
    "message": "Analysis started for 3 websites"
}
```

## Authentication and Security

The backend uses JWT (JSON Web Tokens) for authentication:

1. When a user logs in, a JWT token is generated with an expiration time
2. The token contains the user's ID and roles encoded in the payload
3. For protected routes, the AuthMiddleware verifies the token's validity
4. Passwords are hashed using bcrypt before storage in the database

## Error Handling

The backend implements a consistent error handling approach:

1. Structured error responses with appropriate HTTP status codes
2. Detailed error messages for debugging (in development mode)
3. Sanitized error messages for production to avoid information leakage
4. Logging of errors with stack traces for troubleshooting

## Concurrency and Performance

The crawler service uses Go's concurrency features:

1. Website analysis runs in separate goroutines to avoid blocking the main server
2. Connection pooling for efficient database usage
3. Timeouts for HTTP requests to prevent hanging connections
4. Rate limiting to avoid overwhelming target websites

## Development and Deployment

### Local Development

To run the backend locally:

```bash
# From the backend directory
go run main.go
```

The server will start on http://localhost:8080

### Database Setup

Use the provided schema.sql file to set up the database:

```bash
mysql -u username -p < schema.sql
```

Or run the migration script:

```bash
./migrate.bat
```

### Environment Configuration

The application supports configuration through environment variables:

- `DB_HOST`: Database hostname (default: localhost)
- `DB_PORT`: Database port (default: 3306)
- `DB_NAME`: Database name (default: website_analyzer)
- `DB_USER`: Database username
- `DB_PASS`: Database password
- `SERVER_PORT`: HTTP server port (default: 8080)
- `JWT_SECRET`: Secret key for JWT token signing

### Production Deployment

For production deployment:

1. Build the binary: `go build -o website-analyzer`
2. Set up environment variables
3. Run the binary: `./website-analyzer`

Consider using a reverse proxy (like Nginx) and process manager (like systemd) for a robust production setup.

## Conclusion

The Website Analyzer backend provides a comprehensive set of features for website analysis, with a clean architecture that separates concerns and promotes maintainability. The REST API offers a flexible interface for the frontend to interact with, while the crawler service handles the complex task of analyzing websites efficiently.

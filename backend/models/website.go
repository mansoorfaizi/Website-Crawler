package models

import (
	"database/sql"
	"errors"
	"time"

	"github.com/sykell/website-analyzer/database"
)

// Website represents a website that has been analyzed
type Website struct {
	ID           int            `json:"id"`
	URL          string         `json:"url" binding:"required,url"`
	Title        sql.NullString `json:"-"` // Use NullString to handle NULL values
	TitleStr     string         `json:"title"` // For JSON marshalling
	HTMLVersion  sql.NullString `json:"-"` // Use NullString to handle NULL values
	HTMLVersionStr string        `json:"html_version"` // For JSON marshalling
	CreatedAt    time.Time      `json:"created_at"`
	UpdatedAt    time.Time      `json:"updated_at"`
	UserID       int            `json:"user_id"`
	Status       string         `json:"status"`
	ErrorMessage sql.NullString `json:"-"` // Use NullString to handle NULL values
	ErrorMessageStr string      `json:"error_message,omitempty"` // For JSON marshalling
	
	// Relations
	HeadingCounts *HeadingCounts `json:"heading_counts,omitempty"`
	LinkCounts    *LinkCounts    `json:"link_counts,omitempty"`
	BrokenLinks   []BrokenLink   `json:"broken_links,omitempty"`
}

// HeadingCounts represents the counts of heading tags in a website
type HeadingCounts struct {
	ID        int `json:"-"`
	WebsiteID int `json:"-"`
	H1Count   int `json:"h1_count"`
	H2Count   int `json:"h2_count"`
	H3Count   int `json:"h3_count"`
	H4Count   int `json:"h4_count"`
	H5Count   int `json:"h5_count"`
	H6Count   int `json:"h6_count"`
}

// LinkCounts represents the counts of links in a website
type LinkCounts struct {
	ID           int  `json:"-"`
	WebsiteID    int  `json:"-"`
	InternalLinks int  `json:"internal_links"`
	ExternalLinks int  `json:"external_links"`
	HasLoginForm bool `json:"has_login_form"`
}

// BrokenLink represents a broken link found in a website
type BrokenLink struct {
	ID         int    `json:"-"`
	WebsiteID  int    `json:"-"`
	URL        string `json:"url"`
	StatusCode int    `json:"status_code"`
}

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

// GetWebsiteByID retrieves a website by ID
func GetWebsiteByID(id int) (*Website, error) {
	website := &Website{}
	err := database.DB.QueryRow(
		"SELECT id, url, title, html_version, created_at, updated_at, user_id, status, error_message FROM websites WHERE id = ?",
		id,
	).Scan(
		&website.ID, &website.URL, &website.Title, &website.HTMLVersion,
		&website.CreatedAt, &website.UpdatedAt, &website.UserID, &website.Status, &website.ErrorMessage,
	)

	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, errors.New("website not found")
		}
		return nil, err
	}

	// Set the string fields from NullString fields
	if website.Title.Valid {
		website.TitleStr = website.Title.String
	}
	if website.HTMLVersion.Valid {
		website.HTMLVersionStr = website.HTMLVersion.String
	}
	if website.ErrorMessage.Valid {
		website.ErrorMessageStr = website.ErrorMessage.String
	}

	// Get the heading counts
	website.HeadingCounts, _ = GetHeadingCounts(website.ID)

	// Get the link counts
	website.LinkCounts, _ = GetLinkCounts(website.ID)

	// Get the broken links
	website.BrokenLinks, _ = GetBrokenLinks(website.ID)

	return website, nil
}

// GetWebsitesByUserID retrieves all websites for a user
func GetWebsitesByUserID(userID int, page, pageSize int) ([]Website, int, error) {
	// Calculate the offset
	offset := (page - 1) * pageSize

	// Get the total count
	var totalCount int
	err := database.DB.QueryRow("SELECT COUNT(*) FROM websites WHERE user_id = ?", userID).Scan(&totalCount)
	if err != nil {
		return nil, 0, err
	}

	// Get the websites
	rows, err := database.DB.Query(
		"SELECT id, url, title, html_version, created_at, updated_at, user_id, status, error_message FROM websites WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?",
		userID, pageSize, offset,
	)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	// Parse the rows
	websites := []Website{}
	for rows.Next() {
		var website Website
		err := rows.Scan(
			&website.ID, &website.URL, &website.Title, &website.HTMLVersion,
			&website.CreatedAt, &website.UpdatedAt, &website.UserID, &website.Status, &website.ErrorMessage,
		)
		if err != nil {
			return nil, 0, err
		}

		// Set the string fields from NullString fields
		if website.Title.Valid {
			website.TitleStr = website.Title.String
		}
		if website.HTMLVersion.Valid {
			website.HTMLVersionStr = website.HTMLVersion.String
		}
		if website.ErrorMessage.Valid {
			website.ErrorMessageStr = website.ErrorMessage.String
		}

		// Get the heading counts and link counts (can be done in a batch for better performance)
		website.HeadingCounts, _ = GetHeadingCounts(website.ID)
		website.LinkCounts, _ = GetLinkCounts(website.ID)

		websites = append(websites, website)
	}

	return websites, totalCount, nil
}

// UpdateWebsiteStatus updates the status of a website
func UpdateWebsiteStatus(id int, status string, errorMessage string) error {
	_, err := database.DB.Exec(
		"UPDATE websites SET status = ?, error_message = ?, updated_at = NOW() WHERE id = ?",
		status, errorMessage, id,
	)
	return err
}

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

// DeleteWebsite deletes a website and all related data
func DeleteWebsite(id int) error {
	_, err := database.DB.Exec("DELETE FROM websites WHERE id = ?", id)
	return err
}

// GetHeadingCounts retrieves the heading counts for a website
func GetHeadingCounts(websiteID int) (*HeadingCounts, error) {
	headingCounts := &HeadingCounts{WebsiteID: websiteID}
	err := database.DB.QueryRow(
		"SELECT id, h1_count, h2_count, h3_count, h4_count, h5_count, h6_count FROM heading_counts WHERE website_id = ?",
		websiteID,
	).Scan(
		&headingCounts.ID, &headingCounts.H1Count, &headingCounts.H2Count, &headingCounts.H3Count,
		&headingCounts.H4Count, &headingCounts.H5Count, &headingCounts.H6Count,
	)

	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			// Return empty counts if none exist
			return &HeadingCounts{WebsiteID: websiteID}, nil
		}
		return nil, err
	}

	return headingCounts, nil
}

// GetLinkCounts retrieves the link counts for a website
func GetLinkCounts(websiteID int) (*LinkCounts, error) {
	linkCounts := &LinkCounts{WebsiteID: websiteID}
	err := database.DB.QueryRow(
		"SELECT id, internal_links, external_links, has_login_form FROM link_counts WHERE website_id = ?",
		websiteID,
	).Scan(
		&linkCounts.ID, &linkCounts.InternalLinks, &linkCounts.ExternalLinks, &linkCounts.HasLoginForm,
	)

	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			// Return empty counts if none exist
			return &LinkCounts{WebsiteID: websiteID}, nil
		}
		return nil, err
	}

	return linkCounts, nil
}

// GetBrokenLinks retrieves all broken links for a website
func GetBrokenLinks(websiteID int) ([]BrokenLink, error) {
	rows, err := database.DB.Query(
		"SELECT id, url, status_code FROM broken_links WHERE website_id = ?",
		websiteID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	brokenLinks := []BrokenLink{}
	for rows.Next() {
		var link BrokenLink
		link.WebsiteID = websiteID
		err := rows.Scan(&link.ID, &link.URL, &link.StatusCode)
		if err != nil {
			return nil, err
		}
		brokenLinks = append(brokenLinks, link)
	}

	return brokenLinks, nil
} 
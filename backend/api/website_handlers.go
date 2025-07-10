package api

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/sykell/website-analyzer/models"
	"github.com/sykell/website-analyzer/services"
)

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

// GetWebsite retrieves a website by ID
func GetWebsite(c *gin.Context) {
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

	// Return the website
	c.JSON(http.StatusOK, website)
}

// GetWebsites retrieves all websites for the authenticated user
func GetWebsites(c *gin.Context) {
	// Get the user ID from the context (set by the AuthMiddleware)
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	// Get the page and page size from the query parameters
	page, err := strconv.Atoi(c.DefaultQuery("page", "1"))
	if err != nil || page < 1 {
		page = 1
	}
	pageSize, err := strconv.Atoi(c.DefaultQuery("page_size", "10"))
	if err != nil || pageSize < 1 {
		pageSize = 10
	}
	if pageSize > 50 {
		pageSize = 50
	}

	// Get the websites from the database
	websites, totalCount, err := models.GetWebsitesByUserID(userID.(int), page, pageSize)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Return the websites with pagination metadata
	c.JSON(http.StatusOK, gin.H{
		"websites":     websites,
		"total_count":  totalCount,
		"page":         page,
		"page_size":    pageSize,
		"total_pages":  (totalCount + pageSize - 1) / pageSize,
		"has_more":     page*pageSize < totalCount,
		"current_page": page,
	})
}

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

// StopAnalysis stops the analysis of a website
func StopAnalysis(c *gin.Context) {
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

	// Check if the website is being analyzed
	if website.Status != "running" {
		c.JSON(http.StatusConflict, gin.H{"error": "Website is not being analyzed"})
		return
	}

	// Update the website status to stopped
	err = models.UpdateWebsiteStatus(website.ID, "error", "Analysis stopped by user")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Return the website status
	c.JSON(http.StatusOK, gin.H{
		"status": "stopped",
		"message": "Website analysis stopped",
	})
}

// DeleteWebsite deletes a website
func DeleteWebsite(c *gin.Context) {
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
		c.JSON(http.StatusForbidden, gin.H{"error": "You don't have permission to delete this website"})
		return
	}

	// Delete the website
	err = models.DeleteWebsite(id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Return success
	c.JSON(http.StatusOK, gin.H{
		"message": "Website deleted successfully",
	})
}

// BulkDeleteWebsites deletes multiple websites
func BulkDeleteWebsites(c *gin.Context) {
	// Parse the request body
	var request struct {
		IDs []int `json:"ids" binding:"required"`
	}
	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Get the user ID from the context (set by the AuthMiddleware)
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	// Delete each website
	for _, id := range request.IDs {
		// Get the website from the database
		website, err := models.GetWebsiteByID(id)
		if err != nil {
			continue
		}

		// Check if the website belongs to the authenticated user
		if website.UserID != userID.(int) {
			continue
		}

		// Delete the website
		models.DeleteWebsite(id)
	}

	// Return success
	c.JSON(http.StatusOK, gin.H{
		"message": "Websites deleted successfully",
	})
}

// BulkStartAnalysis starts analysis for multiple websites
func BulkStartAnalysis(c *gin.Context) {
	// Parse the request body
	var request struct {
		IDs []int `json:"ids" binding:"required"`
	}
	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Get the user ID from the context (set by the AuthMiddleware)
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	// Start analysis for each website
	for _, id := range request.IDs {
		// Get the website from the database
		website, err := models.GetWebsiteByID(id)
		if err != nil {
			continue
		}

		// Check if the website belongs to the authenticated user
		if website.UserID != userID.(int) {
			continue
		}

		// Check if the website is already being analyzed
		if website.Status == "running" {
			continue
		}

		// Create a crawler for the website
		crawler, err := services.NewCrawler(website)
		if err != nil {
			continue
		}

		// Start the analysis in a separate goroutine
		go func() {
			err := crawler.Crawl()
			if err != nil {
				models.UpdateWebsiteStatus(website.ID, "error", err.Error())
			}
		}()

		// Update the website status to running
		models.UpdateWebsiteStatus(website.ID, "running", "")
	}

	// Return success
	c.JSON(http.StatusOK, gin.H{
		"message": "Websites analysis started",
	})
} 
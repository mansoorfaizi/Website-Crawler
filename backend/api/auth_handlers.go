package api

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/sykell/website-analyzer/models"
	"github.com/sykell/website-analyzer/utils"
)

// Register creates a new user account
func Register(c *gin.Context) {
	var registerUser models.RegisterUser

	// Bind the request body to the register user struct
	if err := c.ShouldBindJSON(&registerUser); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Create the user
	user, err := models.CreateUser(&registerUser)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Generate a JWT token
	token, err := utils.GenerateJWT(user.ID, user.Username)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate token"})
		return
	}

	// Return the user and token
	c.JSON(http.StatusCreated, gin.H{
		"user":  user,
		"token": token,
	})
}

// Login authenticates a user and returns a JWT token
func Login(c *gin.Context) {
	var credentials models.Credentials

	// Bind the request body to the credentials struct
	if err := c.ShouldBindJSON(&credentials); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Authenticate the user
	user, err := models.Authenticate(&credentials)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
		return
	}

	// Generate a JWT token
	token, err := utils.GenerateJWT(user.ID, user.Username)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate token"})
		return
	}

	// Return the user and token
	c.JSON(http.StatusOK, gin.H{
		"user":  user,
		"token": token,
	})
}

// GetCurrentUser returns the current authenticated user
func GetCurrentUser(c *gin.Context) {
	// Get the user ID from the context (set by the AuthMiddleware)
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	// Get the user from the database
	user, err := models.GetUserByID(userID.(int))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	// Return the user
	c.JSON(http.StatusOK, user)
} 
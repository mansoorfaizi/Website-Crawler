package api

import (
	"github.com/gin-gonic/gin"
)

// RegisterRoutes registers all API routes
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
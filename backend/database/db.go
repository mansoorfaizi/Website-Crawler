package database

import (
	"database/sql"
	"fmt"
	"log"
	"os"

	_ "github.com/go-sql-driver/mysql"
)

var DB *sql.DB

// InitDB initializes the database connection
func InitDB() error {
	// Hardcoded database credentials
	host := "localhost"
	port := "3306"
	user := "analyzer_user"
	password := "password"
	dbname := "website_analyzer"

	dsn := fmt.Sprintf("%s:%s@tcp(%s:%s)/%s?charset=utf8mb4&parseTime=True&loc=Local",
		user, password, host, port, dbname)

	// DEBUG: Show the connection parameters (optional)
	fmt.Println("Connecting with user:", user)

	var err error
	DB, err = sql.Open("mysql", dsn)
	if err != nil {
		return fmt.Errorf("error opening DB: %w", err)
	}

	// Test the connection
	if err = DB.Ping(); err != nil {
		return fmt.Errorf("error connecting to DB: %w", err)
	}

	log.Println("Connected to database successfully")
	return nil
}

// GetDB returns the database connection
func GetDB() *sql.DB {
	return DB
}

// Close closes the database connection
func Close() {
	if DB != nil {
		DB.Close()
	}
}

// getEnv reads required env vars and fails if missing
func getEnv(key string) string {
	value := os.Getenv(key)
	if value == "" {
		log.Fatalf("Missing required environment variable: %s", key)
	}
	return value
}

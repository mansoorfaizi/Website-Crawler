package utils

import (
	"errors"
	"fmt"
	"os"
	"strconv"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

// Hardcoded JWT secret key
const jwtSecretKey = "your-super-secret-jwt-key-change-in-production"

// Define custom claims structure extending jwt.StandardClaims
type JWTClaim struct {
	UserID int    `json:"user_id"`
	Username string `json:"username"`
	jwt.RegisteredClaims
}

// GenerateJWT generates a new JWT token for a user
func GenerateJWT(userID int, username string) (string, error) {
	// Set expiration time
	expirationTime := time.Now().Add(24 * time.Hour)
	
	// Create claims with user data
	claims := &JWTClaim{
		UserID: userID,
		Username: username,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(expirationTime),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}
	
	// Create token with claims
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	
	// Generate encoded token
	tokenString, err := token.SignedString([]byte(jwtSecretKey))
	if err != nil {
		return "", err
	}
	
	return tokenString, nil
}

// ValidateToken validates a JWT token and returns the claims
func ValidateToken(signedToken string) (*JWTClaim, error) {
	// Parse the token
	token, err := jwt.ParseWithClaims(
		signedToken,
		&JWTClaim{},
		func(token *jwt.Token) (interface{}, error) {
			return []byte(jwtSecretKey), nil
		},
	)
	if err != nil {
		return nil, err
	}
	
	// Validate the token
	claims, ok := token.Claims.(*JWTClaim)
	if !ok || !token.Valid {
		return nil, errors.New("invalid token")
	}
	
	// Check if the token is expired
	if claims.ExpiresAt.Time.Before(time.Now()) {
		return nil, errors.New("token is expired")
	}
	
	return claims, nil
}

// GetUserIDFromToken extracts the user ID from a JWT token
func GetUserIDFromToken(tokenString string) (int, error) {
	claims, err := ValidateToken(tokenString)
	if err != nil {
		return 0, err
	}
	return claims.UserID, nil
}

// Helper function to get environment variable with a default value
func getEnv(key, defaultValue string) string {
	value := os.Getenv(key)
	if value == "" {
		return defaultValue
	}
	return value
}

// Helper function to get environment variable as an integer
func getEnvAsInt(key string, defaultValue int) int {
	valueStr := getEnv(key, fmt.Sprintf("%d", defaultValue))
	value, err := strconv.Atoi(valueStr)
	if err != nil {
		return defaultValue
	}
	return value
} 
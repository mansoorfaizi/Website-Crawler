package models

import (
	"database/sql"
	"errors"
	"time"

	"github.com/sykell/website-analyzer/database"
	"golang.org/x/crypto/bcrypt"
)

// User represents a user in the system
type User struct {
	ID        int       `json:"id"`
	Username  string    `json:"username"`
	Password  string    `json:"-"` // Don't expose the password in JSON responses
	Email     string    `json:"email"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// Credentials is used for login requests
type Credentials struct {
	Username string `json:"username" binding:"required"`
	Password string `json:"password" binding:"required"`
}

// RegisterUser is used for registration requests
type RegisterUser struct {
	Username string `json:"username" binding:"required,min=3,max=50"`
	Password string `json:"password" binding:"required,min=6"`
	Email    string `json:"email" binding:"required,email"`
}

// CreateUser creates a new user in the database
func CreateUser(user *RegisterUser) (*User, error) {
	// Hash the password
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(user.Password), bcrypt.DefaultCost)
	if err != nil {
		return nil, err
	}

	// Insert the user into the database
	result, err := database.DB.Exec(
		"INSERT INTO users (username, password, email) VALUES (?, ?, ?)",
		user.Username, hashedPassword, user.Email,
	)
	if err != nil {
		return nil, err
	}

	// Get the ID of the newly created user
	id, err := result.LastInsertId()
	if err != nil {
		return nil, err
	}

	// Return the new user
	newUser := &User{
		ID:        int(id),
		Username:  user.Username,
		Email:     user.Email,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	return newUser, nil
}

// GetUserByID retrieves a user by ID
func GetUserByID(id int) (*User, error) {
	user := &User{}
	err := database.DB.QueryRow("SELECT id, username, email, created_at, updated_at FROM users WHERE id = ?", id).
		Scan(&user.ID, &user.Username, &user.Email, &user.CreatedAt, &user.UpdatedAt)
	
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, errors.New("user not found")
		}
		return nil, err
	}
	
	return user, nil
}

// GetUserByUsername retrieves a user by username
func GetUserByUsername(username string) (*User, error) {
	user := &User{}
	err := database.DB.QueryRow("SELECT id, username, password, email, created_at, updated_at FROM users WHERE username = ?", username).
		Scan(&user.ID, &user.Username, &user.Password, &user.Email, &user.CreatedAt, &user.UpdatedAt)
	
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, errors.New("user not found")
		}
		return nil, err
	}
	
	return user, nil
}

// Authenticate checks if the provided credentials are valid
func Authenticate(cred *Credentials) (*User, error) {
	user, err := GetUserByUsername(cred.Username)
	if err != nil {
		return nil, err
	}

	// Compare the hashed password with the provided password
	err = bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(cred.Password))
	if err != nil {
		return nil, errors.New("invalid credentials")
	}

	return user, nil
} 
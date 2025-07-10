-- Create the database
CREATE DATABASE IF NOT EXISTS website_analyzer;
USE website_analyzer;

-- Create Users table
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    email VARCHAR(100) UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Create Websites table
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

-- Create HeadingCounts table
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

-- Create LinkCounts table
CREATE TABLE IF NOT EXISTS link_counts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    website_id INT NOT NULL,
    internal_links INT DEFAULT 0,
    external_links INT DEFAULT 0,
    has_login_form BOOLEAN DEFAULT FALSE,
    FOREIGN KEY (website_id) REFERENCES websites(id) ON DELETE CASCADE
);

-- Create BrokenLinks table
CREATE TABLE IF NOT EXISTS broken_links (
    id INT AUTO_INCREMENT PRIMARY KEY,
    website_id INT NOT NULL,
    url VARCHAR(2048) NOT NULL,
    status_code INT NOT NULL,
    FOREIGN KEY (website_id) REFERENCES websites(id) ON DELETE CASCADE,
    INDEX idx_website_id (website_id)
);

-- Insert a default admin user (password: admin123)
INSERT INTO users (username, password, email) 
VALUES ('admin', '$2a$10$3eJXM5jYz8zS5hT1g9jN1.CCO7NhJEG5BxCRjKVr/ethVypQWqDyW', 'admin@example.com')
ON DUPLICATE KEY UPDATE id=id; 
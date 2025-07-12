# Website Crawler

A robust web application that analyzes websites and gives you detailed insights about their structure, links, and HTML elements - all from one dashboard.

## Overview

This Website Analyzer is a full-stack project I built to solve the problem of quickly understanding a website's structure without having to manually inspect it. The system crawls any website you throw at it and breaks down its anatomy - showing you everything from HTML version to broken links. It's built with a React/TypeScript frontend and a Go backend, with MySQL handling the data storage.

## Features

- **Deep Website Analysis**
  - Detects HTML version (HTML5, XHTML, etc.)
  - Counts and categorizes internal vs external links
  - Finds and reports broken links so you can fix them
  - Maps out heading structure to see content organization
  - Identifies login forms for security awareness

- **Clean, Fast UI**
  - Dashboard with real-time analysis status updates
  - Detailed views that visualize site structure
  - Powerful search that filters across all your analyzed sites
  - Smart pagination that handles large datasets effortlessly
  - Dark/light mode that respects your system preferences

- **User System**
  - JWT-based authentication that stays secure
  - Role-based access to protect sensitive operations

## Architecture

### Frontend
- **Framework**: React with TypeScript for type safety
- **UI Components**: Custom components built on shadcn/ui
- **State Management**: React Query for efficient data fetching
- **Routing**: React Router v6 with protected routes
- **HTTP Client**: Axios with interceptors for auth

### Backend
- **Language**: Go for high performance crawling
- **Web Framework**: Custom router on top of standard library
- **Database**: MySQL with optimized queries
- **Authentication**: JWT with proper expiration and refresh

## 📋 Prerequisites

- Node.js (v20+) for the frontend
- Go (v1.18+) for the backend
- MySQL (v8.0+) for the database

## Installation

### Backend Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/masoudfaizi/website-crawler.git
   cd website-crawler
   ```

2. Set up the database:
   ```bash
   # This script creates the schema and seeds initial data
   ./migrate.bat
   ```

3. Start the backend server:
   ```bash
   cd backend
   go run main.go
   ```
   The server will start on http://localhost:8080 - you should see "Server running" in your console

### Frontend Setup

1. Install dependencies:
   ```bash
   cd frontend
   npm install
   ```

2. Start the development server:
   ```bash
   npm run dev
   ```
   The app will be ready at http://localhost:3000 - it should automatically open in your browser

## Usage

1. **Login**: First-time setup credentials:
   - Username: `admin`
   - Password: `admin123`
   - (Make sure to change these after first login!)

2. **Adding a Website**: 
   - Hit the "Add URL" button in the top right
   - Enter a complete URL (e.g., https://example.com - no trailing slash)
   - Analysis starts automatically and you'll see real-time status updates

3. **Exploring Results**: 
   - The dashboard shows status cards with counts by category
   - Click any website row to dive into detailed analysis
   - The Overview tab gives you the big picture
   - The Links tab breaks down all connections
   - The Issues tab highlights problems that need attention

4. **Bulk Actions**:
   - Select multiple sites with the checkboxes
   - Use the bulk actions menu to reanalyze or delete them
   - Perfect for when you need to refresh many sites at once

## API Endpoints

### Authentication
- `POST /api/auth/login` - Get your JWT token
- `POST /api/auth/register` - Create new account (admin only)

### Websites
- `GET /api/websites` - List all sites with pagination
- `GET /api/websites/:id` - Get full details for one site
- `POST /api/websites` - Add a new site to analyze
- `POST /api/websites/:id/start` - Trigger analysis
- `DELETE /api/websites/:id` - Remove a site
- `POST /api/websites/bulk-delete` - Remove multiple sites
- `POST /api/websites/bulk-start` - Analyze multiple sites

## Security Notes

- JWTs expire after 24 hours
- Failed login attempts are rate-limited
- All passwords are properly hashed, never stored as plaintext

## Responsive Design

The app works great on all devices:
- Desktop: Full feature experience
- Tablets: Optimized layouts with all features
- Mobile: Focused interface that prioritizes key actions

## License

[MIT License](LICENSE)
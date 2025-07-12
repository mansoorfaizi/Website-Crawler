#Website Crawler

A web application for analyzing websites and providing detailed insights about their structure, links, and HTML elements.

## Overview

Website Analyzer is a full-stack application that crawls websites and provides comprehensive analysis including HTML version detection, link analysis (internal/external/broken), heading structure evaluation, and more. The application features a modern React frontend with a Go backend, connected to a MySQL database.

## Features

- **Website Analysis**
  - HTML version detection
  - Internal and external link counting
  - Broken link identification
  - Heading structure analysis
  - Login form detection

- **User Interface**
  - Modern, responsive dashboard
  - Detailed analysis views with visualizations
  - Real-time status updates
  - Search and filtering capabilities
  - Pagination for large datasets

- **User Management**
  - Secure authentication with JWT
  - Protected routes and API endpoints

## Architecture

### Frontend
- **Framework**: React with TypeScript
- **UI Components**: Custom components with shadcn/ui
- **State Management**: React Query for server state
- **Routing**: React Router v6
- **HTTP Client**: Axios

### Backend
- **Language**: Go
- **Web Framework**: Standard library with custom routing
- **Database**: MySQL
- **Authentication**: JWT-based authentication

## 📋 Prerequisites

- Node.js (v20+)
- Go (v1.18+)
- MySQL (v8.0+)

## Installation

### Backend Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/masoudfaizi/website-crawler.git
   cd website-crawler
   ```

2. Set up the database:
   ```bash
   # Run the migration script
   ./migrate.bat
   ```

3. Start the backend server:
   ```bash
   cd backend
   go run main.go
   ```
   The server will start on http://localhost:8080

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
   The application will be available at http://localhost:3000

## Usage

1. **Login**: Access the application using the default credentials:
   - Username: `admin`
   - Password: `admin123`

2. **Adding a Website**: Click the "Add URL" button and enter a valid URL (including http:// or https://)

3. **Analyzing Results**: 
   - View basic metrics on the dashboard
   - Click on any website entry to see detailed analysis
   - Use tabs to navigate between different aspects of the analysis

4. **Managing Websites**:
   - Re-run analysis on existing websites
   - Delete websites you no longer need
   - Use bulk actions to manage multiple websites at once

## API Endpoints

### Authentication
- `POST /api/auth/login` - Authenticate user and receive JWT token

### Websites
- `GET /api/websites` - List all websites
- `GET /api/websites/:id` - Get website details
- `POST /api/websites` - Add a new website
- `POST /api/websites/:id/analyze` - Start analysis for a website
- `DELETE /api/websites/:id` - Delete a website

## Security

- JWT-based authentication
- Protected API endpoints
- Secure password handling

## Responsive Design

The application is fully responsive and works on:
- Desktop computers
- Tablets
- Mobile devices

## License

[MIT License](LICENSE)
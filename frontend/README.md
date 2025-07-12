# Website Analyzer Frontend

This document provides a detailed explanation of the Website Analyzer frontend architecture, components, and functionality.

## Table of Contents

1. [Overview](#overview)
2. [Tech Stack](#tech-stack)
3. [Project Structure](#project-structure)
4. [Key Components](#key-components)
5. [Data Flow](#data-flow)
6. [Type System](#type-system)
7. [Authentication](#authentication)
8. [API Integration](#api-integration)
9. [UI Components](#ui-components)
10. [Getting Started](#getting-started)

## Overview

The Website Analyzer frontend is a modern React application that provides a user interface for analyzing websites. It allows users to submit URLs, view analysis results, and manage their analyzed websites. The application features a responsive design, authentication system, and real-time updates for ongoing analyses.

## Tech Stack

- **React**: UI library
- **TypeScript**: Type-safe JavaScript
- **React Router**: Client-side routing
- **shadcn/ui**: UI component library
- **Tailwind CSS**: Utility-first CSS framework
- **Lucide React**: Icon library
- **Axios**: HTTP client for API requests

## Project Structure

```
frontend/
├── src/
│   ├── components/        # Reusable UI components
│   ├── lib/               # Utilities and services
│   │   ├── api.ts         # API service
│   │   └── auth.tsx       # Authentication context
│   ├── pages/             # Page components
│   │   ├── CrawlDetails.tsx       # Website analysis details page
│   │   ├── CrawlerDashboard.tsx   # Main dashboard page
│   │   ├── CrawlResultsTable.tsx  # Table for displaying analysis results
│   │   ├── Login.tsx              # Login page
│   │   ├── Register.tsx           # Registration page
│   │   └── NotFound.tsx           # 404 page
│   ├── types/             # TypeScript type definitions
│   │   └── crawler.ts     # Types for crawler data
│   ├── App.tsx            # Main application component
│   ├── main.tsx           # Application entry point
│   └── index.css          # Global styles
```

## Key Components

### CrawlerDashboard

The `CrawlerDashboard` component is the main interface where users can view and manage their analyzed websites. It features:

- Status cards showing counts of websites in different states
- Tabs for filtering websites by status (all, completed, running, queued, error)
- A table displaying website analysis results
- Actions for adding new URLs, rerunning analyses, and deleting websites
- Search functionality for finding specific websites

```tsx
// Key state in CrawlerDashboard
const [results, setResults] = useState<CrawlResult[]>([]);
const [isLoading, setIsLoading] = useState(false);
const [activeTab, setActiveTab] = useState('all');
```

The dashboard uses a single `CrawlResultsTable` component that updates based on the selected tab, improving performance by avoiding duplicate component instances.

### CrawlResultsTable

The `CrawlResultsTable` component displays website analysis results in a tabular format. It handles:

- Sorting by different columns
- Selection of multiple items for bulk actions
- Pagination
- Row actions (rerun analysis, delete)
- Search filtering

```tsx
interface CrawlResultsTableProps {
  results: CrawlResult[];
  isLoading: boolean;
  selectedIds: string[];
  setSelectedIds: (selectedIds: string[]) => void;
  sortField: SortField;
  setSortField: (field: SortField) => void;
  sortDirection: SortDirection;
  setSortDirection: (direction: SortDirection) => void;
  onRerun: (id: string) => void;
  onDelete: (id: string) => void;
  page: number;
  setPage: (page: number) => void;
  pageSize: number;
  totalCount: number;
  searchQuery?: string;
  setSearchQuery?: (query: string) => void;
  onRefresh?: () => void;
}
```

### CrawlDetails

The `CrawlDetails` component displays detailed information about a specific website analysis, including:

- Website metadata (title, URL, HTML version)
- Heading structure analysis
- Link analysis (internal, external, broken links)
- Login form detection
- Status information

```tsx
// Tabs in CrawlDetails
<Tabs defaultValue="overview" className="space-y-4">
  <TabsList>
    <TabsTrigger value="overview">Overview</TabsTrigger>
    <TabsTrigger value="links">Links</TabsTrigger>
    {details.brokenLinks && details.brokenLinks.length > 0 && (
      <TabsTrigger value="issues">Issues</TabsTrigger>
    )}
  </TabsList>
  
  <TabsContent value="overview">
    {/* Overview content */}
  </TabsContent>
  
  <TabsContent value="links">
    {/* Links content */}
  </TabsContent>
  
  <TabsContent value="issues">
    {/* Broken links content */}
  </TabsContent>
</Tabs>
```

### Authentication Components

The `Login` and `Register` components handle user authentication:

- Form validation
- Error handling
- Password visibility toggle
- Redirection after successful authentication

## Data Flow

1. **User Authentication**:
   - User logs in or registers
   - Authentication token is stored in localStorage
   - Auth context provides authentication state to the application

2. **Dashboard Data Loading**:
   - `CrawlerDashboard` fetches website data on mount
   - Data is filtered and sorted based on user selection
   - Periodic polling updates data for websites in running/queued state

3. **Website Analysis**:
   - User submits a URL via `AddUrlDialog`
   - URL is sent to the backend and saved with "queued" status
   - User initiates analysis, which updates status to "running"
   - Dashboard polls for updates until analysis is complete
   - Results are displayed in the table and can be viewed in detail

4. **Detail View**:
   - User clicks on a row to view details
   - `CrawlDetails` fetches detailed information about the website
   - Data is displayed in tabs for different aspects of the analysis

## Type System

The application uses TypeScript for type safety. Key types are defined in `types/crawler.ts`:

```typescript
export interface CrawlResult {
  id: string;
  url: string;
  title: string;
  htmlVersion: string;
  headingCounts: {
    h1: number;
    h2: number;
    h3: number;
    h4: number;
    h5: number;
    h6: number;
  };
  internalLinks: number;
  externalLinks: number;
  inaccessibleLinks: number;
  hasLoginForm: boolean;
  status: 'queued' | 'running' | 'completed' | 'error';
  createdAt: string;
  completedAt?: string;
  errorMessage?: string;
}

export interface BrokenLink {
  url: string;
  statusCode: number;
  statusText: string;
}

export interface CrawlDetails extends CrawlResult {
  brokenLinks: BrokenLink[];
}

export type SortField = keyof Pick<CrawlResult, 'title' | 'url' | 'internalLinks' | 'externalLinks' | 'createdAt' | 'status'>;
export type SortDirection = 'asc' | 'desc';
```

Component-specific types are defined within their respective files, while shared types are centralized in the types directory.

## Authentication

Authentication is handled by the `auth.tsx` context provider:

```typescript
interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string) => Promise<void>;
  logout: () => void;
}
```

The auth context:
- Manages user authentication state
- Provides login, register, and logout functions
- Stores and retrieves the authentication token from localStorage
- Makes authenticated API requests through the API service

## API Integration

The `api.ts` file contains services for interacting with the backend API:

```typescript
export const websiteAPI = {
  getWebsites: async (page = 1, pageSize = 10): Promise<{ websites: CrawlResult[]; totalCount: number }> => {
    const response = await api.get('/websites', {
      params: { page, page_size: pageSize },
    });
    
    return {
      websites: (response.data.websites || []).map(mapWebsiteToResult),
      totalCount: response.data.total_count || 0,
    };
  },
  
  getWebsite: async (id: string): Promise<CrawlDetails> => {
    const response = await api.get(`/websites/${id}`);
    const result = mapWebsiteToResult(response.data);
    
    // Map broken links
    const brokenLinks = (response.data.broken_links || []).map((link: any) => ({
      url: link.url,
      statusCode: link.status_code,
      statusText: getStatusText(link.status_code),
    }));
    
    return {
      ...result,
      brokenLinks,
    };
  },
  
  createWebsite: async (url: string): Promise<CrawlResult> => {
    const response = await api.post('/websites', { url });
    return mapWebsiteToResult(response.data);
  },
  
  startAnalysis: async (id: string): Promise<void> => {
    await api.post(`/websites/${id}/start`);
  },
  
  deleteWebsite: async (id: string): Promise<void> => {
    await api.delete(`/websites/${id}`);
  },
};
```

The API service:
- Maps backend data to frontend types
- Handles authentication headers
- Provides methods for all API operations

## UI Components

The application uses the shadcn/ui component library, which provides:

- Consistent styling and theming
- Accessible components
- Responsive design

Key UI components include:
- `Card` for content containers
- `Table` for data display
- `Tabs` for organizing content
- `Button` for actions
- `Dialog` for modals
- `Form` components for user input

## Getting Started

To run the frontend locally:

1. Clone the repository
2. Install dependencies:
   ```
   cd frontend
   npm install
   ```
3. Start the development server:
   ```
   npm run dev
   ```
4. The application will be available at http://localhost:3000

Make sure the backend server is running on http://localhost:8080 for API requests to work correctly.

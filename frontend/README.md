# Website Analyzer Frontend

A detailed breakdown of how I built the frontend for the Website Analyzer project - documenting key decisions, component structure, and the overall architecture.

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

I built this frontend as a modern React app that gives users a clean interface for the website analysis tool. The main goals were to create a responsive design that works well on all devices, implement a reliable authentication flow, and provide real-time updates during ongoing analyses. The dashboard-centered UI makes it easy to manage multiple website analyses at once.

## Tech Stack

- **React**: For building the component-based UI
- **TypeScript**: Added for type safety and better IDE support
- **Vite**: Chose this over CRA for faster builds and hot module replacement
- **React Router**: Handles navigation with protected routes
- **shadcn/ui**: Used as a base for custom components (saved tons of time)
- **Tailwind CSS**: For utility-first styling that's easy to customize
- **Lucide React**: Lightweight icon library with consistent design
- **Axios**: For API requests with interceptors for auth

## Project Structure

I organized the project with a focus on separation of concerns:

```
frontend/
├── src/
│   ├── components/        # Reusable UI building blocks
│   ├── lib/               # Core utilities and services
│   │   ├── api.ts         # API client with typed responses
│   │   └── auth.tsx       # Auth context + token management
│   ├── pages/             # Route-level components
│   │   ├── CrawlDetails.tsx       # Single website analysis view
│   │   ├── CrawlerDashboard.tsx   # Main dashboard
│   │   ├── CrawlResultsTable.tsx  # Sortable/filterable results
│   │   ├── Login.tsx              # Authentication
│   │   ├── Register.tsx           # User registration
│   │   └── NotFound.tsx           # 404 handler
│   ├── types/             # Shared type definitions
│   │   └── crawler.ts     # Analysis data models
│   ├── App.tsx            # Routes and layout wrapper
│   ├── main.tsx           # Entry point
│   └── index.css          # Global styles
```

## Key Components

### CrawlerDashboard

The dashboard is the heart of the app - I designed it to give users a quick overview of all their analyzed websites. Key features include:

- Status cards with real counts that update in real-time
- Tab-based filtering that's fast (no server roundtrips for filtering)
- Powerful table with sorting, searching and bulk actions
- Built-in polling that only activates when sites are being processed

A code snippet showing how I handled the polling logic:

```tsx
useEffect(() => {
  fetchData();
  
  // Only poll if we have active jobs
  const interval = setInterval(() => {
    if (results.some(r => r.status === 'running' || r.status === 'queued')) {
      fetchData(false); // silent refresh
    }
  }, 10000);
  
  return () => clearInterval(interval);
}, [page, pageSize, isAuthenticated]);
```

### CrawlResultsTable

This table component was challenging to build because it needed to handle:

- Column sorting that maintains state when changing tabs
- Bulk selection that works across pages
- Responsive design that collapses on mobile
- Row click navigation that doesn't interfere with action buttons

The component takes many props but I kept the internal logic clean:

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

The details view displays all the information gathered during analysis. I used a tabbed interface to organize the data into logical sections:

- Overview tab shows the general website info and metadata
- Links tab provides breakdowns of internal/external connections
- Issues tab (conditionally shown) highlights problems like broken links

This approach keeps the UI clean while still showing all the data:

```tsx
<Tabs defaultValue="overview" className="space-y-4">
  <TabsList>
    <TabsTrigger value="overview">Overview</TabsTrigger>
    <TabsTrigger value="links">Links</TabsTrigger>
    {details.brokenLinks && details.brokenLinks.length > 0 && (
      <TabsTrigger value="issues">Issues</TabsTrigger>
    )}
  </TabsList>
  
  <TabsContent value="overview">
    {/* Site metadata, HTML version, heading structure */}
  </TabsContent>
  
  <TabsContent value="links">
    {/* Link analysis with charts and tables */}
  </TabsContent>
  
  <TabsContent value="issues">
    {/* Broken links with status codes and suggestions */}
  </TabsContent>
</Tabs>
```

## Data Flow

The app follows a clear data flow pattern that I designed to be predictable:

1. **Auth Flow**:
   - User logs in → JWT stored in localStorage
   - Auth context provides global access to auth state
   - API requests automatically include the token

2. **Dashboard Loading**:
   - On mount, data is fetched with loading states
   - User interactions (sorting, filtering, etc.) update local state
   - Smart polling checks for updates to running analyses

3. **Analysis Process**:
   - User adds URL → saved as "queued"
   - Analysis starts → status updates to "running" 
   - Polling updates the status until completion
   - Results appear in the table when done

4. **Detail View**:
   - When user clicks a row → fetch detailed data
   - Different tabs show focused subsets of the data
   - Actions like re-running analysis update the parent state

## Type System

I took advantage of TypeScript to create a solid type foundation. The core types in `types/crawler.ts` define our data model:

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
```

I created some utility types for operations like sorting:

```typescript
export type SortField = keyof Pick<CrawlResult, 'title' | 'url' | 'internalLinks' | 'externalLinks' | 'createdAt' | 'status'>;
export type SortDirection = 'asc' | 'desc';
```

## Authentication

Auth is handled through a custom context provider that manages the token and user state:

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

The context handles:
- Login/logout flows with proper token storage
- Registration for new users (admin only)
- Loading states during auth operations
- Token validation and refresh

## API Integration

The API service handles all communication with the backend. I structured it to map backend data formats to our frontend types automatically:

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
  
  // Other methods...
  
  // Recently added bulk operations for better performance
  bulkDeleteWebsites: async (ids: string[]): Promise<void> => {
    const intIds = ids.map(id => parseInt(id, 10));
    await api.post('/websites/bulk-delete', { ids: intIds });
  },
  
  bulkStartAnalysis: async (ids: string[]): Promise<void> => {
    const intIds = ids.map(id => parseInt(id, 10));
    await api.post('/websites/bulk-start', { ids: intIds });
  },
};
```

This design provides:
- Consistent data transformation
- Proper error handling
- Type safety for all API responses
- Support for both individual and bulk operations

## UI Components

For the UI, I started with shadcn/ui components and customized them to fit our needs:

- Cards for stats and content containers
- Tables with custom sorting and selection
- Forms with validation and error handling
- Modals and dialogs for user interactions
- Status indicators that are color-coded by state

The system maintains visual consistency while being adaptable to different screen sizes.

## Getting Started

If you want to run the frontend locally:

1. Clone the repo
2. Install dependencies:
   ```
   cd frontend
   npm install
   ```
3. Start the dev server:
   ```
   npm run dev
   ```
4. Open http://localhost:3000 in your browser

Make sure you have the backend running at http://localhost:8080 first, or modify the `VITE_API_URL` in your `.env` file to point to your API.

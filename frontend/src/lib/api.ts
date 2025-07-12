import axios from 'axios';
import { CrawlResult, CrawlDetails } from '@/types/crawler';

// Get API URL from environment variable or fallback to localhost
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080/api';

// Create axios instance with base URL
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add request interceptor to include auth token in requests
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Authentication API
export const authAPI = {
  login: async (username: string, password: string) => {
    const response = await api.post('/auth/login', { username, password });
    return response.data;
  },
  
  register: async (username: string, email: string, password: string) => {
    const response = await api.post('/auth/register', { username, email, password });
    return response.data;
  },
};

// Map backend website data to frontend CrawlResult format
const mapWebsiteToResult = (website: any): CrawlResult => {
  return {
    id: website.id.toString(),
    url: website.url,
    title: website.title || '',
    htmlVersion: website.html_version || '',
    headingCounts: {
      h1: website.heading_counts?.h1_count || 0,
      h2: website.heading_counts?.h2_count || 0,
      h3: website.heading_counts?.h3_count || 0,
      h4: website.heading_counts?.h4_count || 0,
      h5: website.heading_counts?.h5_count || 0,
      h6: website.heading_counts?.h6_count || 0,
    },
    internalLinks: website.link_counts?.internal_links || 0,
    externalLinks: website.link_counts?.external_links || 0,
    inaccessibleLinks: website.broken_links?.length || 0,
    hasLoginForm: website.link_counts?.has_login_form || false,
    status: mapStatus(website.status),
    createdAt: website.created_at,
    completedAt: website.status === 'done' ? website.updated_at : undefined,
    errorMessage: website.error_message || undefined,
  };
};

// Map backend status to frontend status
const mapStatus = (status: string): 'queued' | 'running' | 'completed' | 'error' => {
  switch (status) {
    case 'done':
      return 'completed';
    case 'running':
      return 'running';
    case 'error':
      return 'error';
    case 'queued':
    default:
      return 'queued';
  }
};

// Websites API
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
  
  bulkDeleteWebsites: async (ids: string[]): Promise<void> => {
    // Convert string IDs to integers for the backend
    const intIds = ids.map(id => parseInt(id, 10));
    await api.post('/websites/bulk-delete', { ids: intIds });
  },
  
  bulkStartAnalysis: async (ids: string[]): Promise<void> => {
    // Convert string IDs to integers for the backend
    const intIds = ids.map(id => parseInt(id, 10));
    await api.post('/websites/bulk-start', { ids: intIds });
  },
};

// Helper function to get HTTP status text
function getStatusText(statusCode: number): string {
  const statusTexts: Record<number, string> = {
    400: 'Bad Request',
    401: 'Unauthorized',
    403: 'Forbidden',
    404: 'Not Found',
    408: 'Request Timeout',
    500: 'Internal Server Error',
    502: 'Bad Gateway',
    503: 'Service Unavailable',
    504: 'Gateway Timeout',
  };
  
  return statusTexts[statusCode] || 'Unknown Error';
}

export default api; 
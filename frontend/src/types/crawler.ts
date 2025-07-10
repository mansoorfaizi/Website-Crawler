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
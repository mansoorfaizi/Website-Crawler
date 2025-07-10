import { useState } from 'react';
import { 
  ChevronUp, 
  ChevronDown, 
  ExternalLink, 
  Clock, 
  CheckCircle, 
  XCircle, 
  Loader2, 
  RotateCcw, 
  Trash2,
  MoreHorizontal,
  Link2,
  Search,
  RefreshCw
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { CrawlResult, SortField, SortDirection } from '@/types/crawler';
import { useNavigate } from 'react-router-dom';
import { 
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

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
  onRefresh?: () => void; // Add refresh callback
}

export function CrawlResultsTable({
  results,
  isLoading,
  selectedIds,
  setSelectedIds,
  sortField,
  setSortField,
  sortDirection,
  setSortDirection,
  onRerun,
  onDelete,
  page,
  setPage,
  pageSize,
  totalCount,
  searchQuery = '',
  setSearchQuery,
  onRefresh,
}: CrawlResultsTableProps) {
  const navigate = useNavigate();
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  const handleSort = (field: SortField) => {
    if (field === sortField) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(results.map(r => r.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectRow = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedIds([...selectedIds, id]);
    } else {
      setSelectedIds(selectedIds.filter(selectedId => selectedId !== id));
    }
  };

  const handleRerun = async (id: string) => {
    setActionLoading(id);
    try {
      await onRerun(id);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (id: string) => {
    setActionLoading(id);
    try {
      await onDelete(id);
    } finally {
      setActionLoading(null);
    }
  };

  const getStatusIcon = (status: CrawlResult['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-success" />;
      case 'running':
        return <Loader2 className="h-4 w-4 text-warning animate-spin" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-destructive" />;
      case 'queued':
        return <Clock className="h-4 w-4 text-primary" />;
    }
  };

  const getStatusBadge = (status: CrawlResult['status']) => {
    const variants = {
      completed: 'default',
      running: 'secondary',
      error: 'destructive',
      queued: 'outline',
    } as const;

    return (
      <Badge variant={variants[status]} className="flex items-center gap-1">
        {getStatusIcon(status)}
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  const SortHeader = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <Button
      variant="ghost"
      onClick={() => handleSort(field)}
      className="h-auto p-0 font-semibold justify-start hover:bg-transparent"
    >
      <span className="flex items-center">
        {children}
        {sortField === field && (
          sortDirection === 'asc' ? 
            <ChevronUp className="ml-1 h-4 w-4" /> : 
            <ChevronDown className="ml-1 h-4 w-4" />
        )}
      </span>
    </Button>
  );

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const renderPagination = () => {
    // Only show pagination if we have more than one page
    if (totalPages <= 1) {
      return null;
    }

    return (
      <Pagination className="my-4">
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious 
              onClick={() => setPage(Math.max(1, page - 1))}
              className={page <= 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
            />
          </PaginationItem>
          
          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
            // Show pages around the current page
            let pageNum = page;
            if (page <= 3) {
              // At the beginning, show first 5 pages
              pageNum = i + 1;
            } else if (page >= totalPages - 2) {
              // At the end, show last 5 pages
              pageNum = totalPages - 4 + i;
            } else {
              // In the middle, show current page and 2 on each side
              pageNum = page - 2 + i;
            }
            
            // Make sure we don't go out of bounds
            if (pageNum > 0 && pageNum <= totalPages) {
              return (
                <PaginationItem key={pageNum}>
                  <PaginationLink 
                    onClick={() => setPage(pageNum)}
                    isActive={page === pageNum}
                    className="cursor-pointer"
                  >
                    {pageNum}
                  </PaginationLink>
                </PaginationItem>
              );
            }
            return null;
          })}
          
          <PaginationItem>
            <PaginationNext 
              onClick={() => setPage(Math.min(totalPages, page + 1))}
              className={page >= totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
            />
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    );
  };

  // Display information about shown items and total
  const startItem = ((page - 1) * pageSize) + 1;
  const endItem = Math.min(page * pageSize, totalCount);
  const itemsInfo = totalCount > 0 
    ? `Showing ${startItem}-${endItem} of ${totalCount} websites`
    : "No websites found";

  return (
    <Card>
      <CardContent className="p-0">
        <div className="p-4 border-b">
          <div className="flex justify-between items-center">
            {setSearchQuery && (
              <div className="relative max-w-sm">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search URLs or titles..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (onRefresh) {
                  setIsRefreshing(true);
                  try {
                    onRefresh();
                  } finally {
                    setTimeout(() => setIsRefreshing(false), 500);
                  }
                }
              }}
              disabled={isRefreshing}
              className="gap-2 h-9"
            >
              {isRefreshing ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Refreshing...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4" />
                  Refresh
                </>
              )}
            </Button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <Checkbox
                    checked={results.length > 0 && selectedIds.length === results.length}
                    onCheckedChange={handleSelectAll}
                  />
                </TableHead>
                <TableHead>
                  <SortHeader field="status">Status</SortHeader>
                </TableHead>
                <TableHead>
                  <SortHeader field="title">Title</SortHeader>
                </TableHead>
                <TableHead>
                  <SortHeader field="url">URL</SortHeader>
                </TableHead>
                <TableHead className="text-center hidden md:table-cell">HTML Version</TableHead>
                <TableHead className="text-center hidden md:table-cell">
                  <SortHeader field="internalLinks">Internal Links</SortHeader>
                </TableHead>
                <TableHead className="text-center hidden md:table-cell">
                  <SortHeader field="externalLinks">External Links</SortHeader>
                </TableHead>
                <TableHead className="text-center hidden md:table-cell">Broken Links</TableHead>
                <TableHead className="text-center hidden md:table-cell">Login Form</TableHead>
                <TableHead className="hidden md:table-cell">
                  <SortHeader field="createdAt">Created</SortHeader>
                </TableHead>
                <TableHead className="text-right w-20">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && results.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={11} className="h-24 text-center">
                    <div className="flex flex-col items-center justify-center space-y-3 py-4">
                      <Loader2 className="h-8 w-8 animate-spin text-primary" />
                      <div className="text-sm text-muted-foreground">Loading website data...</div>
                    </div>
                  </TableCell>
                </TableRow>
              ) : results.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={11} className="h-24 text-center">
                    <div className="flex flex-col items-center justify-center space-y-2 py-8">
                      <Link2 className="h-8 w-8 text-muted-foreground" />
                      <div className="text-muted-foreground font-medium">No websites found</div>
                      <div className="text-sm text-muted-foreground">Add a new URL to analyze</div>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                results.map((result) => (
                  <TableRow 
                    key={result.id}
                    className="hover:bg-muted/50 group"
                    onClick={() => navigate(`/details/${result.id}`)}
                  >
                    <TableCell onClick={(e) => e.stopPropagation()} className="py-3">
                      <Checkbox
                        checked={selectedIds.includes(result.id)}
                        onCheckedChange={(checked) => handleSelectRow(result.id, !!checked)}
                        className="data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
                      />
                    </TableCell>
                    <TableCell className="py-3">
                      {getStatusBadge(result.status)}
                    </TableCell>
                    <TableCell className="font-medium max-w-xs truncate py-3">
                      {result.title || 'Untitled'}
                    </TableCell>
                    <TableCell className="max-w-sm truncate text-muted-foreground py-3">
                      <div className="flex items-center gap-1">
                        <span className="truncate">{result.url}</span>
                        <a 
                          href={result.url} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          onClick={(e) => e.stopPropagation()}
                          className="text-muted-foreground/70 hover:text-primary opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    </TableCell>
                    <TableCell className="text-center hidden md:table-cell py-3">
                      {result.htmlVersion || '-'}
                    </TableCell>
                    <TableCell className="text-center hidden md:table-cell py-3">
                      <span className="text-primary font-medium">{result.internalLinks}</span>
                    </TableCell>
                    <TableCell className="text-center hidden md:table-cell py-3">
                      <span className="text-accent font-medium">{result.externalLinks}</span>
                    </TableCell>
                    <TableCell className="text-center hidden md:table-cell py-3">
                      <span className={result.inaccessibleLinks > 0 ? 'text-destructive font-medium' : ''}>
                        {result.inaccessibleLinks}
                      </span>
                    </TableCell>
                    <TableCell className="text-center hidden md:table-cell py-3">
                      {result.hasLoginForm ? (
                        <CheckCircle className="h-4 w-4 text-success mx-auto" />
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground hidden md:table-cell py-3">
                      {formatDate(result.createdAt)}
                    </TableCell>
                    <TableCell className="py-3" onClick={(e) => e.stopPropagation()}>
                      <div className="flex gap-1 justify-end">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 hidden md:flex"
                                disabled={result.status === 'running' || result.status === 'queued' || actionLoading === result.id}
                                onClick={() => handleRerun(result.id)}
                              >
                                {actionLoading === result.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <RotateCcw className="h-4 w-4" />
                                )}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Re-run analysis</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive hidden md:flex"
                                disabled={actionLoading === result.id}
                                onClick={() => handleDelete(result.id)}
                              >
                                {actionLoading === result.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Trash2 className="h-4 w-4" />
                                )}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Delete website</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        
                        {/* Mobile dropdown menu */}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 md:hidden"
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              className="gap-2"
                              disabled={result.status === 'running' || result.status === 'queued' || actionLoading === result.id}
                              onClick={() => handleRerun(result.id)}
                            >
                              <RotateCcw className="h-4 w-4" />
                              <span>Re-run analysis</span>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="gap-2 text-destructive focus:text-destructive"
                              disabled={actionLoading === result.id}
                              onClick={() => handleDelete(result.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                              <span>Delete website</span>
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
        
        <div className="p-4 flex flex-col sm:flex-row justify-between items-center gap-4 border-t">
          <div className="text-sm text-muted-foreground">
            {itemsInfo}
          </div>
          <div className="flex justify-end w-full sm:w-auto">
            {renderPagination()}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
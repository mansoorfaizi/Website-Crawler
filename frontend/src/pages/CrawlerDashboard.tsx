import { useState, useMemo, useEffect } from 'react';
import { 
  Plus, 
  RotateCcw, 
  Trash2, 
  Globe,
  RefreshCw,
  CheckCircle,
  Clock,
  XCircle,
  LogOut
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CrawlResult, SortField, SortDirection } from '@/types/crawler';
import { AddUrlDialog } from '../components/AddUrlDialog';
import { CrawlResultsTable } from './CrawlResultsTable';
import { websiteAPI } from '@/lib/api';
import { useAuth } from '@/lib/auth';

export function CrawlerDashboard() {
  const { toast } = useToast();
  const { isAuthenticated, logout } = useAuth();
  const [results, setResults] = useState<CrawlResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isAddingUrl, setIsAddingUrl] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<SortField>('createdAt');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [activeTab, setActiveTab] = useState('all');

  // Initial data load
  const fetchData = async (showLoading = true) => {
    if (!isAuthenticated) return;
    
    if (showLoading) {
      setIsLoading(true);
    } else {
      setIsRefreshing(true);
    }
    
    try {
      const data = await websiteAPI.getWebsites(page, pageSize);
      setResults(data.websites);
      setTotalCount(data.totalCount);
    } catch (error) {
      console.error('Failed to fetch websites', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to load websites. Please try again.'
      });
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
    
    // Set up polling to refresh data every 10 seconds
    const interval = setInterval(() => {
      // Only auto-refresh if we have items in running or queued state
      if (results.some(r => r.status === 'running' || r.status === 'queued')) {
        fetchData(false);
      }
    }, 10000);
    
    return () => clearInterval(interval);
  }, [page, pageSize, isAuthenticated]);

  const filteredAndSortedResults = useMemo(() => {
    let filtered = results;

    // Search filter
    if (searchQuery) {
      filtered = filtered.filter(result => 
        result.url.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (result.title && result.title.toLowerCase().includes(searchQuery.toLowerCase()))
      );
    }

    // Sort
    filtered = [...filtered].sort((a, b) => {
      const aValue = a[sortField];
      const bValue = b[sortField];
      
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortDirection === 'asc' 
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }
      
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
      }
      
      return 0;
    });

    return filtered;
  }, [results, searchQuery, sortField, sortDirection]);

  const handleAddUrl = async (url: string) => {
    try {
      setShowAddDialog(false);
      setIsAddingUrl(true);
      
      toast({
        title: 'Adding URL',
        description: 'Your URL is being added for analysis...'
      });
      
      const newResult = await websiteAPI.createWebsite(url);
      
      // Add new result to the beginning of the list
      setResults(prev => [newResult, ...prev]);
      
      // Start analysis
      await websiteAPI.startAnalysis(newResult.id);
      
      toast({
        title: 'URL Added',
        description: 'Analysis started successfully!'
      });
      
      // Refresh data
      fetchData(false);
    } catch (error) {
      console.error('Error adding URL:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to add URL. Please try again.'
      });
    } finally {
      setIsAddingUrl(false);
    }
  };

  const handleBulkAction = async (action: 'rerun' | 'delete') => {
    if (selectedIds.length === 0) return;
    
    try {
      if (action === 'delete') {
        // Delete each selected website
        await Promise.all(selectedIds.map(id => websiteAPI.deleteWebsite(id)));
        
        // Remove deleted items from local state
        setResults(prev => prev.filter(result => !selectedIds.includes(result.id)));
        
        toast({
          title: 'Websites Deleted',
          description: `Successfully deleted ${selectedIds.length} website(s)`
        });
      } else if (action === 'rerun') {
        // Start analysis for each selected website
        await Promise.all(selectedIds.map(id => websiteAPI.startAnalysis(id)));
        
        // Update status in local state
        setResults(prev => prev.map(result => 
          selectedIds.includes(result.id) 
            ? { ...result, status: 'queued' as const }
            : result
        ));
        
        toast({
          title: 'Analysis Started',
          description: `Analysis started for ${selectedIds.length} website(s)`
        });
      }
      
      // Clear selection
      setSelectedIds([]);
      
      // Refresh data
      fetchData(false);
    } catch (error) {
      console.error(`Error performing bulk ${action}:`, error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: `Failed to ${action} websites. Please try again.`
      });
    }
  };

  const getStatusCounts = () => {
    return {
      total: totalCount,
      completed: results.filter(r => r.status === 'completed').length,
      running: results.filter(r => r.status === 'running').length,
      queued: results.filter(r => r.status === 'queued').length,
      error: results.filter(r => r.status === 'error').length
    };
  };

  const statusCounts = getStatusCounts();

  const renderStatusCards = () => (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
      <Card className="border-muted bg-muted/20">
        <CardHeader className="pb-2 pt-4">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Globe className="h-4 w-4 text-muted-foreground" />
            Total URLs
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="text-2xl font-bold">{statusCounts.total}</div>
        </CardContent>
      </Card>
      
      <Card className="border-success/20 bg-success/5">
        <CardHeader className="pb-2 pt-4">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-success" />
            Completed
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="text-2xl font-bold text-success">{statusCounts.completed}</div>
        </CardContent>
      </Card>
      
      <Card className="border-warning/20 bg-warning/5">
        <CardHeader className="pb-2 pt-4">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <RefreshCw className="h-4 w-4 text-warning" />
            Running
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="text-2xl font-bold text-warning">{statusCounts.running}</div>
        </CardContent>
      </Card>
      
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader className="pb-2 pt-4">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary" />
            Queued
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="text-2xl font-bold text-primary">{statusCounts.queued}</div>
        </CardContent>
      </Card>
      
      <Card className="border-destructive/20 bg-destructive/5">
        <CardHeader className="pb-2 pt-4">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <XCircle className="h-4 w-4 text-destructive" />
            Errors
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="text-2xl font-bold text-destructive">{statusCounts.error}</div>
        </CardContent>
      </Card>
    </div>
  );

  const renderLoader = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <Skeleton className="h-10 w-[250px]" />
        <Skeleton className="h-10 w-[100px]" />
      </div>
      
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {Array(5).fill(0).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
      
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-[400px] w-full" />
    </div>
  );

  const getFilteredResults = (tab: string) => {
    switch (tab) {
      case 'completed':
        return filteredAndSortedResults.filter(r => r.status === 'completed');
      case 'running':
        return filteredAndSortedResults.filter(r => r.status === 'running');
      case 'queued':
        return filteredAndSortedResults.filter(r => r.status === 'queued');
      case 'error':
        return filteredAndSortedResults.filter(r => r.status === 'error');
      default:
        return filteredAndSortedResults;
    }
  };

  const getTabCount = (tab: string) => {
    switch (tab) {
      case 'completed':
        return statusCounts.completed;
      case 'running':
        return statusCounts.running;
      case 'queued':
        return statusCounts.queued;
      case 'error':
        return statusCounts.error;
      default:
        return statusCounts.total;
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-7xl mx-auto">
          {renderLoader()}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Web Analyzer Dashboard</h1>
            <p className="text-muted-foreground">Analyze and monitor website crawl results</p>
          </div>
          <div className="flex items-center gap-3">
          <Button 
              variant="outline" 
              size="sm"
              onClick={() => logout()}
              className="gap-2 h-9"
            >
                <LogOut className="h-4 w-4" />
                Logout
            </Button>
            <Button 
              onClick={() => setShowAddDialog(true)} 
              className="gap-2 h-9"
              disabled={isAddingUrl}
            >
              {isAddingUrl ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Adding...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4" />
                  Add URL
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        {renderStatusCards()}

        {/* Bulk Actions */}
        {selectedIds.length > 0 && (
          <Card>
            <CardContent className="py-4 flex flex-wrap gap-3 items-center">
              <Badge variant="secondary" className="gap-1 mr-2">
                <Checkbox 
                  checked={true} 
                  className="h-3.5 w-3.5 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
                />
                {selectedIds.length} selected
              </Badge>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleBulkAction('rerun')}
                className="gap-2 h-9"
              >
                <RotateCcw className="h-4 w-4" />
                Reanalyze
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => handleBulkAction('delete')}
                className="gap-2 h-9"
              >
                <Trash2 className="h-4 w-4" />
                Delete
              </Button>
            </CardContent>
          </Card>
        )}

        <Tabs 
          defaultValue="all" 
          value={activeTab}
          onValueChange={setActiveTab}
          className="space-y-6"
        >
          <TabsList className="grid w-full md:w-auto grid-cols-5 gap-2">
            <TabsTrigger value="all">
              All
            </TabsTrigger>
            <TabsTrigger value="completed" className="gap-1.5">
              <CheckCircle className="h-3.5 w-3.5 text-success" />
              Completed
            </TabsTrigger>
            <TabsTrigger value="running" className="gap-1.5">
              <RefreshCw className="h-3.5 w-3.5 text-warning" />
              Running
            </TabsTrigger>
            <TabsTrigger value="queued" className="gap-1.5">
              <Clock className="h-3.5 w-3.5 text-primary" />
              Queued
            </TabsTrigger>
            <TabsTrigger value="error" className="gap-1.5">
              <XCircle className="h-3.5 w-3.5 text-destructive" />
              Error
            </TabsTrigger>
          </TabsList>
          
          {/* Single TabsContent that updates based on activeTab */}
          <TabsContent value={activeTab} className="mt-2 space-y-0">
            <CrawlResultsTable
              results={getFilteredResults(activeTab)}
              isLoading={isLoading}
              selectedIds={selectedIds}
              setSelectedIds={setSelectedIds}
              sortField={sortField}
              setSortField={setSortField}
              sortDirection={sortDirection}
              setSortDirection={setSortDirection}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              onRerun={async (id) => {
                try {
                  await websiteAPI.startAnalysis(id);
                  // Update status in local state
                  setResults(prev => prev.map(result => 
                    result.id === id 
                      ? { ...result, status: 'queued' as const }
                      : result
                  ));
                  toast({
                    title: 'Analysis Started',
                    description: 'Website analysis started successfully!'
                  });
                } catch (error) {
                  toast({
                    variant: 'destructive',
                    title: 'Error',
                    description: 'Failed to start analysis. Please try again.'
                  });
                }
              }}
              onDelete={async (id) => {
                try {
                  await websiteAPI.deleteWebsite(id);
                  setResults(prev => prev.filter(result => result.id !== id));
                  toast({
                    title: 'Website Deleted',
                    description: 'Website deleted successfully!'
                  });
                } catch (error) {
                  toast({
                    variant: 'destructive',
                    title: 'Error',
                    description: 'Failed to delete website. Please try again.'
                  });
                }
              }}
              page={page}
              setPage={setPage}
              pageSize={pageSize}
              totalCount={getTabCount(activeTab)}
              onRefresh={() => fetchData(false)}
            />
          </TabsContent>
        </Tabs>

        {/* Add URL Dialog */}
        <AddUrlDialog
          open={showAddDialog}
          onOpenChange={setShowAddDialog}
          onSubmit={handleAddUrl}
          isSubmitting={isAddingUrl}
        />
      </div>
    </div>
  );
}
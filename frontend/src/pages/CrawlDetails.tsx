import { useParams, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { 
  ArrowLeft, 
  ExternalLink, 
  Clock, 
  CheckCircle, 
  AlertCircle, 
  XCircle, 
  Loader2,
  Globe,
  BarChart3,
  Link2,
  AlertTriangle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BrokenLink, CrawlDetails as CrawlDetailsType } from '@/types/crawler';
import { websiteAPI } from '@/lib/api';

export default function CrawlDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [details, setDetails] = useState<CrawlDetailsType | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRerunning, setIsRerunning] = useState(false);

  useEffect(() => {
    const fetchDetails = async () => {
      if (!id) return;
      
      setIsLoading(true);
      setError(null);
      
      try {
        const data = await websiteAPI.getWebsite(id);
        setDetails(data);
      } catch (err) {
        setError('The requested crawl result could not be found.');
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchDetails();
    
    // Set up polling for running status
    const intervalId = setInterval(() => {
      if (details?.status === 'running' || details?.status === 'queued') {
        fetchDetails();
      }
    }, 5000);
    
    return () => clearInterval(intervalId);
  }, [id]);

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-6xl mx-auto space-y-6">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/')}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Dashboard
            </Button>
            <Skeleton className="h-8 w-64" />
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <Skeleton className="h-48 w-full" />
              <Skeleton className="h-40 w-full" />
            </div>
            <div className="space-y-6">
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-48 w-full" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !details) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="w-96 border-destructive/30">
          <CardHeader className="text-center pb-2">
            <XCircle className="h-12 w-12 text-destructive mx-auto mb-2" />
            <CardTitle className="text-xl">Crawl Result Not Found</CardTitle>
          </CardHeader>
          <CardContent className="text-center pb-4">
            <p className="text-muted-foreground mb-4">
              {error || 'The requested crawl result could not be found.'}
            </p>
          </CardContent>
          <CardFooter className="flex justify-center">
            <Button onClick={() => navigate('/')} className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Return to Dashboard
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  const handleRerunAnalysis = async () => {
    try {
      setIsRerunning(true);
      await websiteAPI.startAnalysis(details.id);
      toast({
        title: 'Analysis Started',
        description: 'Website analysis has been started again.'
      });
      
      // Update the status locally
      setDetails({
        ...details,
        status: 'queued'
      });
      
      // Refresh the page after a short delay
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to start analysis. Please try again.'
      });
    } finally {
      setIsRerunning(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-success" />;
      case 'running':
        return <Loader2 className="h-5 w-5 animate-spin text-warning" />;
      case 'error':
        return <XCircle className="h-5 w-5 text-destructive" />;
      case 'queued':
        return <Clock className="h-5 w-5 text-primary" />;
      default:
        return <Clock className="h-5 w-5 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      completed: 'default',
      running: 'secondary',
      error: 'destructive',
      queued: 'outline',
    } as const;

    return (
      <Badge variant={variants[status as keyof typeof variants] || 'outline'} className="flex items-center gap-1">
        {getStatusIcon(status)}
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  const totalLinks = details.internalLinks + details.externalLinks;
  const internalPercentage = totalLinks > 0 ? (details.internalLinks / totalLinks) * 100 : 0;
  const externalPercentage = totalLinks > 0 ? (details.externalLinks / totalLinks) * 100 : 0;

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/')}
              className="flex items-center gap-2 h-9"
          >
            <ArrowLeft className="h-4 w-4" />
              Back
          </Button>
            <div>
              <h1 className="text-2xl font-bold tracking-tight mb-1">{details.title || 'Untitled Website'}</h1>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="flex items-center gap-1 px-2 font-normal">
                  <Globe className="h-3 w-3 text-muted-foreground" />
                  <span className="max-w-md truncate">{details.url}</span>
                </Badge>
                <Button variant="ghost" size="icon" className="h-6 w-6" asChild>
                <a href={details.url} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-3 w-3" />
                </a>
              </Button>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
          {getStatusBadge(details.status)}
            <Button 
              variant="outline" 
              size="sm"
              className="gap-2 h-9"
              onClick={() => window.open(details.url, '_blank')}
            >
              <ExternalLink className="h-4 w-4" />
              Visit Website
            </Button>
            <Button 
              size="sm"
              className="gap-2 h-9"
              onClick={handleRerunAnalysis}
              disabled={details.status === 'running' || details.status === 'queued' || isRerunning}
            >
              {isRerunning || details.status === 'running' || details.status === 'queued' ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {isRerunning ? 'Starting...' : 'In Progress...'}
                </>
              ) : (
                <>
                  <BarChart3 className="h-4 w-4" />
                  Re-analyze
                </>
              )}
            </Button>
          </div>
        </div>

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full md:w-auto grid-cols-2 md:grid-cols-3 md:inline-grid">
            <TabsTrigger value="overview" className="gap-2">
              <BarChart3 className="h-4 w-4" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="links" className="gap-2">
              <Link2 className="h-4 w-4" />
              Links
            </TabsTrigger>
            {details.brokenLinks && details.brokenLinks.length > 0 && (
              <TabsTrigger value="issues" className="gap-2">
                <AlertTriangle className="h-4 w-4" />
                Issues
              </TabsTrigger>
            )}
          </TabsList>
          
          <TabsContent value="overview" className="space-y-6 mt-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Overview */}
          <div className="lg:col-span-2 space-y-6">
            {/* Basic Info */}
            <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2">
                      <Globe className="h-5 w-5 text-primary" />
                      Website Overview
                    </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">HTML Version</p>
                    <p className="font-medium">{details.htmlVersion || 'Unknown'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Internal Links</p>
                    <p className="font-medium text-primary">{details.internalLinks}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">External Links</p>
                    <p className="font-medium text-accent">{details.externalLinks}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Broken Links</p>
                    <p className={`font-medium ${details.inaccessibleLinks > 0 ? 'text-destructive' : 'text-success'}`}>
                      {details.inaccessibleLinks}
                    </p>
                  </div>
                </div>
                <Separator />
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Login Form Present</p>
                    <p className="font-medium">{details.hasLoginForm ? 'Yes' : 'No'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Crawled</p>
                    <p className="font-medium">
                      {new Date(details.createdAt).toLocaleString()}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Heading Distribution */}
            <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2">
                      <BarChart3 className="h-5 w-5 text-primary" />
                      Heading Structure
                    </CardTitle>
                    <CardDescription>
                      Distribution of heading tags across the website
                    </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Object.entries(details.headingCounts).map(([level, count]) => {
                    const maxCount = Math.max(...Object.values(details.headingCounts));
                    const percentage = maxCount > 0 ? (count / maxCount) * 100 : 0;
                    
                    return (
                      <div key={level} className="flex items-center gap-3">
                        <div className="w-8 text-sm font-medium text-muted-foreground uppercase">
                          {level}
                        </div>
                            <div className="flex-1 bg-secondary rounded-full h-2.5 overflow-hidden">
                          <div 
                            className="h-full bg-primary transition-all duration-300"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                        <div className="w-8 text-sm font-medium text-right">
                          {count}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
              </div>

              {/* Summary */}
              <div className="space-y-6">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2">
                      <CheckCircle className="h-5 w-5 text-primary" />
                      Analysis Summary
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <dl className="space-y-3">
                      <div className="flex justify-between">
                        <dt className="text-sm text-muted-foreground">Status</dt>
                        <dd className="font-medium">{details.status.charAt(0).toUpperCase() + details.status.slice(1)}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-sm text-muted-foreground">Total Links</dt>
                        <dd className="font-medium">{totalLinks}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-sm text-muted-foreground">Broken Links</dt>
                        <dd className={`font-medium ${details.inaccessibleLinks > 0 ? 'text-destructive' : ''}`}>
                          {details.inaccessibleLinks}
                        </dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-sm text-muted-foreground">HTML Version</dt>
                        <dd className="font-medium">{details.htmlVersion || 'Unknown'}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-sm text-muted-foreground">Login Form</dt>
                        <dd className="font-medium">{details.hasLoginForm ? 'Yes' : 'No'}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-sm text-muted-foreground">Analysis Date</dt>
                        <dd className="font-medium text-xs">
                          {new Date(details.createdAt).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </dd>
                      </div>
                    </dl>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2">
                      <Link2 className="h-5 w-5 text-primary" />
                      Link Distribution
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {totalLinks > 0 ? (
                      <>
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span>Internal Links</span>
                            <span className="font-medium">{internalPercentage.toFixed(1)}%</span>
                          </div>
                          <div className="w-full bg-secondary rounded-full h-2.5 overflow-hidden">
                            <div 
                              className="bg-primary h-full"
                              style={{ width: `${internalPercentage}%` }}
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span>External Links</span>
                            <span className="font-medium">{externalPercentage.toFixed(1)}%</span>
                          </div>
                          <div className="w-full bg-secondary rounded-full h-2.5 overflow-hidden">
                            <div 
                              className="bg-accent h-full"
                              style={{ width: `${externalPercentage}%` }}
                            />
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="text-center text-muted-foreground py-4">
                        No links found
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>
          
          <TabsContent value="links" className="space-y-6 mt-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <Card className="lg:col-span-3">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2">
                    <Link2 className="h-5 w-5 text-primary" />
                    Link Analysis
                  </CardTitle>
                  <CardDescription>
                    Overview of links found on the website
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    <Card className="border-muted bg-muted/30">
                      <CardHeader className="pb-2 pt-4">
                        <CardTitle className="text-sm text-muted-foreground">Total Links</CardTitle>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <div className="text-3xl font-bold">{totalLinks}</div>
                      </CardContent>
                    </Card>
                    
                    <Card className="border-primary/20 bg-primary/5">
                      <CardHeader className="pb-2 pt-4">
                        <CardTitle className="text-sm text-muted-foreground">Internal Links</CardTitle>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <div className="text-3xl font-bold text-primary">{details.internalLinks}</div>
                      </CardContent>
                    </Card>
                    
                    <Card className="border-accent/20 bg-accent/5">
                      <CardHeader className="pb-2 pt-4">
                        <CardTitle className="text-sm text-muted-foreground">External Links</CardTitle>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <div className="text-3xl font-bold text-accent">{details.externalLinks}</div>
                      </CardContent>
                    </Card>
                    
                    <Card className={details.inaccessibleLinks > 0 ? "border-destructive/20 bg-destructive/5" : "border-success/20 bg-success/5"}>
                      <CardHeader className="pb-2 pt-4">
                        <CardTitle className="text-sm text-muted-foreground">Broken Links</CardTitle>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <div className={`text-3xl font-bold ${details.inaccessibleLinks > 0 ? "text-destructive" : "text-success"}`}>
                          {details.inaccessibleLinks}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
          
          {details.brokenLinks && details.brokenLinks.length > 0 && (
            <TabsContent value="issues" className="space-y-6 mt-6">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2">
                    <AlertCircle className="h-5 w-5 text-destructive" />
                    Broken Links ({details.brokenLinks.length})
                  </CardTitle>
                  <CardDescription>
                    Links that returned error status codes during crawling
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {details.brokenLinks.map((link: BrokenLink, index: number) => (
                      <div key={index} className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 border rounded-lg gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{link.url}</p>
                        </div>
                        <Badge variant="destructive" className="sm:ml-4 self-start sm:self-auto">
                          {link.statusCode} {link.statusText}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </Tabs>
      </div>
    </div>
  );
}
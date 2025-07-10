import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Globe, AlertCircle, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose
} from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface AddUrlDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (url: string) => void;
  isSubmitting?: boolean;
}

export function AddUrlDialog({ 
  open, 
  onOpenChange, 
  onSubmit, 
  isSubmitting = false 
}: AddUrlDialogProps) {
  const [url, setUrl] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isValid, setIsValid] = useState(false);

  const validateUrl = (value: string) => {
    // Empty field
    if (!value.trim()) {
      setError(null);
      setIsValid(false);
      return;
    }
    
    try {
      new URL(value);
      // Check for http or https protocol
      if (value.startsWith('http://') || value.startsWith('https://')) {
        setError(null);
        setIsValid(true);
      } else {
        setError('URL must start with http:// or https://');
        setIsValid(false);
      }
    } catch {
      setError('Please enter a valid URL');
      setIsValid(false);
    }
  };

  const handleUrlChange = (value: string) => {
    setUrl(value);
    validateUrl(value);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!url.trim()) {
      setError('Please enter a URL');
      return;
    }
    
    if (isValid) {
      onSubmit(url);
    }
  };

  const handleClose = () => {
    setUrl('');
    setError(null);
    setIsValid(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-primary" />
            Add Website to Analyze
          </DialogTitle>
          <DialogDescription>
            Enter a complete website URL including the protocol (http:// or https://)
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="url" className="text-sm">
              Website URL
            </Label>
            <div className="relative">
              <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="url"
                type="url"
                placeholder="https://example.com"
                value={url}
                onChange={(e) => handleUrlChange(e.target.value)}
                className={`pl-9 ${error ? 'border-destructive' : ''}`}
                disabled={isSubmitting}
                autoFocus
              />
              {isValid && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-success">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                </div>
              )}
            </div>
            {error && (
              <Alert variant="destructive" className="py-2">
                <AlertCircle className="h-4 w-4 mr-2" />
                <AlertDescription className="text-xs">{error}</AlertDescription>
              </Alert>
            )}
          </div>
          
          <DialogFooter className="gap-2 sm:gap-0">
            <DialogClose asChild>
              <Button
                type="button"
                variant="outline"
                disabled={isSubmitting}
                className="gap-2"
              >
                <X className="h-4 w-4" />
                Cancel
              </Button>
            </DialogClose>
            <Button
              type="submit"
              disabled={!isValid || isSubmitting}
              className="gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Adding...
                </>
              ) : (
                <>
                  <Globe className="h-4 w-4" />
                  Add Website
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ExternalLink, FileX } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function NotFound() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <Card className="w-full max-w-md border-destructive/30">
        <CardHeader className="text-center pb-2">
          <FileX className="h-16 w-16 text-destructive mx-auto mb-2" />
          <CardTitle className="text-3xl font-bold">404</CardTitle>
        </CardHeader>
        <CardContent className="text-center pb-4">
          <p className="text-xl mb-2">Page Not Found</p>
          <p className="text-muted-foreground">
            The page you are looking for doesn't exist or has been moved.
          </p>
        </CardContent>
        <CardFooter className="flex justify-center gap-4">
          <Button 
            variant="default" 
            onClick={() => navigate("/")}
            className="gap-2"
          >
            Return to Dashboard
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

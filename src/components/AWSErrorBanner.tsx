import { AlertTriangle, Key, WifiOff, RefreshCw, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

interface AWSError {
  code?: string;
  message: string;
  type: 'auth' | 'network' | 'aws' | 'unknown';
}

interface AWSErrorBannerProps {
  error: AWSError;
  onRetry?: () => void;
  retrying?: boolean;
}

export function AWSErrorBanner({ error, onRetry, retrying }: AWSErrorBannerProps) {
  const navigate = useNavigate();

  const isCredentialError = error.type === 'auth';
  const isNetworkError = error.type === 'network';

  const Icon = isCredentialError ? Key : isNetworkError ? WifiOff : AlertTriangle;

  const title = isCredentialError
    ? "AWS Credentials Issue"
    : isNetworkError
    ? "Connection Problem"
    : "AWS Error";

  const description = isCredentialError
    ? "Your AWS credentials are invalid or missing. Update them in Settings to restore access."
    : isNetworkError
    ? "Unable to reach AWS. Check your internet connection and try again."
    : error.message;

  return (
    <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 flex items-start gap-3">
      <Icon className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="font-medium text-destructive">{title}</p>
        <p className="text-sm text-muted-foreground mt-1">{description}</p>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {isCredentialError && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/settings')}
            className="border-destructive/30 text-destructive hover:bg-destructive/10"
          >
            <Settings className="h-3.5 w-3.5 mr-1.5" />
            Settings
          </Button>
        )}
        {onRetry && (
          <Button
            variant="outline"
            size="sm"
            onClick={onRetry}
            disabled={retrying}
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${retrying ? 'animate-spin' : ''}`} />
            Retry
          </Button>
        )}
      </div>
    </div>
  );
}

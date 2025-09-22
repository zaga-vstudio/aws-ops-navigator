import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { 
  Cloud, 
  Key,
  Shield,
  CheckCircle,
  AlertTriangle,
  Loader2,
  ExternalLink
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

const AWSSetup = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [formData, setFormData] = useState({
    accessKeyId: '',
    secretAccessKey: ''
  });

  const { user } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    setIsLoading(true);
    setIsValidating(true);
    setError(null);

    try {
      // Call the edge function to save and validate AWS credentials
      const { data, error: apiError } = await supabase.functions.invoke('save-aws-credentials', {
        body: {
          accessKeyId: formData.accessKeyId,
          secretAccessKey: formData.secretAccessKey
        }
      });

      if (apiError) throw apiError;
      if (data.error) throw new Error(data.error);

      // Update setup completion status
      const { error: setupError } = await supabase
        .from('user_setup')
        .update({
          aws_setup_completed: true,
          aws_connected: true
        })
        .eq('user_id', user.id);

      if (setupError) throw setupError;

      // Redirect to dashboard
      navigate('/dashboard');
    } catch (error: any) {
      setError(error.message || 'Failed to connect to AWS. Please verify your credentials.');
    } finally {
      setIsLoading(false);
      setIsValidating(false);
    }
  };

  const isFormValid = formData.accessKeyId.trim() && formData.secretAccessKey.trim();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/50 bg-background/95 backdrop-blur">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-primary to-primary-glow rounded-lg flex items-center justify-center">
              <Cloud className="h-5 w-5 text-white" />
            </div>
            <h1 className="text-xl font-bold text-foreground">CloudHub Setup</h1>
          </div>
        </div>
      </header>

      {/* Setup Content */}
      <div className="container mx-auto px-6 py-12">
        <div className="max-w-2xl mx-auto">
          {/* Progress */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-foreground">
                AWS Connection Setup
              </span>
              <span className="text-sm text-muted-foreground">
                Step 1 of 1
              </span>
            </div>
            <Progress value={50} className="h-2" />
          </div>

          {/* AWS Setup Card */}
          <Card>
            <CardHeader>
              <div className="w-12 h-12 bg-gradient-to-br from-aws-orange to-warning rounded-lg flex items-center justify-center mx-auto mb-4">
                <Key className="h-6 w-6 text-white" />
              </div>
              <CardTitle>Connect Your AWS Account</CardTitle>
              <CardDescription>
                To display your AWS resources, we need your AWS credentials. These will be stored securely and encrypted.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="accessKeyId">AWS Access Key ID</Label>
                    <Input
                      id="accessKeyId"
                      placeholder="AKIA..."
                      value={formData.accessKeyId}
                      onChange={(e) => setFormData({ ...formData, accessKeyId: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="secretAccessKey">AWS Secret Access Key</Label>
                    <Input
                      id="secretAccessKey"
                      type="password"
                      placeholder="Enter your secret access key"
                      value={formData.secretAccessKey}
                      onChange={(e) => setFormData({ ...formData, secretAccessKey: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <Alert>
                  <Shield className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Security Note:</strong> Your AWS credentials are encrypted before storage and are never shared with third parties. 
                    We recommend using IAM users with limited permissions for CloudHub access.
                  </AlertDescription>
                </Alert>

                <Alert>
                  <ExternalLink className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Need help?</strong> Visit the{" "}
                    <a 
                      href="https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_access-keys.html" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-primary underline"
                    >
                      AWS documentation
                    </a>{" "}
                    to learn how to create access keys.
                  </AlertDescription>
                </Alert>

                {error && (
                  <Alert className="border-destructive/50">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription className="text-destructive">
                      {error}
                    </AlertDescription>
                  </Alert>
                )}

                {isValidating && (
                  <Alert>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <AlertDescription>
                      Validating AWS credentials and testing connection...
                    </AlertDescription>
                  </Alert>
                )}

                <Button 
                  type="submit" 
                  className="w-full" 
                  disabled={!isFormValid || isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Connecting to AWS...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="mr-2 h-4 w-4" />
                      Connect AWS Account
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Info Cards */}
          <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="border-muted">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3 mb-2">
                  <Shield className="h-5 w-5 text-primary" />
                  <h3 className="font-semibold">Secure Storage</h3>
                </div>
                <p className="text-sm text-muted-foreground">
                  All credentials are encrypted using industry-standard encryption before being stored.
                </p>
              </CardContent>
            </Card>
            <Card className="border-muted">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3 mb-2">
                  <Cloud className="h-5 w-5 text-primary" />
                  <h3 className="font-semibold">Read-Only Access</h3>
                </div>
                <p className="text-sm text-muted-foreground">
                  CloudHub only reads your AWS resources and never makes changes to your infrastructure.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AWSSetup;
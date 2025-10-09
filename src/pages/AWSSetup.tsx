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

interface AWSSetupError {
  message: string;
  code?: string;
  type: 'validation' | 'api' | 'network' | 'unknown';
}

interface ValidationErrors {
  accessKeyId?: string;
  secretAccessKey?: string;
}

const AWSSetup = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<AWSSetupError | null>(null);
  const [validationErrors, setValidationErrors] = useState<ValidationErrors>({});
  const [isValidating, setIsValidating] = useState(false);
  const [formData, setFormData] = useState({
    accessKeyId: '',
    secretAccessKey: ''
  });

  const { user } = useAuth();
  const navigate = useNavigate();

  // AWS Access Key ID validation
  const validateAccessKeyId = (keyId: string): string | undefined => {
    if (!keyId) return 'Access Key ID is required';
    if (!keyId.startsWith('AKIA')) return 'Access Key ID must start with "AKIA"';
    if (keyId.length !== 20) return 'Access Key ID must be exactly 20 characters long';
    if (!/^[A-Z0-9]+$/.test(keyId)) return 'Access Key ID must contain only uppercase letters and numbers';
    return undefined;
  };

  // AWS Secret Access Key validation
  const validateSecretAccessKey = (secretKey: string): string | undefined => {
    if (!secretKey) return 'Secret Access Key is required';
    if (secretKey.length !== 40) return 'Secret Access Key must be exactly 40 characters long';
    if (!/^[A-Za-z0-9+/]+$/.test(secretKey)) return 'Secret Access Key contains invalid characters';
    return undefined;
  };

  // Real-time validation
  const handleInputChange = (field: 'accessKeyId' | 'secretAccessKey', value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Clear previous validation error
    setValidationErrors(prev => ({ ...prev, [field]: undefined }));
    
    // Validate on blur or if field has content
    if (value.trim()) {
      const error = field === 'accessKeyId' 
        ? validateAccessKeyId(value.trim())
        : validateSecretAccessKey(value.trim());
      
      if (error) {
        setValidationErrors(prev => ({ ...prev, [field]: error }));
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    // Final validation before submission
    const accessKeyError = validateAccessKeyId(formData.accessKeyId.trim());
    const secretKeyError = validateSecretAccessKey(formData.secretAccessKey.trim());
    
    if (accessKeyError || secretKeyError) {
      setValidationErrors({
        accessKeyId: accessKeyError,
        secretAccessKey: secretKeyError
      });
      return;
    }
    
    setIsLoading(true);
    setIsValidating(true);
    setError(null);
    setValidationErrors({});

    try {
      // Call the edge function to save and validate AWS credentials
      const { data, error: apiError } = await supabase.functions.invoke('save-aws-credentials', {
        body: {
          accessKeyId: formData.accessKeyId.trim(),
          secretAccessKey: formData.secretAccessKey.trim()
        }
      });

      if (apiError) {
        throw {
          message: apiError.message || 'Network error occurred',
          code: apiError.name,
          type: 'network'
        } as AWSSetupError;
      }
      
      if (data?.error) {
        throw {
          message: data.error,
          code: data.errorCode,
          type: 'api'
        } as AWSSetupError;
      }

      // Update setup completion status
      const { error: setupError } = await supabase
        .from('user_setup')
        .update({
          aws_setup_completed: true,
          aws_connected: true
        })
        .eq('user_id', user.id);

      if (setupError) {
        throw {
          message: 'Failed to update setup status',
          type: 'api'
        } as AWSSetupError;
      }

      // Redirect to dashboard
      navigate('/dashboard');
    } catch (err) {
      const setupError: AWSSetupError = err as AWSSetupError || {
        message: 'An unexpected error occurred',
        type: 'unknown'
      };
      
      setError(setupError);
    } finally {
      setIsLoading(false);
      setIsValidating(false);
    }
  };

  const isFormValid = formData.accessKeyId.trim() && 
    formData.secretAccessKey.trim() && 
    !validationErrors.accessKeyId && 
    !validationErrors.secretAccessKey;

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
                      onChange={(e) => handleInputChange('accessKeyId', e.target.value)}
                      className={validationErrors.accessKeyId ? 'border-destructive' : ''}
                      required
                    />
                    {validationErrors.accessKeyId && (
                      <p className="text-sm text-destructive">{validationErrors.accessKeyId}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="secretAccessKey">AWS Secret Access Key</Label>
                    <Input
                      id="secretAccessKey"
                      type="password"
                      placeholder="Enter your secret access key"
                      value={formData.secretAccessKey}
                      onChange={(e) => handleInputChange('secretAccessKey', e.target.value)}
                      className={validationErrors.secretAccessKey ? 'border-destructive' : ''}
                      required
                    />
                    {validationErrors.secretAccessKey && (
                      <p className="text-sm text-destructive">{validationErrors.secretAccessKey}</p>
                    )}
                  </div>
                </div>

                <Alert>
                  <Shield className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Security Note:</strong> Your AWS credentials are encrypted before storage and are never shared with third parties. 
                    We recommend using IAM users with limited permissions for CloudHub access.
                  </AlertDescription>
                </Alert>

                <Alert className="border-primary/30 bg-primary/5">
                  <ExternalLink className="h-4 w-4 text-primary" />
                  <AlertDescription>
                    <div className="space-y-2">
                      <p className="font-semibold text-foreground">Cómo crear credenciales de AWS (IAM)</p>
                      <ol className="text-sm space-y-1 list-decimal list-inside text-muted-foreground">
                        <li>Ingresa a la <a href="https://console.aws.amazon.com/iam" target="_blank" rel="noopener noreferrer" className="text-primary underline">Consola de IAM</a></li>
                        <li>Ve a "Users" y crea un nuevo usuario</li>
                        <li>Selecciona "Programmatic access"</li>
                        <li>En permisos, adjunta las siguientes políticas:
                          <ul className="ml-6 mt-1 space-y-0.5 list-disc">
                            <li><code className="text-xs bg-muted px-1 rounded">AmazonEC2ReadOnlyAccess</code></li>
                            <li><code className="text-xs bg-muted px-1 rounded">AmazonRDSReadOnlyAccess</code></li>
                            <li><code className="text-xs bg-muted px-1 rounded">AmazonS3ReadOnlyAccess</code></li>
                          </ul>
                        </li>
                        <li>Guarda el Access Key ID y Secret Access Key</li>
                      </ol>
                      <p className="text-xs text-muted-foreground mt-2">
                        <strong>Importante:</strong> Solo se requiere acceso de lectura. CloudHub nunca modifica tu infraestructura.
                      </p>
                    </div>
                  </AlertDescription>
                </Alert>

                {error && (
                  <Alert className="border-destructive/50">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription className="text-destructive">
                      <div className="font-medium mb-1">
                        {error.type === 'validation' && 'Validation Error'}
                        {error.type === 'api' && 'AWS Connection Error'}
                        {error.type === 'network' && 'Network Error'}
                        {error.type === 'unknown' && 'Connection Error'}
                      </div>
                      {error.message}
                      {error.code && (
                        <div className="text-xs mt-1 opacity-75">
                          Error Code: {error.code}
                        </div>
                      )}
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
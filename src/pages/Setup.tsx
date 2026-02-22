import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { 
  Cloud, 
  User, 
  Building, 
  Globe, 
  Folder, 
  Bell,
  Shield,
  ArrowRight,
  CheckCircle,
  Loader2
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

const AWS_REGIONS = [
  { value: 'us-east-1', label: 'US East (N. Virginia)' },
  { value: 'us-east-2', label: 'US East (Ohio)' },
  { value: 'us-west-1', label: 'US West (N. California)' },
  { value: 'us-west-2', label: 'US West (Oregon)' },
  { value: 'eu-west-1', label: 'Europe (Ireland)' },
  { value: 'eu-west-2', label: 'Europe (London)' },
  { value: 'eu-central-1', label: 'Europe (Frankfurt)' },
  { value: 'ap-southeast-1', label: 'Asia Pacific (Singapore)' },
  { value: 'ap-southeast-2', label: 'Asia Pacific (Sydney)' },
  { value: 'ap-northeast-1', label: 'Asia Pacific (Tokyo)' },
];

const Setup = () => {
  const [currentStep, setCurrentStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    displayName: '',
    company: '',
    awsRegion: 'us-east-1',
    projects: '',
    cpuThreshold: '80',
    memoryThreshold: '85',
    diskThreshold: '90',
    networkThreshold: '1000'
  });

  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) {
      navigate('/auth');
    }
  }, [user, navigate]);

  const totalSteps = 3;
  const progress = (currentStep / totalSteps) * 100;

  const handleNext = async () => {
    if (currentStep < totalSteps) {
      setCurrentStep(currentStep + 1);
    } else {
      await handleComplete();
    }
  };

  const handleComplete = async () => {
    if (!user) return;
    
    setIsLoading(true);
    setError(null);

    try {
      // Update profile
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          display_name: formData.displayName,
          company: formData.company,
          aws_default_region: formData.awsRegion,
        })
        .eq('user_id', user.id);

      if (profileError) throw profileError;

      // Update setup completion status
      const { error: setupError } = await supabase
        .from('user_setup')
        .update({
          profile_completed: true,
          initial_configuration_completed: true,
        })
        .eq('user_id', user.id);

      if (setupError) throw setupError;

      if (setupError) throw setupError;

      navigate('/dashboard');
    } catch (error: any) {
      setError(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <Card>
            <CardHeader>
              <div className="w-12 h-12 bg-gradient-to-br from-primary to-primary-glow rounded-lg flex items-center justify-center mx-auto mb-4">
                <User className="h-6 w-6 text-white" />
              </div>
              <CardTitle>Personal Information</CardTitle>
              <CardDescription>
                Let's start by setting up your profile information.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="displayName">Display Name</Label>
                <Input
                  id="displayName"
                  placeholder="Your Name"
                  value={formData.displayName}
                  onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="company">Company (Optional)</Label>
                <Input
                  id="company"
                  placeholder="Your Company"
                  value={formData.company}
                  onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                />
              </div>
            </CardContent>
          </Card>
        );

      case 2:
        return (
          <Card>
            <CardHeader>
              <div className="w-12 h-12 bg-gradient-to-br from-cloud-cyan to-cloud-blue rounded-lg flex items-center justify-center mx-auto mb-4">
                <Globe className="h-6 w-6 text-white" />
              </div>
              <CardTitle>AWS Configuration</CardTitle>
              <CardDescription>
                Configure your default AWS settings and project structure.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="awsRegion">Default AWS Region</Label>
                <Select value={formData.awsRegion} onValueChange={(value) => setFormData({ ...formData, awsRegion: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {AWS_REGIONS.map((region) => (
                      <SelectItem key={region.value} value={region.value}>
                        {region.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="projects">Projects/Environments</Label>
                <Textarea
                  id="projects"
                  placeholder="dev, staging, production (comma separated)"
                  value={formData.projects}
                  onChange={(e) => setFormData({ ...formData, projects: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  List your project names or environments separated by commas
                </p>
              </div>
            </CardContent>
          </Card>
        );

      case 3:
        return (
          <Card>
            <CardHeader>
              <div className="w-12 h-12 bg-gradient-to-br from-warning to-aws-orange rounded-lg flex items-center justify-center mx-auto mb-4">
                <Bell className="h-6 w-6 text-white" />
              </div>
              <CardTitle>Alert Thresholds</CardTitle>
              <CardDescription>
                Set up your monitoring thresholds for automatic alerts.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="cpuThreshold">CPU Threshold (%)</Label>
                  <Input
                    id="cpuThreshold"
                    type="number"
                    min="0"
                    max="100"
                    value={formData.cpuThreshold}
                    onChange={(e) => setFormData({ ...formData, cpuThreshold: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="memoryThreshold">Memory Threshold (%)</Label>
                  <Input
                    id="memoryThreshold"
                    type="number"
                    min="0"
                    max="100"
                    value={formData.memoryThreshold}
                    onChange={(e) => setFormData({ ...formData, memoryThreshold: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="diskThreshold">Disk Threshold (%)</Label>
                  <Input
                    id="diskThreshold"
                    type="number"
                    min="0"
                    max="100"
                    value={formData.diskThreshold}
                    onChange={(e) => setFormData({ ...formData, diskThreshold: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="networkThreshold">Network I/O (Mbps)</Label>
                  <Input
                    id="networkThreshold"
                    type="number"
                    min="0"
                    value={formData.networkThreshold}
                    onChange={(e) => setFormData({ ...formData, networkThreshold: e.target.value })}
                  />
                </div>
              </div>
              <Alert>
                <Shield className="h-4 w-4" />
                <AlertDescription>
                  These thresholds will trigger alerts when your AWS resources exceed these limits.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/50 bg-background/95 backdrop-blur">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-primary to-primary-glow rounded-lg flex items-center justify-center">
              <Cloud className="h-5 w-5 text-white" />
            </div>
            <h1 className="text-xl font-bold text-foreground">Clodaro Setup</h1>
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
                Step {currentStep} of {totalSteps}
              </span>
              <span className="text-sm text-muted-foreground">
                {Math.round(progress)}% Complete
              </span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>

          {/* Step Indicators */}
          <div className="flex items-center justify-center mb-8">
            <div className="flex items-center space-x-4">
              {[1, 2, 3].map((step) => (
                <div key={step} className="flex items-center">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                      step <= currentStep
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {step < currentStep ? (
                      <CheckCircle className="h-4 w-4" />
                    ) : (
                      step
                    )}
                  </div>
                  {step < 3 && (
                    <div
                      className={`w-12 h-0.5 mx-2 ${
                        step < currentStep ? 'bg-primary' : 'bg-muted'
                      }`}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Current Step */}
          {renderStep()}

          {/* Error */}
          {error && (
            <Alert className="mt-4 border-destructive/50">
              <AlertDescription className="text-destructive">
                {error}
              </AlertDescription>
            </Alert>
          )}

          {/* Navigation */}
          <div className="flex items-center justify-between mt-8">
            <Button
              variant="outline"
              onClick={() => setCurrentStep(Math.max(1, currentStep - 1))}
              disabled={currentStep === 1}
            >
              Previous
            </Button>
            <Button onClick={handleNext} disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Setting up...
                </>
              ) : currentStep === totalSteps ? (
                'Complete Setup'
              ) : (
                <>
                  Next
                  <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Setup;
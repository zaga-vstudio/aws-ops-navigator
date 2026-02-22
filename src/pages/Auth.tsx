import { useState, useEffect } from "react";
import { checkLeakedPassword } from "@/lib/checkLeakedPassword";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Cloud, Loader2, ArrowLeft } from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { MFAVerificationDialog } from "@/components/MFAVerificationDialog";

const Auth = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [showMFAVerification, setShowMFAVerification] = useState(false);
  const [searchParams] = useSearchParams();
  
  const { signIn, signUp, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // Check if this is a password reset callback
    const type = searchParams.get('type');
    if (type === 'recovery') {
      setShowResetPassword(true);
    }
  }, [searchParams]);

  useEffect(() => {
    if (user && !showResetPassword) {
      // Check if user has completed AWS setup
      const checkAWSSetup = async () => {
        const { data: setupData } = await supabase.from('user_setup')
          .select('aws_setup_completed')
          .eq('user_id', user.id)
          .maybeSingle();
        
        if (setupData?.aws_setup_completed) {
          navigate('/dashboard');
        } else {
          navigate('/aws-setup');
        }
      };
      
      checkAWSSetup();
    }
  }, [user, navigate, showResetPassword]);

  const checkMFARequired = async (): Promise<boolean> => {
    const { data: { totp } } = await supabase.auth.mfa.listFactors();
    const verifiedFactors = totp?.filter(f => f.status === 'verified') || [];
    
    if (verifiedFactors.length > 0) {
      // Check the current AAL level
      const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      // If current level is aal1 but next level should be aal2, MFA is required
      return aalData?.currentLevel === 'aal1' && aalData?.nextLevel === 'aal2';
    }
    return false;
  };

  const handleSignIn = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    
    const formData = new FormData(e.currentTarget);
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;

    const { error } = await signIn(email, password);
    
    if (error) {
      setError(error.message);
      setIsLoading(false);
      return;
    }

    // Check if MFA is required for this user
    const mfaRequired = await checkMFARequired();
    if (mfaRequired) {
      setShowMFAVerification(true);
    }
    
    setIsLoading(false);
  };

  const handleMFASuccess = async () => {
    setShowMFAVerification(false);
    // Navigate after successful MFA
    const { data: setupData } = await supabase.from('user_setup')
      .select('aws_setup_completed')
      .eq('user_id', user?.id)
      .maybeSingle();
    
    if (setupData?.aws_setup_completed) {
      navigate('/dashboard');
    } else {
      navigate('/aws-setup');
    }
  };

  const handleMFACancel = () => {
    setShowMFAVerification(false);
    setError("Two-factor authentication is required for your account.");
  };

  const handleSignUp = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setSuccess(null);
    
    const formData = new FormData(e.currentTarget);
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;
    const displayName = formData.get('displayName') as string;
    const confirmPassword = formData.get('confirmPassword') as string;

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      setIsLoading(false);
      return;
    }

    // Check for leaked passwords
    const { leaked, count } = await checkLeakedPassword(password);
    if (leaked) {
      setError(`This password has appeared in ${count.toLocaleString()} data breaches. Please choose a different password.`);
      setIsLoading(false);
      return;
    }

    const { error } = await signUp(email, password, displayName);
    
    if (error) {
      setError(error.message);
    } else {
      setSuccess('Account created successfully! Please check your email to verify your account.');
    }
    
    setIsLoading(false);
  };

  const handleForgotPassword = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setSuccess(null);
    
    const formData = new FormData(e.currentTarget);
    const email = formData.get('email') as string;

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth?type=recovery`,
    });
    
    if (error) {
      setError(error.message);
    } else {
      setSuccess('Password reset email sent! Check your inbox for the reset link.');
    }
    
    setIsLoading(false);
  };

  const handleResetPassword = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setSuccess(null);
    
    const formData = new FormData(e.currentTarget);
    const password = formData.get('password') as string;
    const confirmPassword = formData.get('confirmPassword') as string;

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      setIsLoading(false);
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      setIsLoading(false);
      return;
    }

    const { leaked, count } = await checkLeakedPassword(password);
    if (leaked) {
      setError(`This password has appeared in ${count.toLocaleString()} data breaches. Please choose a different password.`);
      setIsLoading(false);
      return;
    }

    const { error } = await supabase.auth.updateUser({ password });
    
    if (error) {
      setError(error.message);
    } else {
      setSuccess('Password updated successfully! You can now sign in with your new password.');
      setShowResetPassword(false);
      // Sign out to force re-login with new password
      await supabase.auth.signOut();
    }
    
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border/50 bg-background/95 backdrop-blur">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <Link to="/" className="flex items-center gap-3">
              <div className="w-8 h-8 bg-gradient-to-br from-primary to-primary-glow rounded-lg flex items-center justify-center">
                <Cloud className="h-5 w-5 text-white" />
              </div>
              <h1 className="text-xl font-bold text-foreground">CloudHub</h1>
            </Link>
            <Link to="/">
              <Button variant="ghost">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Home
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Auth Form */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <Card className="border-border/50">
            <CardHeader className="text-center">
              <div className="w-12 h-12 bg-gradient-to-br from-primary to-primary-glow rounded-lg flex items-center justify-center mx-auto mb-4">
                <Cloud className="h-7 w-7 text-white" />
              </div>
              <CardTitle className="text-2xl">Welcome to CloudHub</CardTitle>
              <CardDescription>
                Sign in to your account or create a new one to get started with AWS management.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {showResetPassword ? (
                <div className="space-y-4">
                  <form onSubmit={handleResetPassword} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="new-password">New Password</Label>
                      <Input
                        id="new-password"
                        name="password"
                        type="password"
                        placeholder="Enter new password"
                        required
                        minLength={6}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="confirm-new-password">Confirm New Password</Label>
                      <Input
                        id="confirm-new-password"
                        name="confirmPassword"
                        type="password"
                        placeholder="Confirm new password"
                        required
                      />
                    </div>
                    <Button type="submit" className="w-full" disabled={isLoading}>
                      {isLoading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Updating password...
                        </>
                      ) : (
                        'Update Password'
                      )}
                    </Button>
                  </form>
                  <Button 
                    variant="ghost" 
                    className="w-full" 
                    onClick={() => setShowResetPassword(false)}
                  >
                    Back to Sign In
                  </Button>
                </div>
              ) : showForgotPassword ? (
                <div className="space-y-4">
                  <form onSubmit={handleForgotPassword} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="forgot-email">Email</Label>
                      <Input
                        id="forgot-email"
                        name="email"
                        type="email"
                        placeholder="your@email.com"
                        required
                      />
                    </div>
                    <Button type="submit" className="w-full" disabled={isLoading}>
                      {isLoading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Sending reset email...
                        </>
                      ) : (
                        'Send Reset Link'
                      )}
                    </Button>
                  </form>
                  <Button 
                    variant="ghost" 
                    className="w-full" 
                    onClick={() => setShowForgotPassword(false)}
                  >
                    Back to Sign In
                  </Button>
                </div>
              ) : (
                <Tabs defaultValue="signin" className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="signin">Sign In</TabsTrigger>
                    <TabsTrigger value="signup">Sign Up</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="signin" className="space-y-4 mt-6">
                    <form onSubmit={handleSignIn} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="signin-email">Email</Label>
                        <Input
                          id="signin-email"
                          name="email"
                          type="email"
                          placeholder="your@email.com"
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label htmlFor="signin-password">Password</Label>
                          <Button 
                            variant="link" 
                            className="px-0 h-auto font-normal text-sm text-muted-foreground hover:text-primary"
                            type="button"
                            onClick={() => setShowForgotPassword(true)}
                          >
                            Forgot password?
                          </Button>
                        </div>
                        <Input
                          id="signin-password"
                          name="password"
                          type="password"
                          placeholder="Enter your password"
                          required
                        />
                      </div>
                      <Button type="submit" className="w-full" disabled={isLoading}>
                        {isLoading ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Signing in...
                          </>
                        ) : (
                          'Sign In'
                        )}
                      </Button>
                    </form>
                  </TabsContent>
                  
                  <TabsContent value="signup" className="space-y-4 mt-6">
                    <form onSubmit={handleSignUp} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="signup-name">Display Name</Label>
                        <Input
                          id="signup-name"
                          name="displayName"
                          type="text"
                          placeholder="Your Name"
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="signup-email">Email</Label>
                        <Input
                          id="signup-email"
                          name="email"
                          type="email"
                          placeholder="your@email.com"
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="signup-password">Password</Label>
                        <Input
                          id="signup-password"
                          name="password"
                          type="password"
                          placeholder="Create a password"
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="confirm-password">Confirm Password</Label>
                        <Input
                          id="confirm-password"
                          name="confirmPassword"
                          type="password"
                          placeholder="Confirm your password"
                          required
                        />
                      </div>
                      <Button type="submit" className="w-full" disabled={isLoading}>
                        {isLoading ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Creating account...
                          </>
                        ) : (
                          'Create Account'
                        )}
                      </Button>
                    </form>
                  </TabsContent>
                </Tabs>
              )}

              {error && (
                <Alert className="mt-4 border-destructive/50">
                  <AlertDescription className="text-destructive">
                    {error}
                  </AlertDescription>
                </Alert>
              )}

              {success && (
                <Alert className="mt-4 border-success/50">
                  <AlertDescription className="text-success">
                    {success}
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </div>

        <MFAVerificationDialog
          open={showMFAVerification}
          onOpenChange={setShowMFAVerification}
          onSuccess={handleMFASuccess}
          onCancel={handleMFACancel}
        />
      </div>
    </div>
  );
};

export default Auth;
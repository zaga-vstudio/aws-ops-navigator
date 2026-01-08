import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Shield, Loader2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface MFAVerificationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  onCancel: () => void;
}

export function MFAVerificationDialog({ open, onOpenChange, onSuccess, onCancel }: MFAVerificationDialogProps) {
  const [loading, setLoading] = useState(false);
  const [verifyCode, setVerifyCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  const verifyMFA = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const factors = await supabase.auth.mfa.listFactors();
      if (factors.error) throw factors.error;

      const totpFactor = factors.data.totp.find(f => f.status === 'verified');
      
      if (!totpFactor) {
        throw new Error("No verified TOTP factor found");
      }

      // Create a challenge
      const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId: totpFactor.id
      });

      if (challengeError) throw challengeError;

      // Verify the challenge
      const { data, error } = await supabase.auth.mfa.verify({
        factorId: totpFactor.id,
        challengeId: challengeData.id,
        code: verifyCode
      });

      if (error) throw error;

      toast.success("Two-factor authentication verified");
      setVerifyCode("");
      onSuccess();
    } catch (error: any) {
      setError(error.message || "Invalid verification code");
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    // Sign out the user if they cancel MFA verification
    await supabase.auth.signOut();
    setVerifyCode("");
    setError(null);
    onCancel();
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen) handleCancel();
    }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Two-Factor Authentication
          </DialogTitle>
          <DialogDescription>
            Enter the verification code from your authenticator app to continue.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={verifyMFA} className="space-y-4">
          <Alert>
            <AlertDescription>
              Open your authenticator app (Google Authenticator, Authy, etc.) and enter the 6-digit code.
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <Label htmlFor="mfa-code">Verification Code</Label>
            <Input
              id="mfa-code"
              placeholder="Enter 6-digit code"
              value={verifyCode}
              onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              maxLength={6}
              className="text-center text-2xl tracking-widest font-mono"
              autoComplete="one-time-code"
              autoFocus
              required
            />
          </div>

          {error && (
            <Alert className="border-destructive/50">
              <AlertDescription className="text-destructive">
                {error}
              </AlertDescription>
            </Alert>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleCancel}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || verifyCode.length !== 6}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Verifying...
                </>
              ) : (
                "Verify"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

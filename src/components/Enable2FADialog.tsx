import { useState, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Shield, Copy, Check, RefreshCw, Loader2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface Enable2FADialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

const convertSvgToPng = (svgInput: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    // Normalize: if raw SVG XML, convert to a data URI first
    let dataUri = svgInput;
    if (svgInput.trimStart().startsWith("<?xml") || svgInput.trimStart().startsWith("<svg")) {
      dataUri = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svgInput);
    }

    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = 300;
      canvas.height = 300;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Canvas context not available"));
        return;
      }
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, 300, 300);
      ctx.drawImage(img, 0, 0, 300, 300);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = () => reject(new Error("Failed to load QR code image"));
    img.src = dataUri;
  });
};

const formatSecret = (secret: string): string => {
  return secret.replace(/(.{4})/g, "$1 ").trim();
};

export function Enable2FADialog({ open, onOpenChange, onSuccess }: Enable2FADialogProps) {
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<"enroll" | "verify" | "error">("enroll");
  const [qrCode, setQrCode] = useState<string>("");
  const [secret, setSecret] = useState<string>("");
  const [verifyCode, setVerifyCode] = useState("");
  const [copied, setCopied] = useState(false);
  const [factorId, setFactorId] = useState<string>("");
  const [enrollError, setEnrollError] = useState<string>("");
  const [rawSvgFallback, setRawSvgFallback] = useState<string>("");

  const resetState = useCallback(() => {
    setStep("enroll");
    setQrCode("");
    setSecret("");
    setVerifyCode("");
    setCopied(false);
    setEnrollError("");
    setRawSvgFallback("");
    setFactorId("");
    setLoading(false);
  }, []);

  const enrollMFA = useCallback(async () => {
    setLoading(true);
    setEnrollError("");
    try {
      // Clean up any stale unverified factors
      const { data: factors, error: listError } = await supabase.auth.mfa.listFactors();
      if (listError) throw listError;

      for (const factor of factors.totp) {
        if (factor.status === "unverified") {
          try {
            await supabase.auth.mfa.unenroll({ factorId: factor.id });
          } catch {
            // Ignore unenroll errors for stale factors
          }
        }
      }

      // Enroll new factor with unique friendly name to avoid conflicts
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        issuer: "Clodaro",
        friendlyName: `Clodaro-${Date.now()}`,
      });

      if (error) throw error;

      // Always attempt PNG conversion for universal compatibility
      const rawQr = data.totp.qr_code;
      let qrUri: string;
      try {
        qrUri = await convertSvgToPng(rawQr);
      } catch {
        // If conversion fails, store raw SVG for inline fallback
        qrUri = "";
        if (rawQr.trimStart().startsWith("<?xml") || rawQr.trimStart().startsWith("<svg")) {
          setRawSvgFallback(rawQr);
        }
      }

      setQrCode(qrUri);
      setSecret(data.totp.secret);
      setFactorId(data.id);
      setStep("verify");
    } catch (error: any) {
      setEnrollError(error.message || "Failed to setup 2FA. Please try again.");
      setStep("error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      resetState();
      // Small delay to ensure state is reset before enrolling
      const timer = setTimeout(() => enrollMFA(), 50);
      return () => clearTimeout(timer);
    }
  }, [open, resetState, enrollMFA]);

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      resetState();
    }
    onOpenChange(isOpen);
  };

  const verifyMFA = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (!factorId) {
        throw new Error("No TOTP factor found. Please try again.");
      }

      const { data, error } = await supabase.auth.mfa.challengeAndVerify({
        factorId: factorId,
        code: verifyCode,
      });

      if (error) throw error;

      toast.success("Two-factor authentication enabled successfully");
      onSuccess();
      handleOpenChange(false);
    } catch (error: any) {
      toast.error(error.message || "Invalid verification code");
    } finally {
      setLoading(false);
    }
  };

  const copySecret = () => {
    navigator.clipboard.writeText(secret);
    setCopied(true);
    toast.success("Secret copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Enable Two-Factor Authentication
          </DialogTitle>
          <DialogDescription>
            Add an extra layer of security to your account
          </DialogDescription>
        </DialogHeader>

        {step === "enroll" && (
          <div className="flex flex-col items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="mt-3 text-sm text-muted-foreground">Setting up 2FA...</p>
          </div>
        )}

        {step === "error" && (
          <div className="space-y-4">
            <Alert className="border-destructive/50">
              <AlertDescription className="text-destructive">
                {enrollError}
              </AlertDescription>
            </Alert>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
                Cancel
              </Button>
              <Button type="button" onClick={enrollMFA} disabled={loading}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Retry
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === "verify" && (
          <form onSubmit={verifyMFA} className="space-y-4">
            <Alert>
              <AlertDescription>
                Scan the QR code below with your authenticator app (Google Authenticator, Authy, etc.)
              </AlertDescription>
            </Alert>

            <div className="flex flex-col items-center space-y-4">
              {qrCode ? (
                <img
                  src={qrCode}
                  alt="QR Code"
                  className="w-48 h-48 border border-border rounded-lg bg-white p-1"
                />
              ) : null}

              <div className="w-full space-y-2">
                <Label>Or enter this code manually in your app:</Label>
                <p className="text-xs text-muted-foreground">Issuer: <span className="font-medium">Clodaro</span></p>
                <div className="flex gap-2">
                  <Input
                    value={formatSecret(secret)}
                    readOnly
                    className="font-mono text-sm tracking-wider"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={copySecret}
                  >
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="verifyCode">Verification Code</Label>
              <Input
                id="verifyCode"
                placeholder="Enter 6-digit code"
                value={verifyCode}
                onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                maxLength={6}
                className="text-center text-lg tracking-widest font-mono"
                autoComplete="one-time-code"
                autoFocus
                required
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={loading || verifyCode.length !== 6}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  "Verify & Enable"
                )}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Mail,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Send,
  ChevronDown,
  ExternalLink,
  Loader2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface SESStatus {
  sandboxMode: boolean;
  verifiedIdentities: { identity: string; status: string }[];
  sendingLimits: { max24HourSend: number; maxSendRate: number; sentLast24Hours: number };
  currentSenderEmail: string | null;
}

export function SESSetupCard() {
  const [status, setStatus] = useState<SESStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [senderEmail, setSenderEmail] = useState("");
  const [savingSender, setSavingSender] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  const [testResult, setTestResult] = useState<"success" | "error" | null>(null);
  const [guideOpen, setGuideOpen] = useState(false);

  const fetchStatus = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Please log in first");
        return;
      }

      const { data, error } = await supabase.functions.invoke("ses-status", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setStatus(data);
      setSenderEmail(data.currentSenderEmail || "");
    } catch (err: any) {
      toast.error(err.message || "Failed to fetch SES status");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const saveSenderEmail = async () => {
    setSavingSender(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not logged in");

      const { error } = await supabase
        .from("notification_preferences")
        .update({ ses_sender_email: senderEmail || null } as any)
        .eq("user_id", user.id);

      if (error) throw error;
      toast.success("Sender email saved");
    } catch (err: any) {
      toast.error(err.message || "Failed to save sender email");
    } finally {
      setSavingSender(false);
    }
  };

  const sendTestEmail = async () => {
    setSendingTest(true);
    setTestResult(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.email) throw new Error("No user email found");

      const { data, error } = await supabase.functions.invoke("send-ses-email", {
        body: {
          to: session.user.email,
          subject: "Clodaro SES Test Email",
          htmlBody: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <h1 style="color: #10b981;">✅ SES Email Test Successful</h1>
              <p>This test email confirms that your Amazon SES configuration in Clodaro is working correctly.</p>
              <p style="color: #6b7280; font-size: 14px;">Sent at: ${new Date().toISOString()}</p>
            </div>
          `,
          textBody: "SES Email Test Successful. Your Amazon SES configuration in Clodaro is working correctly.",
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setTestResult("success");
      toast.success("Test email sent! Check your inbox.");
    } catch (err: any) {
      setTestResult("error");
      toast.error(err.message || "Failed to send test email");
    } finally {
      setSendingTest(false);
    }
  };

  const verifiedEmails = status?.verifiedIdentities?.filter(i => i.status === "Success") ?? [];
  const isReady = status && !status.sandboxMode && senderEmail && testResult === "success";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="h-5 w-5" />
          Email Notifications (SES)
          {status && (
            <Badge variant={isReady ? "default" : "secondary"} className="ml-auto">
              {isReady ? "Ready" : "Setup Required"}
            </Badge>
          )}
        </CardTitle>
        <CardDescription>
          Configure Amazon SES to send alert emails from Clodaro
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Step 1: SES Status */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-medium">1. SES Account Status</h4>
            <Button variant="outline" size="sm" onClick={fetchStatus} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} />
              Check Status
            </Button>
          </div>

          {loading && !status && (
            <div className="flex items-center gap-2 text-muted-foreground text-sm p-4 border rounded-lg">
              <Loader2 className="h-4 w-4 animate-spin" />
              Checking SES configuration...
            </div>
          )}

          {status && (
            <div className="space-y-3 p-4 border rounded-lg">
              <div className="flex items-center gap-2">
                {status.sandboxMode ? (
                  <AlertTriangle className="h-4 w-4 text-warning" />
                ) : (
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                )}
                <span className="text-sm font-medium">
                  {status.sandboxMode ? "Sandbox Mode" : "Production Mode"}
                </span>
                {status.sandboxMode && (
                  <span className="text-xs text-muted-foreground">
                    (can only send to verified emails)
                  </span>
                )}
              </div>

              <div className="grid grid-cols-3 gap-3 text-sm">
                <div className="p-2 bg-muted rounded">
                  <p className="text-muted-foreground text-xs">24h Limit</p>
                  <p className="font-medium">{status.sendingLimits.max24HourSend}</p>
                </div>
                <div className="p-2 bg-muted rounded">
                  <p className="text-muted-foreground text-xs">Send Rate</p>
                  <p className="font-medium">{status.sendingLimits.maxSendRate}/sec</p>
                </div>
                <div className="p-2 bg-muted rounded">
                  <p className="text-muted-foreground text-xs">Sent (24h)</p>
                  <p className="font-medium">{status.sendingLimits.sentLast24Hours}</p>
                </div>
              </div>

              {status.verifiedIdentities.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">Verified Identities</p>
                  <div className="flex flex-wrap gap-1.5">
                    {status.verifiedIdentities.map((id) => (
                      <Badge
                        key={id.identity}
                        variant={id.status === "Success" ? "default" : "secondary"}
                        className="text-xs"
                      >
                        {id.status === "Success" ? (
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                        ) : (
                          <XCircle className="h-3 w-3 mr-1" />
                        )}
                        {id.identity}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {status.verifiedIdentities.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No verified identities found. Verify an email or domain in the AWS SES console.
                </p>
              )}
            </div>
          )}
        </div>

        <Separator />

        {/* Step 2: Set Sender Email */}
        <div className="space-y-3">
          <h4 className="font-medium">2. Sender Email</h4>
          <p className="text-sm text-muted-foreground">
            Choose a verified email address to send notifications from.
          </p>
          <div className="flex gap-2">
            {verifiedEmails.length > 0 ? (
              <Select value={senderEmail} onValueChange={setSenderEmail}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Select a verified email..." />
                </SelectTrigger>
                <SelectContent>
                  {verifiedEmails.map((id) => (
                    <SelectItem key={id.identity} value={id.identity}>
                      {id.identity}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                value={senderEmail}
                onChange={(e) => setSenderEmail(e.target.value)}
                placeholder="noreply@yourdomain.com"
                className="flex-1"
              />
            )}
            <Button onClick={saveSenderEmail} disabled={savingSender || !senderEmail} variant="outline">
              {savingSender ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
            </Button>
          </div>
        </div>

        <Separator />

        {/* Step 3: Test Email */}
        <div className="space-y-3">
          <h4 className="font-medium">3. Send Test Email</h4>
          <p className="text-sm text-muted-foreground">
            Send a test email to your account address to verify the full pipeline works.
          </p>
          <div className="flex items-center gap-3">
            <Button onClick={sendTestEmail} disabled={sendingTest || !senderEmail} variant="outline">
              {sendingTest ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Send className="h-4 w-4 mr-1" />
              )}
              Send Test
            </Button>
            {testResult === "success" && (
              <span className="flex items-center gap-1 text-sm text-primary">
                <CheckCircle2 className="h-4 w-4" /> Sent successfully
              </span>
            )}
            {testResult === "error" && (
              <span className="flex items-center gap-1 text-sm text-destructive">
                <XCircle className="h-4 w-4" /> Failed — check logs
              </span>
            )}
          </div>
        </div>

        <Separator />

        {/* Setup Guide */}
        <Collapsible open={guideOpen} onOpenChange={setGuideOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-full justify-between px-0">
              <span className="text-sm font-medium">SES Setup Guide</span>
              <ChevronDown className={`h-4 w-4 transition-transform ${guideOpen ? "rotate-180" : ""}`} />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-3 pt-2">
            <div className="space-y-2 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">Quick Setup Steps:</p>
              <ol className="list-decimal list-inside space-y-1.5">
                <li>Verify a domain or email in the AWS SES console</li>
                <li>Ensure your IAM user has <code className="text-xs bg-muted px-1 rounded">ses:SendEmail</code> and <code className="text-xs bg-muted px-1 rounded">ses:SendRawEmail</code> permissions</li>
                <li>Request production access if you need to send to unverified recipients</li>
                <li>Set your verified sender email above and send a test</li>
              </ol>
            </div>
            <div className="flex flex-wrap gap-2">
              <a
                href="https://console.aws.amazon.com/ses/home#/verified-identities"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button variant="outline" size="sm">
                  <ExternalLink className="h-3 w-3 mr-1" />
                  Verified Identities
                </Button>
              </a>
              <a
                href="https://console.aws.amazon.com/ses/home#/account"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button variant="outline" size="sm">
                  <ExternalLink className="h-3 w-3 mr-1" />
                  SES Account Dashboard
                </Button>
              </a>
              <a
                href="https://console.aws.amazon.com/support/home#/case/create?issueType=service-limit-increase&limitType=service-code-ses"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button variant="outline" size="sm">
                  <ExternalLink className="h-3 w-3 mr-1" />
                  Request Production Access
                </Button>
              </a>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
}

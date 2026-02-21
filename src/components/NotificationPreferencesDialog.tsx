import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

interface NotificationPreferencesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NotificationPreferencesDialog({
  open,
  onOpenChange,
}: NotificationPreferencesDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [slackWebhook, setSlackWebhook] = useState('');
  const [discordWebhook, setDiscordWebhook] = useState('');
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [notifyApproval, setNotifyApproval] = useState(true);
  const [notifyCompliance, setNotifyCompliance] = useState(true);
  const [notifySecurity, setNotifySecurity] = useState(true);

  useEffect(() => {
    if (open) {
      fetchPreferences();
    }
  }, [open]);

  const fetchPreferences = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('notification_preferences')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (data) {
        // Webhook values are now encrypted server-side; show masked state
        setWebhookUrl(data.encrypted_webhook_url ? '••••••••' : '');
        setSlackWebhook(data.encrypted_slack_webhook ? '••••••••' : '');
        setDiscordWebhook(data.encrypted_discord_webhook ? '••••••••' : '');
        setEmailEnabled(data.email_enabled ?? true);
        setNotifyApproval(data.notify_on_approval_needed ?? true);
        setNotifyCompliance(data.notify_on_compliance_issue ?? true);
        setNotifySecurity(data.notify_on_security_alert ?? true);
      }
    } catch (error: any) {
      console.error('Error fetching preferences:', error);
    } finally {
      setFetching(false);
    }
  };

  const handleSave = async () => {
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No user found');

      const { error } = await supabase
        .from('notification_preferences')
        .upsert({
          user_id: user.id,
          email_enabled: emailEnabled,
          notify_on_approval_needed: notifyApproval,
          notify_on_compliance_issue: notifyCompliance,
          notify_on_security_alert: notifySecurity,
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Notification preferences saved successfully",
      });

      onOpenChange(false);
    } catch (error: any) {
      console.error('Error saving preferences:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to save preferences",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Notification Preferences</DialogTitle>
          <DialogDescription>
            Configure how you want to receive security and compliance notifications
          </DialogDescription>
        </DialogHeader>

        {fetching ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : (
          <div className="space-y-6">
            <div className="space-y-4">
              <h4 className="font-medium">Webhook Integrations</h4>
              
              <div className="space-y-2">
                <Label htmlFor="webhookUrl">Generic Webhook URL</Label>
                <Input
                  id="webhookUrl"
                  placeholder="https://your-webhook-url.com/endpoint"
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                />
                <p className="text-sm text-muted-foreground">
                  POST requests will be sent to this URL for security events
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="slackWebhook">Slack Webhook URL</Label>
                <Input
                  id="slackWebhook"
                  placeholder="https://hooks.slack.com/services/..."
                  value={slackWebhook}
                  onChange={(e) => setSlackWebhook(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="discordWebhook">Discord Webhook URL</Label>
                <Input
                  id="discordWebhook"
                  placeholder="https://discord.com/api/webhooks/..."
                  value={discordWebhook}
                  onChange={(e) => setDiscordWebhook(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="font-medium">Notification Settings</h4>
              
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Email Notifications</Label>
                  <p className="text-sm text-muted-foreground">
                    Receive notifications via email
                  </p>
                </div>
                <Switch
                  checked={emailEnabled}
                  onCheckedChange={setEmailEnabled}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Approval Requests</Label>
                  <p className="text-sm text-muted-foreground">
                    Notify when approval is needed for security changes
                  </p>
                </div>
                <Switch
                  checked={notifyApproval}
                  onCheckedChange={setNotifyApproval}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Compliance Issues</Label>
                  <p className="text-sm text-muted-foreground">
                    Notify about new compliance violations
                  </p>
                </div>
                <Switch
                  checked={notifyCompliance}
                  onCheckedChange={setNotifyCompliance}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Security Alerts</Label>
                  <p className="text-sm text-muted-foreground">
                    Notify about security threats and vulnerabilities
                  </p>
                </div>
                <Switch
                  checked={notifySecurity}
                  onCheckedChange={setNotifySecurity}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Preferences
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

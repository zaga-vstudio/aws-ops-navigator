import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Loader2, Mail, Smartphone, Volume2, Settings, MessageSquare } from "lucide-react";

interface NotificationChannelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  channel: {
    id: string;
    type: string;
    name: string;
    enabled: boolean;
    config: string;
  } | null;
  onSave: (channelType: string, config: { enabled: boolean; value: string }) => Promise<boolean>;
  loading?: boolean;
}

export function NotificationChannelDialog({ 
  open, 
  onOpenChange, 
  channel, 
  onSave,
  loading 
}: NotificationChannelDialogProps) {
  const [enabled, setEnabled] = useState(false);
  const [configValue, setConfigValue] = useState("");

  useEffect(() => {
    if (channel) {
      setEnabled(channel.enabled);
      setConfigValue(channel.config);
    }
  }, [channel]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const success = await onSave(channel?.type || "", { enabled, value: configValue });
    if (success) {
      onOpenChange(false);
    }
  };

  const getChannelIcon = () => {
    switch (channel?.type) {
      case "email": return <Mail className="h-5 w-5" />;
      case "sms": return <Smartphone className="h-5 w-5" />;
      case "slack": return <Volume2 className="h-5 w-5" />;
      case "discord": return <MessageSquare className="h-5 w-5" />;
      case "webhook": return <Settings className="h-5 w-5" />;
      default: return <Settings className="h-5 w-5" />;
    }
  };

  const getConfigLabel = () => {
    switch (channel?.type) {
      case "email": return "Email Address";
      case "sms": return "Phone Number";
      case "slack": return "Slack Webhook URL";
      case "discord": return "Discord Webhook URL";
      case "webhook": return "Webhook URL";
      default: return "Configuration";
    }
  };

  const getConfigPlaceholder = () => {
    switch (channel?.type) {
      case "email": return "admin@company.com";
      case "sms": return "+1 (555) 123-4567";
      case "slack": return "https://hooks.slack.com/services/...";
      case "discord": return "https://discord.com/api/webhooks/...";
      case "webhook": return "https://api.company.com/alerts";
      default: return "Enter configuration";
    }
  };

  const getConfigHelp = () => {
    switch (channel?.type) {
      case "slack": return "Create an incoming webhook in your Slack workspace settings";
      case "discord": return "Create a webhook in your Discord server channel settings";
      case "webhook": return "Your endpoint will receive POST requests with alert data";
      default: return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {getChannelIcon()}
            Configure {channel?.name}
          </DialogTitle>
          <DialogDescription>
            Set up how you receive notifications through this channel.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Enable Channel</Label>
                <p className="text-sm text-muted-foreground">
                  Receive notifications through this channel
                </p>
              </div>
              <Switch 
                checked={enabled} 
                onCheckedChange={setEnabled}
                disabled={loading}
              />
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="config">{getConfigLabel()}</Label>
              <Input
                id="config"
                type={channel?.type === "email" ? "email" : "text"}
                placeholder={getConfigPlaceholder()}
                value={configValue}
                onChange={(e) => setConfigValue(e.target.value)}
                disabled={loading}
              />
              {getConfigHelp() && (
                <p className="text-xs text-muted-foreground">{getConfigHelp()}</p>
              )}
            </div>

            {channel?.type === "webhook" && (
              <div className="p-3 bg-muted rounded-lg text-sm">
                <p className="font-medium mb-1">Webhook Payload Format</p>
                <code className="text-xs block bg-background p-2 rounded">
                  {`{ "alert": "...", "severity": "...", "timestamp": "..." }`}
                </code>
              </div>
            )}
          </div>
          
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

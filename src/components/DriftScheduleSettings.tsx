import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Clock, Bell, Loader2, CheckCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

interface DriftScheduleSettings {
  drift_scan_enabled: boolean;
  drift_scan_frequency: 'daily' | 'weekly' | 'monthly';
  drift_scan_last_run: string | null;
  notify_on_drift: boolean;
}

export function DriftScheduleSettings() {
  const [settings, setSettings] = useState<DriftScheduleSettings>({
    drift_scan_enabled: false,
    drift_scan_frequency: 'daily',
    drift_scan_last_run: null,
    notify_on_drift: true,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('notification_preferences')
        .select('drift_scan_enabled, drift_scan_frequency, drift_scan_last_run, notify_on_drift')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setSettings({
          drift_scan_enabled: data.drift_scan_enabled ?? false,
          drift_scan_frequency: data.drift_scan_frequency ?? 'daily',
          drift_scan_last_run: data.drift_scan_last_run,
          notify_on_drift: data.notify_on_drift ?? true,
        });
      }
    } catch (error: any) {
      console.error('Error fetching drift settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async (newSettings: Partial<DriftScheduleSettings>) => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('notification_preferences')
        .update(newSettings)
        .eq('user_id', user.id);

      if (error) throw error;

      setSettings(prev => ({ ...prev, ...newSettings }));
      toast.success('Drift scan settings saved');
    } catch (error: any) {
      console.error('Error saving drift settings:', error);
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleEnabled = (enabled: boolean) => {
    saveSettings({ drift_scan_enabled: enabled });
  };

  const handleFrequencyChange = (frequency: string) => {
    saveSettings({ drift_scan_frequency: frequency as 'daily' | 'weekly' | 'monthly' });
  };

  const handleNotifyToggle = (notify: boolean) => {
    saveSettings({ notify_on_drift: notify });
  };

  const frequencyLabels: Record<string, string> = {
    'daily': 'Once a day',
    'weekly': 'Once a week',
    'monthly': 'Once a month',
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Scheduled Drift Scanning
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Scheduled Drift Scanning
        </CardTitle>
        <CardDescription>
          Automatically scan for configuration drift and get notified when changes are detected
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Enable/Disable */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="drift-scan-enabled" className="text-base font-medium">
              Enable Scheduled Scanning
            </Label>
            <p className="text-sm text-muted-foreground">
              Automatically scan your AWS resources for configuration drift
            </p>
          </div>
          <Switch
            id="drift-scan-enabled"
            checked={settings.drift_scan_enabled}
            onCheckedChange={handleToggleEnabled}
            disabled={saving}
          />
        </div>

        {settings.drift_scan_enabled && (
          <>
            {/* Frequency */}
            <div className="space-y-2">
              <Label htmlFor="scan-frequency" className="text-base font-medium">
                Scan Frequency
              </Label>
              <Select
                value={settings.drift_scan_frequency}
                onValueChange={handleFrequencyChange}
                disabled={saving}
              >
                <SelectTrigger id="scan-frequency" className="w-full max-w-xs">
                  <SelectValue placeholder="Select frequency" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Once a day</SelectItem>
                  <SelectItem value="weekly">Once a week</SelectItem>
                  <SelectItem value="monthly">Once a month</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground">
                How often Clodaro should check for configuration changes
              </p>
            </div>

            {/* Notifications */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="notify-drift" className="flex items-center gap-2 text-base font-medium">
                  <Bell className="h-4 w-4" />
                  Send Notifications
                </Label>
                <p className="text-sm text-muted-foreground">
                  Get notified via your configured channels when drift is detected
                </p>
              </div>
              <Switch
                id="notify-drift"
                checked={settings.notify_on_drift}
                onCheckedChange={handleNotifyToggle}
                disabled={saving}
              />
            </div>

            {/* Last Scan Info */}
            {settings.drift_scan_last_run && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 rounded-lg p-3">
                <CheckCircle className="h-4 w-4 text-success" />
                <span>
                  Last scheduled scan: {formatDistanceToNow(new Date(settings.drift_scan_last_run), { addSuffix: true })}
                </span>
              </div>
            )}

            {/* Next Scan Info */}
            <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
              <p className="text-sm">
                <strong>Note:</strong> Scheduled scans run automatically in the background. 
                Ensure your notification channels are configured in the Notifications tab to receive drift alerts.
              </p>
            </div>
          </>
        )}

        {saving && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Saving...
          </div>
        )}
      </CardContent>
    </Card>
  );
}
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface NotificationPreferences {
  id: string;
  user_id: string;
  email_enabled: boolean;
  notify_on_approval_needed: boolean;
  notify_on_compliance_issue: boolean;
  notify_on_security_alert: boolean;
  encrypted_webhook_url: string | null;
  encrypted_slack_webhook: string | null;
  encrypted_discord_webhook: string | null;
  webhook_nonce: string | null;
}

export interface NotificationChannel {
  id: string;
  type: 'email' | 'slack' | 'discord' | 'webhook';
  name: string;
  enabled: boolean;
  config: string;
}

export function useNotificationPreferences() {
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const fetchPreferences = useCallback(async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('notification_preferences')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setPreferences(data as NotificationPreferences);
      } else {
        // Create default preferences if none exist
        const { data: newPrefs, error: insertError } = await supabase
          .from('notification_preferences')
          .insert({
            user_id: user.id,
            email_enabled: true,
            notify_on_approval_needed: true,
            notify_on_compliance_issue: true,
            notify_on_security_alert: true,
          })
          .select()
          .single();

        if (insertError) throw insertError;
        setPreferences(newPrefs as NotificationPreferences);
      }
    } catch (error: any) {
      console.error('Error fetching notification preferences:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPreferences();
  }, [fetchPreferences]);

  const getChannels = (): NotificationChannel[] => {
    if (!preferences) {
      return [
        { id: "1", type: "email", name: "Email Notifications", enabled: false, config: "" },
        { id: "2", type: "slack", name: "Slack Channel", enabled: false, config: "" },
        { id: "3", type: "discord", name: "Discord Channel", enabled: false, config: "" },
        { id: "4", type: "webhook", name: "Custom Webhook", enabled: false, config: "" },
      ];
    }

    return [
      { 
        id: "1", 
        type: "email", 
        name: "Email Notifications", 
        enabled: preferences.email_enabled || false, 
        config: "" // Email is tied to auth user
      },
      { 
        id: "2", 
        type: "slack", 
        name: "Slack Channel", 
        enabled: !!preferences.encrypted_slack_webhook, 
        config: preferences.encrypted_slack_webhook ? "••••••••" : "" 
      },
      { 
        id: "3", 
        type: "discord", 
        name: "Discord Channel", 
        enabled: !!preferences.encrypted_discord_webhook, 
        config: preferences.encrypted_discord_webhook ? "••••••••" : "" 
      },
      { 
        id: "4", 
        type: "webhook", 
        name: "Custom Webhook", 
        enabled: !!preferences.encrypted_webhook_url, 
        config: preferences.encrypted_webhook_url ? "••••••••" : "" 
      },
    ];
  };

  const updateChannel = async (channelType: string, config: { enabled: boolean; value: string }): Promise<boolean> => {
    try {
      setSaving(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      let updateData: Partial<NotificationPreferences> = {};

      switch (channelType) {
        case 'email':
          updateData.email_enabled = config.enabled;
          break;
        // For webhook channels, encryption is handled server-side
        // Toggling off clears the encrypted value
        case 'slack':
        case 'discord':
        case 'webhook':
          // Disabling clears the value; enabling requires saving via edge function
          if (!config.enabled) {
            const field = channelType === 'slack' ? 'encrypted_slack_webhook' 
              : channelType === 'discord' ? 'encrypted_discord_webhook' 
              : 'encrypted_webhook_url';
            (updateData as any)[field] = null;
          }
          break;
      }

      const { error } = await supabase
        .from('notification_preferences')
        .update(updateData)
        .eq('user_id', user.id);

      if (error) throw error;

      toast({
        title: 'Channel Updated',
        description: 'Notification channel settings have been saved.',
      });

      await fetchPreferences();
      return true;
    } catch (error: any) {
      console.error('Error updating notification channel:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to update notification channel',
        variant: 'destructive',
      });
      return false;
    } finally {
      setSaving(false);
    }
  };

  const toggleChannel = async (channelType: string): Promise<void> => {
    const channels = getChannels();
    const channel = channels.find(c => c.type === channelType);
    if (!channel) return;

    await updateChannel(channelType, { 
      enabled: !channel.enabled, 
      value: channel.config 
    });
  };

  return {
    preferences,
    channels: getChannels(),
    loading,
    saving,
    fetchPreferences,
    updateChannel,
    toggleChannel,
  };
}

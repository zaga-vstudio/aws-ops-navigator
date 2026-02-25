import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { dispatchNotification } from "../_shared/dispatch-notification.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json().catch(() => ({}));
    const channel = body.channel || 'all'; // 'discord' | 'slack' | 'webhook' | 'email' | 'all'

    console.log(`Test notification requested by ${user.id} for channel: ${channel}`);

    const testAlert = {
      alertName: '🧪 Test Notification',
      metric: 'TestMetric',
      threshold: 100,
      currentValue: 42,
      severity: 'info',
    };

    const results = await dispatchNotification(user.id, user.email || null, testAlert);

    // If a specific channel was requested, filter results
    if (channel !== 'all') {
      const channelResult = results[channel];
      if (!channelResult) {
        return new Response(
          JSON.stringify({ success: false, error: `Channel "${channel}" is not configured`, results: {} }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      return new Response(
        JSON.stringify({ success: channelResult.success, results: { [channel]: channelResult } }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const anySuccess = Object.values(results).some((r: any) => r.success);
    const noChannels = Object.keys(results).length === 0;

    return new Response(
      JSON.stringify({
        success: anySuccess,
        noChannels,
        results,
        message: noChannels
          ? 'No notification channels are configured'
          : anySuccess
            ? 'Test notification sent successfully'
            : 'All notification channels failed',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error sending test notification:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

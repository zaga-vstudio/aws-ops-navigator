import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const VALID_CHANNEL_TYPES = ["slack", "discord", "webhook"] as const;
type ChannelType = (typeof VALID_CHANNEL_TYPES)[number];

const COLUMN_MAP: Record<ChannelType, string> = {
  slack: "encrypted_slack_webhook",
  discord: "encrypted_discord_webhook",
  webhook: "encrypted_webhook_url",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } =
      await anonClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub;

    // Parse & validate body
    const { channelType, webhookUrl } = await req.json();

    if (
      !channelType ||
      !VALID_CHANNEL_TYPES.includes(channelType as ChannelType)
    ) {
      return new Response(
        JSON.stringify({
          error: `Invalid channelType. Must be one of: ${VALID_CHANNEL_TYPES.join(", ")}`,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (
      !webhookUrl ||
      typeof webhookUrl !== "string" ||
      !webhookUrl.startsWith("https://")
    ) {
      return new Response(
        JSON.stringify({ error: "webhookUrl must be a valid HTTPS URL" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (webhookUrl.length > 2048) {
      return new Response(
        JSON.stringify({ error: "webhookUrl is too long (max 2048 chars)" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Use service role to call encrypt_secret and update the row
    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Encrypt the webhook URL using the DB function
    const { data: encrypted, error: encryptError } = await serviceClient.rpc(
      "encrypt_secret",
      { secret: webhookUrl }
    );

    if (encryptError) {
      console.error("Encryption error:", encryptError);
      return new Response(
        JSON.stringify({ error: "Failed to encrypt webhook URL" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const column = COLUMN_MAP[channelType as ChannelType];

    const { error: updateError } = await serviceClient
      .from("notification_preferences")
      .update({ [column]: encrypted })
      .eq("user_id", userId);

    if (updateError) {
      console.error("Update error:", updateError);
      return new Response(
        JSON.stringify({ error: "Failed to save webhook URL" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

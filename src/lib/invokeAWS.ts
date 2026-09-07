import { supabase } from "@/integrations/supabase/client";
import { getActiveClientId } from "@/lib/activeClientStore";

type InvokeOptions = Parameters<typeof supabase.functions.invoke>[1];

/**
 * Invokes an AWS-facing edge function, always attaching the active client id
 * (null = the operator's own AWS account) so every operation runs against the
 * account currently selected in the client switcher.
 */
export function invokeAWSFunction(name: string, options: InvokeOptions = {}) {
  const clientId = getActiveClientId();
  const body = (options as { body?: unknown })?.body;
  const mergedBody =
    body && typeof body === "object" && !Array.isArray(body)
      ? { ...(body as Record<string, unknown>), clientId }
      : { clientId };

  return supabase.functions.invoke(name, { ...options, body: mergedBody });
}

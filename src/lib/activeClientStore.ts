// Module-level mirror of the active client selection so non-React callers
// (edge function invocations) can scope AWS operations without prop drilling.
let activeClientId: string | null = null;

export function setActiveClientIdRef(id: string | null) {
  activeClientId = id;
}

export function getActiveClientId(): string | null {
  return activeClientId;
}

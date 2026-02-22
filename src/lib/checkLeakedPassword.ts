/**
 * Check if a password has been leaked using the HaveIBeenPwned API (k-anonymity model).
 * Only the first 5 characters of the SHA-1 hash are sent to the API.
 */
export async function checkLeakedPassword(password: string): Promise<{ leaked: boolean; count: number }> {
  try {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest("SHA-1", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();

    const prefix = hashHex.substring(0, 5);
    const suffix = hashHex.substring(5);

    const response = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`);
    if (!response.ok) {
      // If the API is unreachable, don't block the user
      return { leaked: false, count: 0 };
    }

    const text = await response.text();
    const lines = text.split("\n");

    for (const line of lines) {
      const [hashSuffix, countStr] = line.split(":");
      if (hashSuffix.trim() === suffix) {
        return { leaked: true, count: parseInt(countStr.trim(), 10) };
      }
    }

    return { leaked: false, count: 0 };
  } catch {
    // Fail open — don't block signup if the check fails
    return { leaked: false, count: 0 };
  }
}

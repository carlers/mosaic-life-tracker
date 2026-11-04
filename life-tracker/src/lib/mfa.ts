import { AuthenticationFactor } from "appwrite";
import { account } from "./appwrite";

/**
 * Appwrite's first-factor session is NOT a fully authenticated Mosaic account.
 * This error must be handled before generic HTTP-401/session-expired handling.
 */
export function isMfaRequiredError(error: unknown): boolean {
  return (error as { type?: string } | null)?.type ===
    "user_more_factors_required";
}

export type MfaChallengeFactor = "totp" | "recovery";

export async function createMfaLoginChallenge(factor: MfaChallengeFactor) {
  return account.createMfaChallenge({
    factor: factor === "totp"
      ? AuthenticationFactor.Totp
      : AuthenticationFactor.Recoverycode,
  });
}

export async function verifyMfaLoginChallenge(
  challengeId: string,
  otp: string,
): Promise<void> {
  await account.updateMfaChallenge({ challengeId, otp });
}

import { AuthenticationFactor, AuthenticatorType } from "appwrite";
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

/** Server-owned enrollment, never persisted in Mosaic's database or storage. */
export async function getMfaAccountState() {
  const user = await account.get();
  if (!user.$id || typeof user.mfa !== "boolean") {
    throw new Error("Appwrite did not return an authoritative MFA state.");
  }
  const factors = await account.listMfaFactors();
  return { userId: user.$id, enabled: user.mfa, hasTotp: factors.totp };
}

export async function beginTotpEnrollment() {
  return account.createMfaAuthenticator({ type: AuthenticatorType.Totp });
}

export async function confirmTotpEnrollment(otp: string) {
  return account.updateMfaAuthenticator({
    type: AuthenticatorType.Totp, otp,
  });
}

export async function createRecoveryCodes(): Promise<string[]> {
  const response = await account.createMfaRecoveryCodes();
  return response.recoveryCodes;
}

export async function activateMfa(): Promise<boolean> {
  await account.updateMFA({ mfa: true });
  return (await getMfaAccountState()).enabled;
}

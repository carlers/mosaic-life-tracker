import type { Models } from "appwrite";
import { account } from "./appwrite";
import { isUnauthorizedError } from "./authEvents";

type AccountCall = <T>(fn: () => Promise<T>) => Promise<T>;

/**
 * Token redemption is only needed when a verification link opens.
 * The caller supplies an auth-generation and mount fence to avoid updating
 * a stale identity after any asynchronous request or session switch.
 */
export async function redeemEmailVerification(
  targetUserId: string,
  secret: string,
  ownerId: string | null | undefined,
  isCurrent: () => boolean,
  callAccount: AccountCall,
): Promise<Models.User<Models.Preferences> | null> {
  if (!targetUserId || !secret) throw new Error("Invalid verification link.");
  let currentId: string | null = null;
  try {
    currentId = (await callAccount(() => account.get())).$id;
  } catch (error) {
    if (!isUnauthorizedError(error)) throw error;
  }
  if (!isCurrent() ||
      (ownerId && ownerId !== targetUserId) ||
      (currentId && currentId !== targetUserId)) {
    throw new Error("Verification belongs to another signed-in account.");
  }
  await callAccount(() => account.updateVerification(targetUserId, secret));
  if (currentId === targetUserId && ownerId === targetUserId && isCurrent()) {
    const verified = await callAccount(() => account.get());
    if (verified.$id === targetUserId && isCurrent()) return verified;
  }
  return null;
}

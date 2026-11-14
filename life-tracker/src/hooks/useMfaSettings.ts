import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "./useAuth";
import {
  activateMfa,
  beginTotpEnrollment,
  confirmTotpEnrollment,
  createRecoveryCodes,
  getMfaAccountState,
} from "../lib/mfa";

export type MfaSetupStage =
  | "loading" | "off" | "pairing" | "readyForCodes" | "codes" | "on" | "error";

/**
 * All enrollment material lives in React memory for this open sheet only.
 * Closing, signing out or switching owners invalidates asynchronous results.
 */
export function useMfaSettings(isOpen: boolean) {
  const { user } = useAuth();
  const owner = user?.$id ?? null;
  const generation = useRef(0);
  const busyRef = useRef(false);
  const [stage, setStage] = useState<MfaSetupStage>("loading");
  const [setup, setSetup] = useState<{ secret: string; uri: string } | null>(null);
  const [codes, setCodes] = useState<string[]>([]);
  const [acknowledged, setAcknowledged] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ensureCurrentOwner = useCallback(async () => {
    if (!owner) throw new Error("Sign in to manage account security.");
    const status = await getMfaAccountState();
    if (status.userId !== owner) throw new Error("The active account changed. Reopen Security.");
    return status;
  }, [owner]);

  useEffect(() => {
    const token = ++generation.current;
    busyRef.current = false;
    // Schedule reset after commit; synchronous effect state writes violate the
    // React contract and can trigger an extra cascading render.
    queueMicrotask(() => {
      if (token !== generation.current) return;
      setSetup(null);
      setCodes([]);
      setAcknowledged(false);
      setBusy(false);
      setError(null);
      setStage("loading");
    });
    if (!isOpen || !owner) return;
    void getMfaAccountState().then(state => {
      if (token !== generation.current) return;
      if (state.userId !== owner) throw new Error("The active account changed.");
      setStage(state.enabled ? "on" : state.hasTotp ? "readyForCodes" : "off");
    }).catch(err => {
      if (token !== generation.current) return;
      setError(err instanceof Error ? err.message : "Could not verify account security.");
      setStage("error");
    });
  }, [isOpen, owner]);

  const perform = useCallback(async <T,>(
    operation: () => Promise<T>,
    onSuccess: (result: T) => void,
  ) => {
    if (!isOpen || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError(null);
    const token = generation.current;
    try {
      await ensureCurrentOwner();
      if (generation.current !== token) return;
      const result = await operation();
      if (generation.current === token) onSuccess(result);
    } catch (err) {
      if (generation.current === token) {
        setError(err instanceof Error ? err.message : "Account security request failed.");
      }
    } finally {
      if (generation.current === token) {
        busyRef.current = false;
        setBusy(false);
      }
    }
  }, [ensureCurrentOwner, isOpen]);

  const begin = () => perform(beginTotpEnrollment, response => {
    setSetup({ secret: response.secret, uri: response.uri });
    setStage("pairing");
  });

  const verify = (otp: string) => perform(
    () => confirmTotpEnrollment(otp),
    () => { setSetup(null); setStage("readyForCodes"); },
  );

  const generateCodes = () => perform(createRecoveryCodes, response => {
    setCodes(response);
    setStage("codes");
  });

  const enable = () => {
    if (!acknowledged || codes.length === 0) return;
    return perform(activateMfa, enabled => {
      if (!enabled) {
        setError("MFA could not be confirmed. Check the account state before retrying.");
        return;
      }
      setSetup(null);
      setCodes([]);
      setAcknowledged(false);
      setStage("on");
    });
  };

  return {
    stage, setup, codes, acknowledged, busy, error,
    setAcknowledged, begin, verify, generateCodes, enable,
  };
}

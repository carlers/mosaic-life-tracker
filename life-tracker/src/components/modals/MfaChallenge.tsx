import React, { useEffect, useRef, useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";

type ChallengeMode = "totp" | "recovery";

export function MfaChallenge(): React.ReactElement {
  const {
    mfaChallengeReady, mfaChallengeLoading, mfaError,
    startMfaChallenge, completeMfaChallenge, cancelMfa,
  } = useAuth();
  const [factor, setFactor] = useState<ChallengeMode>("totp");
  const [otp, setOtp] = useState("");
  const [cancelError, setCancelError] = useState(false);
  const requested = useRef(false);

  useEffect(() => {
    if (requested.current) return;
    requested.current = true;
    void startMfaChallenge(factor);
  }, [factor, startMfaChallenge]);

  async function switchFactor(next: ChallengeMode) {
    if (mfaChallengeLoading || next === factor) return;
    setOtp("");
    setFactor(next);
    setCancelError(false);
    requested.current = true;
    await startMfaChallenge(next);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!mfaChallengeReady || mfaChallengeLoading) return;
    await completeMfaChallenge(otp);
  }

  return (
    <div className="min-h-screen bg-[#111111] text-white flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-[#1E1E1E] rounded-2xl p-8 border border-[#333333] shadow-2xl">
        <h1 className="text-2xl font-bold text-center mb-2">Two-factor verification</h1>
        <p className="text-gray-400 text-sm text-center mb-6">
          {factor === "totp"
            ? "Enter the six-digit code from your authenticator app."
            : "Enter one of your saved, unused recovery codes."}
        </p>
        <form onSubmit={(event) => void submit(event)} className="space-y-4">
          <Input
            label={factor === "totp" ? "Authenticator code" : "Recovery code"}
            type="text"
            inputMode={factor === "totp" ? "numeric" : "text"}
            autoComplete="one-time-code"
            autoCapitalize="off"
            spellCheck={false}
            value={otp}
            onChange={(event) => setOtp(factor === "totp"
              ? event.target.value.replace(/[^0-9]/g, "").slice(0, 6)
              : event.target.value)}
            required
          />
          {mfaError && <p role="alert" className="text-sm text-red-400">{mfaError}</p>}
          {cancelError && <p role="alert" className="text-sm text-red-400">
            Could not close the partial session. You can try signing in again.
          </p>}
          {!mfaChallengeReady && !mfaChallengeLoading && (
            <Button type="button" className="w-full" onClick={() => void startMfaChallenge(factor)}>
              Retry verification
            </Button>
          )}
          <Button className="w-full" disabled={!mfaChallengeReady || mfaChallengeLoading ||
            (factor === "totp" && otp.length !== 6) || !otp}>
            {mfaChallengeLoading ? "Verifying…" : "Verify and sign in"}
          </Button>
        </form>
        <button type="button" className="mt-6 w-full text-sm text-emerald-400 focus-visible:outline"
          disabled={mfaChallengeLoading}
          onClick={() => void switchFactor(factor === "totp" ? "recovery" : "totp")}>
          {factor === "totp" ? "Use a recovery code" : "Use an authenticator code"}
        </button>
        <button type="button" className="mt-4 w-full text-sm text-gray-400 focus-visible:outline"
          disabled={mfaChallengeLoading}
          onClick={() => void cancelMfa().then(ok => setCancelError(!ok))}>
          Cancel and return to sign in
        </button>
      </div>
    </div>
  );
}


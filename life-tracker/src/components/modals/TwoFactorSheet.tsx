import { useState } from "react";
import { BottomSheet } from "../ui/BottomSheet";
import { MfaQrCode } from "./MfaQrCode";
import { useMfaSettings } from "../../hooks/useMfaSettings";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

const actionStyle = "w-full px-4 py-3 rounded-lg bg-emerald-600 disabled:opacity-50 text-white font-semibold focus-visible:ring-2 focus-visible:ring-emerald-400";
const secondaryStyle = "px-3 py-2 rounded-lg border border-[#555] text-sm focus-visible:ring-2 focus-visible:ring-emerald-400";

export function TwoFactorSheet({ isOpen, onClose }: Props) {
  const mfa = useMfaSettings(isOpen);
  const [otp, setOtp] = useState("");
  const [copyError, setCopyError] = useState<string | null>(null);
  const close = () => {
    if (mfa.busy) return;
    setOtp("");
    setCopyError(null);
    onClose();
  };

  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopyError(null);
    } catch {
      setCopyError("Clipboard unavailable. Select and copy the text manually.");
    }
  }

  return (
    <BottomSheet isOpen={isOpen} onClose={close} title="Two-factor authentication"
      height="auto" isLocked={mfa.busy} preventDismiss={mfa.busy}>
      <div className="px-2 pb-8 pt-2 space-y-4 text-white">
        <p className="text-sm text-gray-400">
          Protect future sign-ins with an authenticator app and single-use recovery codes.
        </p>
        {mfa.error && <p role="alert" className="text-sm text-red-400">{mfa.error}</p>}
        {copyError && <p role="alert" className="text-sm text-red-400">{copyError}</p>}
        {mfa.stage === "loading" && <p role="status">Checking account security…</p>}
        {mfa.stage === "error" && <p role="alert">
          Security status could not be verified. Close and reopen this panel while online.
        </p>}
        {mfa.stage === "off" && <>
          <p role="status" className="text-sm">Status: Off</p>
          <button className={actionStyle} disabled={mfa.busy} onClick={() => void mfa.begin()}>
            Set up authenticator
          </button>
        </>}
        {mfa.stage === "pairing" && mfa.setup && <>
          <p className="text-sm">Scan this QR code in your authenticator app, or enter the key manually on the same device.</p>
          <MfaQrCode uri={mfa.setup.uri} />
          <div>
            <p className="text-xs text-gray-400 mb-1">Manual setup key</p>
            <div className="flex gap-2 items-center">
              <code className="min-w-0 flex-1 select-text break-all rounded bg-[#111] p-3 text-sm">
                {mfa.setup.secret}
              </code>
              <button className={secondaryStyle} onClick={() => void copy(mfa.setup!.secret)}>Copy</button>
            </div>
          </div>
          <label htmlFor="mfa-enroll-otp" className="block text-sm text-gray-300">
            Enter the 6-digit code from your authenticator
          </label>
          <input id="mfa-enroll-otp" type="text" inputMode="numeric" autoComplete="one-time-code"
            value={otp} maxLength={6} onChange={e => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
            className="w-full rounded-lg border border-[#555] bg-[#111] px-3 py-3 text-white" />
          <button className={actionStyle} disabled={mfa.busy || otp.length !== 6}
            onClick={() => void mfa.verify(otp)}>
            {mfa.busy ? "Verifying…" : "Verify authenticator"}
          </button>
        </>}
        {mfa.stage === "readyForCodes" && <>
          <p role="status" className="text-sm">
            Authenticator verified. Recovery codes are required before enabling 2FA.
          </p>
          <button className={actionStyle} disabled={mfa.busy} onClick={() => void mfa.generateCodes()}>
            Generate recovery codes
          </button>
        </>}
        {mfa.stage === "codes" && <>
          <p className="text-sm">
            Save these single-use recovery codes somewhere secure. They will be cleared from Mosaic when this sheet closes.
          </p>
          <div className="rounded-lg bg-[#111] p-3 grid grid-cols-2 gap-2">
            {mfa.codes.map((code, i) =>
              <code key={i} className="select-text break-all text-sm">{code}</code>)}
          </div>
          <button className={secondaryStyle} onClick={() => void copy(mfa.codes.join("\n"))}>
            Copy recovery codes
          </button>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" checked={mfa.acknowledged}
              onChange={e => mfa.setAcknowledged(e.target.checked)} />
            <span>I saved my recovery codes securely.</span>
          </label>
          <button className={actionStyle}
            disabled={!mfa.acknowledged || mfa.busy || !mfa.codes.length}
            onClick={() => void mfa.enable()}>
            {mfa.busy ? "Enabling…" : "Enable two-factor authentication"}
          </button>
        </>}
        {mfa.stage === "on" && <>
          <p role="status" className="text-sm text-emerald-400">Status: On — verified by Appwrite</p>
          <p className="text-sm text-gray-400">
            Future sign-ins require your authenticator or an unused recovery code.
            Factor removal and recovery-code rotation are unavailable until
            their server-enforced re-verification path is validated.
          </p>
        </>}
        <button className="block w-full text-sm text-gray-400 py-2" disabled={mfa.busy}
          onClick={close}>Close</button>
      </div>
    </BottomSheet>
  );
}

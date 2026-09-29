import React, { useId, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Button } from "../components/ui/Button";
import { useAuth } from "../hooks/useAuth";
import { MIN_PASSWORD_LENGTH, validatePassword } from "../lib/password";

export const ResetPasswordPage: React.FC = () => {
  const [params] = useSearchParams();
  const userId = params.get("userId")?.trim() ?? "";
  const secret = params.get("secret")?.trim() ?? "";
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);
  const passwordId = useId();
  const confirmationId = useId();
  const {
    completePasswordRecovery,
    recoveryLoading,
    recoveryError,
    recoverySuccess,
  } = useAuth();
  const hasValidCallback = Boolean(userId && secret);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (recoveryLoading) return;
    const passwordError = validatePassword(password);
    if (passwordError) {
      setValidationError(passwordError);
      return;
    }
    if (password !== confirmation) {
      setValidationError("Passwords do not match.");
      return;
    }
    setValidationError(null);
    await completePasswordRecovery(userId, secret, password);
  };

  return (
    <main className="min-h-screen bg-[#111111] text-white flex items-center justify-center p-6">
      <section
        className="w-full max-w-md bg-[#1E1E1E] rounded-2xl p-8 border border-[#333333] shadow-2xl"
        aria-labelledby="reset-title"
      >
        <h1 id="reset-title" className="text-2xl font-bold text-center mb-3">
          Choose a new password
        </h1>
        {!hasValidCallback ? (
          <>
            <div
              role="alert"
              className="text-red-400 text-sm bg-red-900/20 p-3 rounded-lg"
            >
              This password reset link is invalid or incomplete. Request a new
              link from the login page.
            </div>
            <Link
              to="/login"
              className="mt-6 block text-center text-emerald-400"
            >
              Return to login
            </Link>
          </>
        ) : recoverySuccess === "completed" ? (
          <>
            <p role="status" className="text-sm text-center">
              Your password has been reset successfully.
            </p>
            <Link
              to="/login"
              className="mt-6 block text-center text-emerald-400"
            >
              Return to login
            </Link>
          </>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="space-y-4"
            aria-busy={recoveryLoading}
          >
            <div>
              <label
                htmlFor={passwordId}
                className="block text-xs text-gray-400 mb-1.5"
              >
                New password
              </label>
              <input
                id={passwordId}
                type="password"
                autoComplete="new-password"
                minLength={MIN_PASSWORD_LENGTH}
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full bg-[#1E1E1E] border border-[#333333] rounded-lg px-4 py-2.5"
              />
            </div>
            <div>
              <label
                htmlFor={confirmationId}
                className="block text-xs text-gray-400 mb-1.5"
              >
                Confirm new password
              </label>
              <input
                id={confirmationId}
                type="password"
                autoComplete="new-password"
                minLength={MIN_PASSWORD_LENGTH}
                required
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                className="w-full bg-[#1E1E1E] border border-[#333333] rounded-lg px-4 py-2.5"
              />
            </div>
            {(validationError || recoveryError) && (
              <div role="alert" className="text-red-400 text-sm">
                {validationError || recoveryError}
              </div>
            )}
            <Button className="w-full" disabled={recoveryLoading}>
              {recoveryLoading ? "Resetting…" : "Reset password"}
            </Button>
          </form>
        )}
      </section>
    </main>
  );
};

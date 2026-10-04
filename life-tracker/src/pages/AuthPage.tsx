import React, { useEffect, useId, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { usePropSync } from "../hooks/usePropSync";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Eye, EyeOff } from "lucide-react";
import { MIN_PASSWORD_LENGTH } from "../lib/password";
import {
  normalizeUsername,
  USERNAME_MAX_LENGTH,
  USERNAME_REQUIREMENTS,
} from "../lib/profileUsername";

export const AuthPage: React.FC = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showRecovery, setShowRecovery] = useState(false);
  const {
    user,
    login,
    signup,
    requestPasswordRecovery,
    isLoading,
    error,
    recoveryLoading,
    recoveryError,
    recoverySuccess,
    pendingSignup,
  } = useAuth();
  const navigate = useNavigate();
  const passwordId = useId();

  useEffect(() => {
    if (user) navigate("/home", { replace: true });
  }, [navigate, user]);

  usePropSync(pendingSignup, () => {
    if (!pendingSignup) return;
    setIsLogin(false);
    setEmail(pendingSignup.email);
    setName(pendingSignup.name);
  });

  const switchToLogin = () => {
    setShowRecovery(false);
    setIsLogin(true);
    setPassword("");
    setName("");
    setUsername("");
  };

  const switchToSignup = () => {
    setShowRecovery(false);
    setIsLogin(false);
    setPassword("");
  };

  const handleRecovery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (recoveryLoading) return;
    await requestPasswordRecovery(email.trim());
  };

  if (showRecovery) {
    return (
      <div className="min-h-screen bg-[#111111] text-white flex items-center justify-center p-6">
        <div className="w-full max-w-md bg-[#1E1E1E] rounded-2xl p-8 border border-[#333333] shadow-2xl">
          <h1 className="text-2xl font-bold text-center mb-2">
            Reset your password
          </h1>
          <p className="text-gray-400 text-sm text-center mb-8">
            Enter your email and we’ll send password reset instructions.
          </p>
          {recoverySuccess === "requested" ? (
            <div
              role="status"
              className="text-sm bg-emerald-900/20 p-3 rounded-lg border border-emerald-900/50"
            >
              If an account exists for that email, password reset instructions
              have been sent.
            </div>
          ) : (
            <form
              onSubmit={handleRecovery}
              className="space-y-4"
              aria-busy={recoveryLoading}
            >
              <Input
                label="Email Address"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              {recoveryError && (
                <div role="alert" className="text-red-400 text-sm">
                  {recoveryError}
                </div>
              )}
              <Button className="w-full" disabled={recoveryLoading}>
                {recoveryLoading ? "Sending…" : "Send reset instructions"}
              </Button>
            </form>
          )}
          <button
            type="button"
            onClick={switchToLogin}
            className="mt-6 w-full text-sm text-emerald-400 hover:text-emerald-300 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60"
          >
            Back to login
          </button>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const success = isLogin
      ? await login(email, password)
      : await signup(email, password, name, username);
    if (success) {
      navigate("/home", { replace: true });
    }
  };

  return (
    <div className="min-h-screen bg-[#111111] text-white flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-[#1E1E1E] rounded-2xl p-8 border border-[#333333] shadow-2xl">
        <h1 className="text-2xl font-bold text-center mb-2">
          {isLogin ? "Welcome Back" : "Create Account"}
        </h1>
        <p className="text-gray-400 text-sm text-center mb-8">
          {isLogin
            ? "Sign in to access your life tracker."
            : "Start tracking your life today."}
        </p>
        <div className="flex bg-[#111111] rounded-lg p-1 mb-6">
          <button
            type="button"
            onClick={switchToLogin}
            className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
              isLogin ? "bg-[#2A2A2A] text-white" : "text-gray-400"
            }`}
          >
            Login
          </button>
          <button
            type="button"
            onClick={switchToSignup}
            className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
              !isLogin ? "bg-[#2A2A2A] text-white" : "text-gray-400"
            }`}
          >
            Sign Up
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <>
              <Input
                label="Full Name"
                type="text"
                placeholder="John Doe"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                maxLength={50}
                autoComplete="name"
              />
              <div className="w-full">
                <label
                  htmlFor="signup-username"
                  className="block text-xs text-gray-400 mb-1.5 ml-1"
                >
                  Username
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none">
                    @
                  </span>
                  <input
                    id="signup-username"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(normalizeUsername(e.target.value))}
                    placeholder="your_handle"
                    required
                    minLength={3}
                    maxLength={USERNAME_MAX_LENGTH}
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    autoComplete="username"
                    aria-describedby="signup-username-help"
                    className="w-full bg-[#1E1E1E] text-white border border-[#333333] rounded-lg pl-8 pr-4 py-2.5 focus:border-[#555555] focus-visible:ring-2 focus-visible:ring-emerald-500/60 focus:outline-none transition-colors placeholder-gray-400"
                  />
                </div>
                <p
                  id="signup-username-help"
                  className="text-xs text-gray-400 mt-1.5 ml-1"
                >
                  {USERNAME_REQUIREMENTS.replace("Username must be ", "")}
                </p>
              </div>
            </>
          )}
          <Input
            label="Email Address"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <div className="w-full">
            <label
              htmlFor={passwordId}
              className="block text-xs text-gray-400 mb-1.5 ml-1"
            >
              Password
            </label>
            <div className="relative">
              <input
                id={passwordId}
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={isLogin ? undefined : MIN_PASSWORD_LENGTH}
                autoComplete={isLogin ? "current-password" : "new-password"}
                className="w-full bg-[#1E1E1E] text-white border border-[#333333] rounded-lg px-4 py-2.5 pr-10 focus:border-[#555555] focus-visible:ring-2 focus-visible:ring-emerald-500/60 focus:outline-none transition-colors placeholder-gray-400"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-300 transition-colors rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60"
                aria-label={showPassword ? "Hide password" : "Show password"}
                aria-pressed={showPassword}
              >
                {showPassword ? (
                  <EyeOff size={18} aria-hidden="true" />
                ) : (
                  <Eye size={18} aria-hidden="true" />
                )}
              </button>
            </div>
          </div>
          {isLogin && (
            <button
              type="button"
              onClick={() => setShowRecovery(true)}
              className="text-sm text-emerald-400 hover:text-emerald-300 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60"
            >
              Forgot password?
            </button>
          )}
          {error && (
            <div
              role="alert"
              className="text-red-400 text-sm bg-red-900/20 p-3 rounded-lg border border-red-900/50"
            >
              {error}
            </div>
          )}
          <Button
            variant="primary"
            className="w-full mt-4"
            disabled={isLoading}
          >
            {isLoading
              ? "Processing..."
              : isLogin
                ? "Sign In"
                : "Create Account"}
          </Button>
        </form>
      </div>
    </div>
  );
};

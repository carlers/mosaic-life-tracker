import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { motion } from 'framer-motion';
import { Eye, EyeOff } from 'lucide-react';
import { initializeSync } from '../db/sync';

export const AuthPage: React.FC = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const { login, signup, isLoading, error } = useAuth();
  const navigate = useNavigate();

  const switchToLogin = () => {
    setIsLogin(true);
    setPassword('');
    setName('');
  };

  const switchToSignup = () => {
    setIsLogin(false);
    setPassword('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const success = isLogin
      ? await login(email, password)
      : await signup(email, password, name);
    if (success) {
      // Kick off sync now that a session exists. Fire-and-forget — the
      // user should not wait on network for navigation.
      initializeSync().catch((err) =>
        console.error('[AuthPage] initial sync failed:', err)
      );
      navigate('/home', { replace: true });
    }
  };

  return (
    <div className="min-h-screen bg-[#111111] text-white flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-[#1E1E1E] rounded-2xl p-8 border border-[#333333] shadow-2xl"
      >
        <h1 className="text-2xl font-bold text-center mb-2">
          {isLogin ? 'Welcome Back' : 'Create Account'}
        </h1>
        <p className="text-gray-500 text-sm text-center mb-8">
          {isLogin
            ? 'Sign in to access your life tracker.'
            : 'Start tracking your life today.'}
        </p>
        <div className="flex bg-[#111111] rounded-lg p-1 mb-6">
          <button
            type="button"
            onClick={switchToLogin}
            className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
              isLogin ? 'bg-[#2A2A2A] text-white' : 'text-gray-500'
            }`}
          >
            Login
          </button>
          <button
            type="button"
            onClick={switchToSignup}
            className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
              !isLogin ? 'bg-[#2A2A2A] text-white' : 'text-gray-500'
            }`}
          >
            Sign Up
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <Input
              label="Full Name"
              type="text"
              placeholder="John Doe"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required={!isLogin}
            />
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
            <label className="block text-xs text-gray-500 mb-1.5 ml-1">
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full bg-[#1E1E1E] text-white border border-[#333333] rounded-lg px-4 py-2.5 pr-10 focus:border-[#555555] focus:outline-none transition-colors placeholder-gray-600"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>
          {error && (
            <div className="text-red-400 text-sm bg-red-900/20 p-3 rounded-lg border border-red-900/50">
              {error}
            </div>
          )}
          <Button
            variant="primary"
            className="w-full mt-4"
            disabled={isLoading}
          >
            {isLoading ? 'Processing...' : isLogin ? 'Sign In' : 'Create Account'}
          </Button>
        </form>
      </motion.div>
    </div>
  );
};
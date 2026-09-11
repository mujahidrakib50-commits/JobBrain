"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Cpu, Lock, Mail, Eye, EyeOff, Loader2, AlertCircle, ShieldCheck } from "lucide-react";

export default function AuthPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setError("Please enter your email address.");
      return;
    }

    if (!password) {
      setError("Please enter your password.");
      return;
    }

    if (mode === "signup") {
      if (password.length < 6) {
        setError("Password must be at least 6 characters long.");
        return;
      }
      if (password !== confirmPassword) {
        setError("Passwords do not match. Please verify.");
        return;
      }
    }

    setLoading(true);

    try {
      const endpoint = mode === "signin" ? "/api/auth/login" : "/api/auth/register";
      const payload =
        mode === "signin"
          ? { email: cleanEmail, password }
          : { email: cleanEmail, password, confirmPassword };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Authentication failed. Please check your details.");
        setLoading(false);
        return;
      }

      // Successful login/registration -> redirect to dashboard
      window.location.href = "/";
    } catch (err: any) {
      setError(err.message || "Something went wrong. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0b0f19] text-gray-100 flex flex-col justify-center items-center px-4 py-8 sm:px-6 relative overflow-hidden selection:bg-accent-blue selection:text-white">
      {/* Background ambient lighting */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-accent-blue/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-1/4 left-1/3 -translate-x-1/2 translate-y-1/2 w-[450px] h-[450px] bg-purple-600/10 rounded-full blur-[140px] pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        {/* Brand Header */}
        <div className="text-center mb-6 sm:mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-tr from-accent-blue via-indigo-500 to-purple-600 shadow-xl shadow-blue-500/20 mb-3 sm:mb-4 border border-white/10">
            <Cpu className="w-7 h-7 sm:w-8 sm:h-8 text-white" />
          </div>
          <div className="flex items-center justify-center gap-2 mb-1.5">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">JobBrain</h1>
            <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-surface-2 border border-surface-border text-accent-blue">
              v1.0
            </span>
          </div>
          <p className="text-xs sm:text-sm text-gray-400">
            Autonomous Job Application Submitter & AI Monitor
          </p>
        </div>

        {/* Card Container */}
        <div className="bg-[#121827]/90 border border-[#1f293d] backdrop-blur-xl rounded-2xl shadow-2xl p-6 sm:p-8">
          {/* Mode Switcher Tabs */}
          <div className="flex p-1 rounded-xl bg-[#0d131f] border border-[#1f293d] mb-6">
            <button
              type="button"
              onClick={() => {
                setMode("signin");
                setError(null);
              }}
              className={`flex-1 py-2 text-xs sm:text-sm font-semibold rounded-lg transition-all ${
                mode === "signin"
                  ? "bg-accent-blue text-white shadow-md shadow-blue-500/20"
                  : "text-gray-400 hover:text-gray-200"
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("signup");
                setError(null);
              }}
              className={`flex-1 py-2 text-xs sm:text-sm font-semibold rounded-lg transition-all ${
                mode === "signup"
                  ? "bg-accent-blue text-white shadow-md shadow-blue-500/20"
                  : "text-gray-400 hover:text-gray-200"
              }`}
            >
              Create Account
            </button>
          </div>

          {/* Error Alert */}
          {error && (
            <div className="mb-5 p-3 sm:p-3.5 rounded-xl bg-accent-red/10 border border-accent-red/30 flex items-start gap-2.5 text-accent-red text-xs sm:text-sm animate-in fade-in duration-200">
              <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 shrink-0 mt-0.5" />
              <div className="flex-1 leading-snug">{error}</div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email Field */}
            <div>
              <label
                htmlFor="auth-email"
                className="block text-xs sm:text-sm font-medium text-gray-300 mb-1.5"
              >
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  id="auth-email"
                  type="email"
                  name="email"
                  autoComplete="email"
                  inputMode="email"
                  autoCapitalize="none"
                  spellCheck={false}
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full pl-10 pr-3.5 py-2.5 bg-[#0d131f] border border-[#1f293d] rounded-xl text-xs sm:text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-accent-blue/50 focus:border-accent-blue transition"
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <label
                htmlFor="auth-password"
                className="block text-xs sm:text-sm font-medium text-gray-300 mb-1.5"
              >
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  id="auth-password"
                  type={showPassword ? "text" : "password"}
                  name="password"
                  autoComplete={mode === "signin" ? "current-password" : "new-password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={mode === "signup" ? "At least 6 characters" : "••••••••"}
                  className="w-full pl-10 pr-11 py-2.5 bg-[#0d131f] border border-[#1f293d] rounded-xl text-xs sm:text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-accent-blue/50 focus:border-accent-blue transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-gray-400 hover:text-gray-200 transition"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Confirm Password (Sign Up only) */}
            {mode === "signup" && (
              <div className="animate-in fade-in duration-150">
                <label
                  htmlFor="auth-confirm-password"
                  className="block text-xs sm:text-sm font-medium text-gray-300 mb-1.5"
                >
                  Confirm Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    id="auth-confirm-password"
                    type={showPassword ? "text" : "password"}
                    name="confirmPassword"
                    autoComplete="new-password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repeat your password"
                    className="w-full pl-10 pr-3.5 py-2.5 bg-[#0d131f] border border-[#1f293d] rounded-xl text-xs sm:text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-accent-blue/50 focus:border-accent-blue transition"
                  />
                </div>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-3 px-4 rounded-xl bg-gradient-to-r from-accent-blue via-indigo-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-semibold text-xs sm:text-sm shadow-lg shadow-blue-500/25 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{mode === "signin" ? "Signing In..." : "Creating Account..."}</span>
                </>
              ) : (
                <span>{mode === "signin" ? "Sign In" : "Create Account"}</span>
              )}
            </button>
          </form>

          {/* Security & Isolation Callout */}
          <div className="mt-6 pt-5 border-t border-[#1f293d] flex items-start gap-2.5 text-gray-400 text-[11px] sm:text-xs">
            <ShieldCheck className="w-4 h-4 text-accent-emerald shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              <span className="text-gray-300 font-medium">Private & Isolated:</span> Each account
              maintains its own isolated AI Brain, job application queue, personal profile data, and
              Gmail monitor.
            </p>
          </div>
        </div>

        {/* Subtle Admin Hint */}
        <div className="text-center mt-4">
          <p className="text-[11px] sm:text-xs text-gray-500">
            Default administrator login:{" "}
            <code className="text-gray-400 bg-surface-2 px-1.5 py-0.5 rounded border border-surface-border">
              admin@jobbrain.local
            </code>{" "}
            /{" "}
            <code className="text-gray-400 bg-surface-2 px-1.5 py-0.5 rounded border border-surface-border">
              admin123
            </code>
          </p>
        </div>
      </div>
    </div>
  );
}

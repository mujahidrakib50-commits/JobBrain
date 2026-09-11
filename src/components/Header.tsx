"use client";

import { useState, useEffect, useRef } from "react";
import { Cpu, Play, Square, Settings, User, Key, CheckCircle, ChevronDown, Mail, LogOut } from "lucide-react";

interface HeaderProps {
  onOpenProfile: () => void;
  onOpenBrain: () => void;
  onOpenInbox?: () => void;
  isQueueRunning: boolean;
  onToggleQueue: () => void;
  avatarUrl?: string | null;
  userEmail?: string | null;
  activeBrain: {
    id: string;
    label: string;
    provider: string;
    model: string;
  } | null;
}

export function Header({
  onOpenProfile,
  onOpenBrain,
  onOpenInbox,
  isQueueRunning,
  onToggleQueue,
  avatarUrl,
  userEmail,
  activeBrain,
}: HeaderProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {}
    window.location.href = "/auth";
  };

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);


  return (
    <header className="border-b border-surface-border bg-surface/80 backdrop-blur sticky top-0 z-40 px-3 sm:px-6 lg:px-8 py-2.5 sm:py-3.5 flex items-center justify-between gap-2">
      {/* Brand */}
      <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
        <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-tr from-accent-blue via-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-blue-500/20 shrink-0">
          <Cpu className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
        </div>
        <div>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <span className="font-bold text-base sm:text-lg tracking-tight text-white">JobBrain</span>
            <span className="text-[9px] sm:text-[10px] font-medium uppercase tracking-wider px-1.5 py-0.5 rounded bg-surface-2 border border-surface-border text-gray-400">
              v1.0
            </span>
          </div>
          <p className="text-xs text-gray-400 hidden sm:block">Autonomous Job Application Submitter</p>
        </div>
      </div>

      {/* Center / Right controls */}
      <div className="flex items-center gap-1.5 sm:gap-3">
        {/* Active Brain Indicator */}
        <button
          onClick={onOpenBrain}
          className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1.5 rounded-lg bg-surface-2 border border-surface-border hover:border-gray-600 transition text-xs group shrink-0"
          title="Click to switch or configure AI Brain"
        >
          <span
            className={`w-2 h-2 rounded-full shrink-0 ${
              activeBrain
                ? isQueueRunning
                  ? "bg-accent-blue animate-pulse shadow-[0_0_8px_#3b82f6]"
                  : "bg-accent-emerald shadow-[0_0_6px_#10b981]"
                : "bg-gray-500"
            }`}
          />
          {activeBrain ? (
            <span className="font-semibold text-gray-200 group-hover:text-white transition max-w-[70px] xs:max-w-[100px] sm:max-w-[150px] truncate">
              {activeBrain.model}
            </span>
          ) : (
            <span className="text-accent-amber font-medium flex items-center gap-1">
              Brain
            </span>
          )}
        </button>

        {/* Start / Stop Submitting Toggle */}
        <button
          onClick={onToggleQueue}
          className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-lg font-medium text-xs sm:text-sm shadow-md transition-all shrink-0 ${
            isQueueRunning
              ? "bg-accent-red/20 text-accent-red border border-accent-red/40 hover:bg-accent-red/30 shadow-red-500/10"
              : "bg-accent-emerald text-gray-950 font-bold hover:bg-emerald-400 shadow-emerald-500/20"
          }`}
        >
          {isQueueRunning ? (
            <>
              <Square className="w-3 h-3 sm:w-3.5 sm:h-3.5 fill-current shrink-0" />
              <span>
                Stop<span className="hidden sm:inline"> Submitting</span>
              </span>
            </>
          ) : (
            <>
              <Play className="w-3 h-3 sm:w-3.5 sm:h-3.5 fill-current shrink-0" />
              <span>
                Start<span className="hidden sm:inline"> Submitting</span>
              </span>
            </>
          )}
        </button>

        {/* Profile Avatar / Settings Dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center gap-1.5 p-1 rounded-full bg-surface-2 border border-surface-border hover:border-accent-blue transition group"
            aria-label="Profile and Settings"
            title="Profile & Settings"
          >
            <div className="w-8 h-8 rounded-full overflow-hidden bg-surface flex items-center justify-center border border-surface-border group-hover:border-accent-blue/50 transition">
              {avatarUrl ? (
                <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <User className="w-4 h-4 text-gray-400 group-hover:text-white transition" />
              )}
            </div>
            <ChevronDown className="w-3 h-3 text-gray-400 mr-1 group-hover:text-white transition" />
          </button>

          {dropdownOpen && (
            <div className="absolute right-0 mt-2 w-56 rounded-xl bg-surface border border-surface-border shadow-2xl py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100">
              <div className="px-3 py-2 border-b border-surface-border">
                <div className="flex items-center justify-between gap-1 mb-0.5">
                  <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                    Account
                  </span>
                  <span className="inline-flex items-center gap-1 text-[10px] text-accent-emerald font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-accent-emerald animate-pulse" />
                    Active
                  </span>
                </div>
                <p
                  className="text-xs font-semibold text-white truncate"
                  title={userEmail || "Signed In"}
                >
                  {userEmail || "Signed In"}
                </p>
              </div>

              <button
                onClick={() => {
                  setDropdownOpen(false);
                  onOpenProfile();
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 text-xs text-gray-200 hover:bg-surface-2 hover:text-white text-left transition"
              >
                <div className="w-6 h-6 rounded-md bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-accent-blue">
                  <User className="w-3.5 h-3.5" />
                </div>
                <div>
                  <div className="font-medium">Profile</div>
                  <div className="text-[11px] text-gray-400">Q&A answers & attachments</div>
                </div>
              </button>

              <button
                onClick={() => {
                  setDropdownOpen(false);
                  onOpenBrain();
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 text-xs text-gray-200 hover:bg-surface-2 hover:text-white text-left transition"
              >
                <div className="w-6 h-6 rounded-md bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
                  <Key className="w-3.5 h-3.5" />
                </div>
                <div>
                  <div className="font-medium">API Keys (Brain)</div>
                  <div className="text-[11px] text-gray-400">Models & intelligence</div>
                </div>
              </button>

              {onOpenInbox && (
                <button
                  onClick={() => {
                    setDropdownOpen(false);
                    onOpenInbox();
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 text-xs text-gray-200 hover:bg-surface-2 hover:text-white text-left transition border-t border-surface-border/50"
                >
                  <div className="w-6 h-6 rounded-md bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                    <Mail className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <div className="font-medium">Gmail Monitor</div>
                    <div className="text-[11px] text-gray-400">Rejections & responses</div>
                  </div>
                </button>
              )}

              {/* Sign Out Button */}
              <button
                onClick={() => {
                  setDropdownOpen(false);
                  handleLogout();
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-accent-red hover:bg-accent-red/10 text-left transition border-t border-surface-border/50"
              >
                <div className="w-6 h-6 rounded-md bg-accent-red/10 border border-accent-red/20 flex items-center justify-center text-accent-red">
                  <LogOut className="w-3.5 h-3.5" />
                </div>
                <div>
                  <div className="font-semibold">Sign Out</div>
                  <div className="text-[10px] text-gray-400">Log out of JobBrain</div>
                </div>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

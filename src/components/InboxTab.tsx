"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Mail,
  RefreshCw,
  Search,
  ArrowUpDown,
  XCircle,
  CheckCircle2,
  Sparkles,
  ExternalLink,
  Trash2,
  Check,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Lock,
  Calendar,
  User,
  Settings,
  ShieldCheck,
} from "lucide-react";

export interface JobEmail {
  id: string;
  messageId: string;
  threadId?: string | null;
  sender: string;
  senderEmail: string;
  subject: string;
  snippet: string;
  bodyText?: string | null;
  category: "REJECTION" | "POSITIVE" | "JOB_MATCH";
  receivedAt: string;
  isRead: boolean;
  createdAt: string;
}

interface InboxTabProps {
  onRefreshBadge?: () => void;
}

export function InboxTab({ onRefreshBadge }: InboxTabProps) {
  const [emails, setEmails] = useState<JobEmail[]>([]);
  const [counts, setCounts] = useState({
    all: 0,
    unread: 0,
    rejection: 0,
    positive: 0,
    jobMatch: 0,
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [gmailStatus, setGmailStatus] = useState<{
    isConnected: boolean;
    email: string | null;
    lastSyncAt: string | null;
    hasConfig: boolean;
  }>({
    isConnected: false,
    email: null,
    lastSyncAt: null,
    hasConfig: false,
  });

  // Filters and sorting
  const [selectedCategory, setSelectedCategory] = useState<"all" | "REJECTION" | "POSITIVE" | "JOB_MATCH">("all");
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "sender" | "category">("newest");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Setup modal / state
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [clientIdInput, setClientIdInput] = useState("");
  const [clientSecretInput, setClientSecretInput] = useState("");
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [configError, setConfigError] = useState<string | null>(null);

  // Fetch status and emails
  const fetchInboxData = useCallback(async () => {
    try {
      // 1. Fetch Gmail Status
      const sRes = await fetch("/api/gmail/status");
      if (sRes.ok) {
        const sData = await sRes.json();
        setGmailStatus(sData);
      }

      // 2. Fetch Emails
      const params = new URLSearchParams();
      if (selectedCategory !== "all") params.set("category", selectedCategory);
      params.set("sort", sortBy);
      if (searchQuery) params.set("search", searchQuery);

      const eRes = await fetch(`/api/inbox?${params.toString()}`);
      if (eRes.ok) {
        const eData = await eRes.json();
        setEmails(eData.emails || []);
        if (eData.counts) setCounts(eData.counts);
      }
    } catch (err) {
      console.error("Failed fetching inbox data:", err);
    } finally {
      setIsLoading(false);
    }
  }, [selectedCategory, sortBy, searchQuery]);

  useEffect(() => {
    fetchInboxData();
    const interval = setInterval(fetchInboxData, 15000);
    return () => clearInterval(interval);
  }, [fetchInboxData]);

  // Connect Gmail
  const handleConnectGmail = async () => {
    try {
      const res = await fetch("/api/gmail/connect");
      const data = await res.json();
      if (!res.ok) {
        if (data.needsConfig) {
          setShowConfigModal(true);
        } else {
          alert(data.error || "Failed to start Google sign-in.");
        }
        return;
      }

      if (data.url) {
        window.location.href = data.url;
      }
    } catch (e: any) {
      alert("Error initiating connection: " + e.message);
    }
  };

  // Save OAuth Config
  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientIdInput.trim() || !clientSecretInput.trim()) return;

    setIsSavingConfig(true);
    setConfigError(null);

    try {
      const res = await fetch("/api/gmail/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: clientIdInput.trim(),
          clientSecret: clientSecretInput.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save configuration.");

      setShowConfigModal(false);
      setGmailStatus((prev) => ({ ...prev, hasConfig: true }));
      // Directly proceed to connect
      handleConnectGmail();
    } catch (err: any) {
      setConfigError(err.message || "Failed to save credentials.");
    } finally {
      setIsSavingConfig(false);
    }
  };

  // Manual Sync
  const handleSyncNow = async () => {
    setIsSyncing(true);
    try {
      const res = await fetch("/api/gmail/status", { method: "POST" });
      if (res.ok) {
        await fetchInboxData();
        onRefreshBadge?.();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsSyncing(false);
    }
  };

  // Disconnect Gmail
  const handleDisconnect = async () => {
    if (!confirm("Are you sure you want to disconnect your Gmail account from JobBrain?")) return;
    try {
      await fetch("/api/gmail/disconnect", { method: "POST" });
      await fetchInboxData();
      onRefreshBadge?.();
    } catch (e) {
      console.error(e);
    }
  };

  // Mark Read / Unread
  const handleToggleRead = async (id: string, currentRead: boolean) => {
    try {
      await fetch("/api/inbox", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, isRead: !currentRead }),
      });
      setEmails((prev) =>
        prev.map((e) => (e.id === id ? { ...e, isRead: !currentRead } : e))
      );
      onRefreshBadge?.();
    } catch (e) {
      console.error(e);
    }
  };

  // Mark all as read
  const handleMarkAllRead = async () => {
    try {
      await fetch("/api/inbox", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markAllRead: true }),
      });
      setEmails((prev) => prev.map((e) => ({ ...e, isRead: true })));
      onRefreshBadge?.();
    } catch (e) {
      console.error(e);
    }
  };

  // Delete email
  const handleDeleteEmail = async (id: string) => {
    try {
      await fetch("/api/inbox", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      setEmails((prev) => prev.filter((e) => e.id !== id));
      onRefreshBadge?.();
    } catch (e) {
      console.error(e);
    }
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "Recently";
    return d.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getCategoryBadge = (category: string) => {
    switch (category) {
      case "REJECTION":
        return {
          label: "Rejection",
          bg: "bg-red-950/60 text-red-400 border-red-800/60",
          icon: XCircle,
          color: "text-red-400",
        };
      case "POSITIVE":
        return {
          label: "Positive Response",
          bg: "bg-emerald-950/60 text-emerald-400 border-emerald-800/60",
          icon: CheckCircle2,
          color: "text-emerald-400",
        };
      case "JOB_MATCH":
        return {
          label: "Job Match / Alert",
          bg: "bg-sky-950/60 text-sky-400 border-sky-800/60",
          icon: Sparkles,
          color: "text-sky-400",
        };
      default:
        return {
          label: "Job Update",
          bg: "bg-gray-800 text-gray-300 border-gray-700",
          icon: Mail,
          color: "text-gray-300",
        };
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-4">
      {/* Top Banner: Connection status & actions */}
      <div className="p-4 sm:p-5 rounded-2xl bg-surface border border-surface-border shadow-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 shrink-0">
            <Mail className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm sm:text-base font-bold text-white">Gmail Job Inbox Monitor</h2>
              {gmailStatus.isConnected ? (
                <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-400 bg-emerald-950/50 border border-emerald-800 px-2 py-0.5 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span>Connected</span>
                </span>
              ) : (
                <span className="text-[11px] font-semibold text-gray-400 bg-surface-2 border border-surface-border px-2 py-0.5 rounded-full">
                  Not Connected
                </span>
              )}
            </div>
            <p className="text-xs text-gray-400 mt-0.5">
              {gmailStatus.isConnected
                ? `Account: ${gmailStatus.email} • Auto-scanning for rejections, responses & matches`
                : "Connect your Gmail to automatically monitor responses & application outcomes."}
            </p>
          </div>
        </div>

        {/* Action button */}
        <div className="flex items-center gap-2 self-end sm:self-center">
          {gmailStatus.isConnected ? (
            <>
              <button
                onClick={handleSyncNow}
                disabled={isSyncing}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-2 hover:bg-surface border border-surface-border text-xs text-gray-200 font-medium transition disabled:opacity-50"
                title="Scan Gmail for new updates now"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? "animate-spin text-purple-400" : ""}`} />
                <span>{isSyncing ? "Scanning..." : "Sync Now"}</span>
              </button>
              <button
                onClick={handleDisconnect}
                className="px-2.5 py-1.5 rounded-lg bg-red-950/20 hover:bg-red-950/40 text-red-400 border border-red-900/30 text-xs font-medium transition"
                title="Disconnect Gmail"
              >
                Disconnect
              </button>
            </>
          ) : (
            <button
              onClick={handleConnectGmail}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 font-semibold text-xs sm:text-sm text-white shadow-lg shadow-purple-600/20 transition"
            >
              <Mail className="w-4 h-4" />
              <span>Connect Gmail</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Inbox View if connected, else prompt */}
      {!gmailStatus.isConnected ? (
        <div className="p-8 sm:p-12 rounded-2xl bg-surface border border-surface-border text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center mx-auto text-purple-400">
            <Mail className="w-8 h-8" />
          </div>
          <div className="max-w-md mx-auto">
            <h3 className="text-base sm:text-lg font-bold text-white">Automate Your Application Follow-ups</h3>
            <p className="text-xs sm:text-sm text-gray-400 mt-2 leading-relaxed">
              JobBrain monitors your incoming emails and uses your AI Brain to organize messages into 3 essential categories:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 my-5 text-left">
              <div className="p-3 rounded-xl bg-surface-2 border border-surface-border">
                <div className="flex items-center gap-1.5 text-xs font-bold text-red-400 mb-1">
                  <XCircle className="w-3.5 h-3.5" />
                  <span>Rejections</span>
                </div>
                <p className="text-[11px] text-gray-400">Tracks declines so you know where you stand.</p>
              </div>

              <div className="p-3 rounded-xl bg-surface-2 border border-surface-border">
                <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-400 mb-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Fair Responses</span>
                </div>
                <p className="text-[11px] text-gray-400">Interviews, tests & recruiter next steps.</p>
              </div>

              <div className="p-3 rounded-xl bg-surface-2 border border-surface-border">
                <div className="flex items-center gap-1.5 text-xs font-bold text-sky-400 mb-1">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Job Matches</span>
                </div>
                <p className="text-[11px] text-gray-400">New job alerts & matching openings.</p>
              </div>
            </div>

            <button
              onClick={handleConnectGmail}
              className="px-6 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 font-semibold text-sm text-white shadow-lg shadow-purple-600/25 transition"
            >
              Connect Gmail Account
            </button>
            <div className="mt-3 flex items-center justify-center gap-1.5 text-[11px] text-gray-500">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
              <span>Read-only access. JobBrain never sends, deletes, or modifies your emails.</span>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Filter Pills & Toolbar */}
          <div className="space-y-3">
            {/* Category Pills */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
              <button
                onClick={() => setSelectedCategory("all")}
                className={`px-3 py-1.5 rounded-lg border font-semibold transition shrink-0 ${
                  selectedCategory === "all"
                    ? "bg-purple-600 border-purple-500 text-white shadow-md shadow-purple-600/20"
                    : "bg-surface-2 border-surface-border text-gray-400 hover:text-gray-200"
                }`}
              >
                All Job Emails ({counts.all})
              </button>

              <button
                onClick={() => setSelectedCategory("REJECTION")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border font-semibold transition shrink-0 ${
                  selectedCategory === "REJECTION"
                    ? "bg-red-950 border-red-700 text-red-300 shadow-md shadow-red-950/30"
                    : "bg-surface-2 border-surface-border text-gray-400 hover:text-red-400"
                }`}
              >
                <XCircle className="w-3.5 h-3.5 text-red-400" />
                <span>Rejections ({counts.rejection})</span>
              </button>

              <button
                onClick={() => setSelectedCategory("POSITIVE")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border font-semibold transition shrink-0 ${
                  selectedCategory === "POSITIVE"
                    ? "bg-emerald-950 border-emerald-700 text-emerald-300 shadow-md shadow-emerald-950/30"
                    : "bg-surface-2 border-surface-border text-gray-400 hover:text-emerald-400"
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>Positive Responses ({counts.positive})</span>
              </button>

              <button
                onClick={() => setSelectedCategory("JOB_MATCH")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border font-semibold transition shrink-0 ${
                  selectedCategory === "JOB_MATCH"
                    ? "bg-sky-950 border-sky-700 text-sky-300 shadow-md shadow-sky-950/30"
                    : "bg-surface-2 border-surface-border text-gray-400 hover:text-sky-400"
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 text-sky-400" />
                <span>Job Matches ({counts.jobMatch})</span>
              </button>
            </div>

            {/* Search & Sort Row */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 text-xs">
              {/* Search */}
              <div className="relative flex-1 max-w-sm">
                <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-gray-500" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search subject, company, or sender..."
                  className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-surface-2 border border-surface-border text-gray-200 placeholder-gray-500 focus:outline-none focus:border-purple-500 transition text-xs"
                />
              </div>

              {/* Sort Controls & Mark Read */}
              <div className="flex items-center gap-2 self-end sm:self-auto">
                <span className="text-gray-400 flex items-center gap-1 shrink-0">
                  <ArrowUpDown className="w-3 h-3 text-gray-400" />
                  <span>Sort:</span>
                </span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="px-2.5 py-1.5 rounded-lg bg-surface-2 border border-surface-border text-xs text-gray-200 focus:outline-none focus:border-purple-500 transition cursor-pointer"
                >
                  <option value="newest">Newest Arrival (Default)</option>
                  <option value="oldest">Oldest First</option>
                  <option value="sender">Sender (A-Z)</option>
                  <option value="category">Category</option>
                </select>

                {counts.unread > 0 && (
                  <button
                    onClick={handleMarkAllRead}
                    className="px-2.5 py-1.5 rounded-lg bg-surface-2 hover:bg-surface border border-surface-border text-gray-300 hover:text-white transition"
                    title="Mark all emails as read"
                  >
                    Mark All Read
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Email List */}
          {emails.length === 0 ? (
            <div className="p-12 rounded-2xl bg-surface border border-surface-border text-center space-y-2">
              <Mail className="w-8 h-8 text-gray-600 mx-auto" />
              <p className="text-sm text-gray-300 font-semibold">No emails found</p>
              <p className="text-xs text-gray-500 max-w-sm mx-auto">
                {selectedCategory === "all"
                  ? "No job application emails have been received yet. New emails will appear here automatically."
                  : `No emails matching the "${selectedCategory}" category found.`}
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {emails.map((email) => {
                const isExpanded = expandedId === email.id;
                const badge = getCategoryBadge(email.category);
                const BadgeIcon = badge.icon;

                return (
                  <div
                    key={email.id}
                    className={`rounded-xl border transition-all overflow-hidden ${
                      isExpanded
                        ? "bg-surface border-purple-500/70 shadow-lg shadow-purple-500/5 ring-1 ring-purple-500/30"
                        : "bg-surface border-surface-border hover:border-gray-700"
                    } ${!email.isRead ? "border-l-4 border-l-purple-500" : ""}`}
                  >
                    {/* Header Row */}
                    <div
                      onClick={() => {
                        setExpandedId(isExpanded ? null : email.id);
                        if (!email.isRead) handleToggleRead(email.id, false);
                      }}
                      className="p-3.5 sm:p-4 flex items-center justify-between gap-3 cursor-pointer select-none hover:bg-surface-2/40 transition"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        {/* Unread indicator */}
                        <div
                          className={`w-2 h-2 rounded-full shrink-0 ${
                            !email.isRead
                              ? "bg-purple-400 shadow-[0_0_8px_#a855f7]"
                              : "bg-transparent"
                          }`}
                        />

                        {/* Details */}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-xs sm:text-sm text-white truncate max-w-[200px] sm:max-w-none">
                              {email.sender}
                            </span>
                            <span
                              className={`flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded border uppercase tracking-wider ${badge.bg}`}
                            >
                              <BadgeIcon className="w-3 h-3" />
                              <span>{badge.label}</span>
                            </span>
                          </div>

                          <p className="text-xs sm:text-sm text-gray-200 font-medium truncate mt-0.5">
                            {email.subject}
                          </p>

                          <p className="text-[11px] text-gray-400 truncate mt-0.5">
                            {email.snippet}
                          </p>
                        </div>
                      </div>

                      {/* Right metadata & actions */}
                      <div className="flex items-center gap-2 text-right shrink-0">
                        <div className="text-[11px] text-gray-400 flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-gray-500" />
                          <span>{formatDate(email.receivedAt)}</span>
                        </div>

                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4 text-gray-400" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-gray-400" />
                        )}
                      </div>
                    </div>

                    {/* Expanded Content View */}
                    {isExpanded && (
                      <div className="px-4 pb-4 pt-2 border-t border-surface-border/60 bg-surface-2/30 space-y-3 text-xs">
                        <div className="p-3 rounded-lg bg-surface border border-surface-border text-gray-300 font-mono text-[11px] leading-relaxed whitespace-pre-wrap max-h-80 overflow-y-auto">
                          {email.bodyText || email.snippet}
                        </div>

                        <div className="flex items-center justify-between pt-1">
                          <span className="text-gray-500 text-[11px]">
                            From: {email.senderEmail}
                          </span>

                          <div className="flex items-center gap-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleToggleRead(email.id, email.isRead);
                              }}
                              className="px-2.5 py-1 rounded bg-surface hover:bg-surface-2 border border-surface-border text-gray-300 text-[11px] transition"
                            >
                              {email.isRead ? "Mark as Unread" : "Mark as Read"}
                            </button>

                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteEmail(email.id);
                              }}
                              className="p-1 rounded bg-red-950/30 hover:bg-red-950/60 border border-red-900/40 text-red-400 transition"
                              title="Delete from Inbox view"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Google OAuth Credentials Configuration Modal */}
      {showConfigModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-2xl bg-surface border border-surface-border shadow-2xl p-6 relative">
            <div className="flex items-center justify-between pb-4 border-b border-surface-border mb-4">
              <div className="flex items-center gap-2 text-white font-bold text-base">
                <Settings className="w-5 h-5 text-purple-400" />
                <span>Configure Google OAuth Credentials</span>
              </div>
              <button
                onClick={() => setShowConfigModal(false)}
                className="text-gray-400 hover:text-white text-lg leading-none"
              >
                &times;
              </button>
            </div>

            <p className="text-xs text-gray-300 leading-relaxed mb-4">
              To connect your Gmail, JobBrain needs your free Google OAuth App credentials. You can get them from the{" "}
              <a
                href="https://console.cloud.google.com/apis/credentials"
                target="_blank"
                rel="noreferrer"
                className="text-purple-400 underline inline-flex items-center gap-0.5"
              >
                Google Cloud Console <ExternalLink className="w-3 h-3" />
              </a>
              :
            </p>

            <ol className="text-[11px] text-gray-400 space-y-1.5 mb-5 list-decimal pl-4 bg-surface-2 p-3 rounded-xl border border-surface-border">
              <li>Create a Project & enable the <strong>Gmail API</strong>.</li>
              <li>Configure OAuth Consent Screen with <code>gmail.readonly</code> scope.</li>
              <li>Create <strong>OAuth Client ID</strong> (Web application).</li>
              <li>
                Add Authorized redirect URI:{" "}
                <code className="bg-background px-1.5 py-0.5 rounded text-purple-300 font-mono">
                  http://localhost:3000/api/gmail/callback
                </code>
              </li>
            </ol>

            {configError && (
              <div className="mb-4 p-2.5 rounded-lg bg-red-950/40 border border-red-800/60 text-xs text-red-300 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-red-400" />
                <span>{configError}</span>
              </div>
            )}

            <form onSubmit={handleSaveConfig} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1">
                  Google Client ID
                </label>
                <input
                  type="text"
                  value={clientIdInput}
                  onChange={(e) => setClientIdInput(e.target.value)}
                  placeholder="e.g. 123456789-abcdef.apps.googleusercontent.com"
                  className="w-full px-3.5 py-2 rounded-xl bg-surface-2 border border-surface-border text-gray-200 text-xs focus:outline-none focus:border-purple-500 font-mono"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1">
                  Google Client Secret
                </label>
                <input
                  type="password"
                  value={clientSecretInput}
                  onChange={(e) => setClientSecretInput(e.target.value)}
                  placeholder="GOCSPX-..."
                  className="w-full px-3.5 py-2 rounded-xl bg-surface-2 border border-surface-border text-gray-200 text-xs focus:outline-none focus:border-purple-500 font-mono"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowConfigModal(false)}
                  className="px-4 py-2 rounded-xl bg-surface-2 text-gray-300 hover:text-white text-xs font-medium transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingConfig}
                  className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold shadow-lg shadow-purple-600/20 transition disabled:opacity-50"
                >
                  {isSavingConfig ? "Saving & Connecting..." : "Save & Connect Gmail"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
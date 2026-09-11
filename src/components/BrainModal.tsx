"use client";

import { useState, useEffect } from "react";
import { X, Key, Plus, Check, Trash2, Cpu, Sparkles, ShieldCheck, AlertCircle, Eye, EyeOff } from "lucide-react";

interface ApiKeyRecord {
  id: string;
  label: string;
  provider: string;
  model: string;
  maskedKey: string;
  isActive: boolean;
  createdAt: string;
}

interface BrainModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBrainSwitched?: () => void;
}

export function BrainModal({ isOpen, onClose, onBrainSwitched }: BrainModalProps) {
  const [keys, setKeys] = useState<ApiKeyRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // Add form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [label, setLabel] = useState("");
  const [provider, setProvider] = useState("openai");
  const [model, setModel] = useState("gpt-4o");
  const [apiKey, setApiKey] = useState("");
  const [showKeyText, setShowKeyText] = useState(false);

  // Testing connection state
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const PROVIDER_DEFAULTS: Record<string, string> = {
    openai: "gpt-4o",
    anthropic: "claude-3-5-sonnet-20241022",
    google: "gemini-2.0-flash",
    openrouter: "google/gemini-2.0-flash-001",
  };

  useEffect(() => {
    if (isOpen) {
      fetchKeys();
    }
  }, [isOpen]);

  const fetchKeys = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/keys");
      const data = await res.json();
      setKeys(data.keys || []);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleProviderChange = (newProv: string) => {
    setProvider(newProv);
    setModel(PROVIDER_DEFAULTS[newProv] || "gpt-4o");
  };

  const handleTestConnection = async () => {
    if (!apiKey.trim()) {
      setTestResult({ success: false, message: "Please paste your API key first" });
      return;
    }
    setTesting(true);
    setTestResult(null);

    try {
      const res = await fetch("/api/keys/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, model, key: apiKey.trim() }),
      });
      const data = await res.json();
      setTestResult(data);
    } catch (err: any) {
      setTestResult({ success: false, message: err.message || "Failed to connect" });
    } finally {
      setTesting(false);
    }
  };

  const handleSaveKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!label.trim() || !apiKey.trim()) return;

    setSaving(true);
    setError(null);

    try {
      const res = await fetch("/api/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: label.trim(),
          provider,
          model,
          key: apiKey.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setLabel("");
      setApiKey("");
      setShowAddForm(false);
      setTestResult(null);
      fetchKeys();
      onBrainSwitched?.();
    } catch (err: any) {
      setError(err.message || "Failed to save key");
    } finally {
      setSaving(false);
    }
  };

  const handleActivateKey = async (id: string) => {
    try {
      const res = await fetch("/api/keys", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (res.ok) {
        fetchKeys();
        onBrainSwitched?.();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteKey = async (id: string) => {
    if (!confirm("Are you sure you want to delete this Brain key?")) return;
    try {
      await fetch("/api/keys", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      fetchKeys();
      onBrainSwitched?.();
    } catch (err) {
      console.error(err);
    }
  };

  if (!isOpen) return null;

  const activeKey = keys.find((k) => k.isActive);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-[96vw] sm:w-full max-w-2xl max-h-[92vh] bg-surface border border-surface-border rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-4 sm:px-6 py-3.5 sm:py-4 border-b border-surface-border flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Cpu className="w-5 h-5 text-purple-400" />
            <h2 className="font-bold text-base sm:text-lg text-white">Brain / AI Models</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-surface-2 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 sm:space-y-6 flex-1">
          {/* Active Brain Banner */}
          <div className="p-3.5 sm:p-4 rounded-xl bg-purple-950/20 border border-purple-800/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
            <div className="min-w-0 flex-1">
              <span className="text-[11px] font-semibold text-purple-400 uppercase tracking-wider">
                Current Active Brain
              </span>
              <div className="text-sm sm:text-base font-bold text-white mt-0.5 truncate">
                {activeKey ? `${activeKey.label} (${activeKey.model})` : "No Active Brain Key"}
              </div>
              <p className="text-xs text-gray-400 mt-0.5">
                {activeKey
                  ? "All translations, job evaluations, and form analysis run using this model."
                  : "Add an API key below to activate intelligent form matching and multilingual parsing."}
              </p>
            </div>
            {activeKey && (
              <span className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full bg-accent-emerald text-gray-950 shadow-md shadow-emerald-500/20 self-end sm:self-auto shrink-0">
                <Check className="w-3.5 h-3.5" />
                <span>Running</span>
              </span>
            )}
          </div>

          {/* Key List Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <h3 className="font-bold text-sm text-white">Saved Brain Keys</h3>
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent-blue hover:bg-blue-600 text-white text-xs font-semibold shadow-md shadow-blue-500/20 transition w-full sm:w-auto self-end sm:self-auto shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add New Key</span>
            </button>
          </div>

          {/* Add Key Form */}
          {showAddForm && (
            <form
              onSubmit={handleSaveKey}
              className="p-4 rounded-xl bg-surface-2 border border-purple-500/50 space-y-3 animate-in fade-in duration-150"
            >
              <div className="text-xs font-semibold text-purple-300">
                Configure New Model Intelligence
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* 1. Name of the key */}
                <div>
                  <label className="block text-[11px] font-medium text-gray-300 mb-1">
                    1. Name of the Key
                  </label>
                  <input
                    type="text"
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                    placeholder="e.g. GPT-4o Main, Claude Sonnet"
                    required
                    className="w-full px-3 py-2 rounded-lg bg-surface border border-surface-border text-xs text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
                  />
                </div>

                {/* Provider select */}
                <div>
                  <label className="block text-[11px] font-medium text-gray-300 mb-1">
                    AI Provider
                  </label>
                  <select
                    value={provider}
                    onChange={(e) => handleProviderChange(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-surface border border-surface-border text-xs text-white focus:outline-none focus:border-purple-500"
                  >
                    <option value="openai">OpenAI (GPT-4o, GPT-4o-mini)</option>
                    <option value="anthropic">Anthropic (Claude 3.5 Sonnet, Haiku)</option>
                    <option value="google">Google Gemini (Gemini 2.0 Flash, 1.5 Pro)</option>
                    <option value="openrouter">OpenRouter (All Providers)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-gray-300 mb-1">
                    Model Identifier
                  </label>
                  <input
                    type="text"
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    placeholder="e.g. gpt-4o, gemini-2.0-flash"
                    required
                    className="w-full px-3 py-2 rounded-lg bg-surface border border-surface-border text-xs text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
                  />
                </div>

                {/* 2. Box to submit the API key */}
                <div>
                  <label className="block text-[11px] font-medium text-gray-300 mb-1">
                    2. Submit API Key
                  </label>
                  <div className="relative">
                    <input
                      type={showKeyText ? "text" : "password"}
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder="sk-..."
                      required
                      className="w-full pl-3 pr-8 py-2 rounded-lg bg-surface border border-surface-border text-xs text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setShowKeyText(!showKeyText)}
                      className="absolute right-2 top-2.5 text-gray-400 hover:text-white"
                    >
                      {showKeyText ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              </div>

              {testResult && (
                <div
                  className={`p-2.5 rounded-lg text-xs flex items-center gap-2 ${
                    testResult.success
                      ? "bg-emerald-950/50 border border-emerald-800 text-emerald-300"
                      : "bg-red-950/50 border border-red-800 text-red-300"
                  }`}
                >
                  {testResult.success ? (
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-red-400" />
                  )}
                  <span>{testResult.message}</span>
                </div>
              )}

              {error && <div className="text-xs text-red-400">{error}</div>}

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={testing || !apiKey.trim()}
                  className="w-full sm:w-auto px-3 py-1.5 rounded-lg bg-surface border border-surface-border text-xs text-gray-300 hover:text-white disabled:opacity-50 text-center"
                >
                  {testing ? "Testing..." : "Test Connection"}
                </button>

                <div className="flex flex-col-reverse sm:flex-row gap-2 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={() => setShowAddForm(false)}
                    className="w-full sm:w-auto px-3 py-1.5 rounded-lg bg-surface border border-surface-border text-xs text-gray-300 hover:text-white text-center"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="w-full sm:w-auto px-4 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-xs font-semibold text-white transition shadow text-center"
                  >
                    {saving ? "Saving..." : "Save Key"}
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* Key List */}
          <div className="rounded-xl border border-surface-border overflow-hidden bg-surface-2/40">
            {keys.length === 0 ? (
              <div className="p-6 text-center text-xs text-gray-500">
                No API keys saved. Add your OpenAI, Claude, Gemini, or OpenRouter key to power the Brain.
              </div>
            ) : (
              <div className="divide-y divide-surface-border">
                {keys.map((k) => (
                  <div
                    key={k.id}
                    className={`p-3 sm:p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 transition ${
                      k.isActive ? "bg-purple-950/20" : "hover:bg-surface-2/80"
                    }`}
                  >
                    <div className="min-w-0 flex items-start sm:items-center gap-2.5 sm:gap-3 flex-1">
                      <div
                        className={`w-2.5 h-2.5 rounded-full shrink-0 mt-1 sm:mt-0 ${
                          k.isActive ? "bg-accent-emerald shadow-[0_0_8px_#10b981]" : "bg-gray-600"
                        }`}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-xs text-white truncate max-w-[160px] xs:max-w-[220px] sm:max-w-none">
                            {k.label}
                          </span>
                          <span className="text-[10px] uppercase font-mono px-1.5 py-0.2 rounded bg-surface border border-surface-border text-gray-300 shrink-0">
                            {k.provider} • {k.model}
                          </span>
                        </div>
                        <div className="text-[11px] font-mono text-gray-400 mt-0.5 truncate">
                          {k.maskedKey}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-auto shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-surface-border/40 w-full sm:w-auto justify-end">
                      {k.isActive ? (
                        <span className="px-2.5 py-1 rounded-lg bg-emerald-950/80 border border-emerald-800 text-accent-emerald text-[11px] font-semibold">
                          Active Brain
                        </span>
                      ) : (
                        <button
                          onClick={() => handleActivateKey(k.id)}
                          className="px-3 py-1 rounded-lg bg-surface-2 border border-surface-border hover:border-purple-500 hover:text-white text-gray-300 text-xs font-medium transition"
                        >
                          Switch to this
                        </button>
                      )}

                      <button
                        onClick={() => handleDeleteKey(k.id)}
                        className="p-1.5 rounded-lg text-gray-500 hover:text-accent-red hover:bg-red-950/40 transition"
                        title="Delete key"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 sm:px-6 py-3 sm:py-3.5 border-t border-surface-border bg-surface-2/50 flex justify-end">
          <button
            onClick={onClose}
            className="w-full sm:w-auto px-5 py-2 rounded-xl bg-surface-2 hover:bg-surface border border-surface-border text-xs font-semibold text-white transition text-center"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

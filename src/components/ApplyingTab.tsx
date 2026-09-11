"use client";

import { useState } from "react";
import {
  Copy,
  Check,
  Play,
  AlertTriangle,
  RefreshCw,
  Trash2,
  ArrowUp,
  ArrowDown,
  ExternalLink,
} from "lucide-react";

export interface Task {
  id: string;
  url: string;
  title: string | null;
  organization: string | null;
  status: string;
  queuePosition: number;
  detectedLang: string | null;
  missingQuestions: string | null;
  submittedData?: string | null;
  retryCount: number;
  failureReason: string | null;
  captchaDetected: boolean;
  appliedAt: string | null;
  createdAt: string;
}

interface ApplyingTabProps {
  tasks: Task[];
  failedTasks: Task[];
  isQueueRunning: boolean;
  onRefresh: () => void;
  onDeleteTask: (id: string) => void;
  onRetryFailed: (id: string) => void;
  onReorderTasks: (reorderedIds: string[]) => void;
  onApplySingle: (id: string) => Promise<void>;
}

export function ApplyingTab({
  tasks,
  failedTasks,
  isQueueRunning,
  onRefresh,
  onDeleteTask,
  onRetryFailed,
  onReorderTasks,
  onApplySingle,
}: ApplyingTabProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [applyingSingleId, setApplyingSingleId] = useState<string | null>(null);

  const handleCopy = (id: string, url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleSingleApplyClick = async (id: string) => {
    setApplyingSingleId(id);
    try {
      await onApplySingle(id);
    } finally {
      setApplyingSingleId(null);
    }
  };

  const moveTask = (index: number, direction: "up" | "down") => {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= tasks.length) return;

    const newTasks = [...tasks];
    const [moved] = newTasks.splice(index, 1);
    newTasks.splice(targetIndex, 0, moved);

    onReorderTasks(newTasks.map((t) => t.id));
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-4">
      {tasks.length === 0 && failedTasks.length === 0 ? (
        <div className="p-12 rounded-2xl bg-surface border border-surface-border text-center">
          <p className="text-gray-400 text-sm">No jobs currently in the applying queue.</p>
          <p className="text-gray-500 text-xs mt-1">
            Paste job links in the box above to start applying automatically.
          </p>
        </div>
      ) : null}

      {/* Applying Queue */}
      {tasks.length > 0 && (
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs text-gray-400 px-1">
            <span className="font-semibold text-gray-300">Execution Sequence ({tasks.length} in queue)</span>
            <span className="text-[11px] text-gray-500">Processes 1 job at a time • Or click ▶ to apply now</span>
          </div>

          {tasks.map((task, index) => {
            const isCurrentlyProcessing =
              (index === 0 && isQueueRunning) || applyingSingleId === task.id;

            return (
              <div
                key={task.id}
                className={`p-3.5 sm:p-4 rounded-xl bg-surface border transition shadow-lg relative group ${
                  isCurrentlyProcessing
                    ? "border-accent-blue/80 shadow-blue-500/10 ring-1 ring-accent-blue/30"
                    : "border-surface-border hover:border-gray-700"
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
                  {/* Left: Drag / Order Controls & Info */}
                  <div className="flex items-start sm:items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
                    {/* Order controls */}
                    <div className="flex flex-col items-center justify-center shrink-0 text-gray-500 pt-0.5 sm:pt-0">
                      <button
                        onClick={() => moveTask(index, "up")}
                        disabled={index === 0}
                        className="hover:text-white disabled:opacity-20 transition p-0.5"
                        title="Move Up"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <span className="text-[10px] font-mono font-bold text-gray-400">
                        #{index + 1}
                      </span>
                      <button
                        onClick={() => moveTask(index, "down")}
                        disabled={index === tasks.length - 1}
                        className="hover:text-white disabled:opacity-20 transition p-0.5"
                        title="Move Down"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-sm sm:text-base text-white truncate max-w-[200px] xs:max-w-[260px] sm:max-w-none">
                          {task.title || "Pending extraction..."}
                        </h3>
                        {task.detectedLang && task.detectedLang !== "en" && (
                          <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-surface-2 border border-surface-border text-gray-400 shrink-0">
                            {task.detectedLang} → EN
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-400 flex-wrap">
                        <span className="font-semibold text-gray-300">
                          {task.organization || "Company"}
                        </span>
                        <span>•</span>
                        {isCurrentlyProcessing ? (
                          <span className="flex items-center gap-1.5 text-accent-blue font-medium">
                            <span className="w-2 h-2 rounded-full bg-accent-blue animate-ping" />
                            <span>Currently Applying...</span>
                          </span>
                        ) : (
                          <span className="text-gray-500">Waiting in queue</span>
                        )}
                        {task.retryCount > 0 && (
                          <span className="text-accent-amber text-[11px]">
                            (Retry {task.retryCount}/3)
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right Actions */}
                  <div className="flex items-center gap-2 self-end sm:self-auto shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-surface-border/40 w-full sm:w-auto justify-end">
                    {/* Start Only This Task Button */}
                    <button
                      onClick={() => handleSingleApplyClick(task.id)}
                      disabled={isCurrentlyProcessing || applyingSingleId !== null}
                      className="flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-950/60 border border-emerald-800/80 hover:bg-emerald-900/80 text-accent-emerald transition disabled:opacity-40"
                      title="Start applying to this job now (moves to bottom & applies)"
                    >
                      {applyingSingleId === task.id ? (
                        <span className="w-3.5 h-3.5 border-2 border-accent-emerald border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Play className="w-3.5 h-3.5 fill-current" />
                      )}
                    </button>

                    {/* Copy Button (Icon only) */}
                    <button
                      onClick={() => handleCopy(task.id, task.url)}
                      className="p-2 rounded-lg bg-surface-2 border border-surface-border hover:border-gray-600 text-gray-400 hover:text-white transition"
                      title={copiedId === task.id ? "Copied to clipboard!" : "Copy Job Link"}
                    >
                      {copiedId === task.id ? (
                        <Check className="w-3.5 h-3.5 text-accent-emerald" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>

                    {/* Open in new tab */}
                    <a
                      href={task.url}
                      target="_blank"
                      rel="noreferrer"
                      className="p-2 rounded-lg bg-surface-2 border border-surface-border hover:border-gray-600 text-gray-400 hover:text-white transition"
                      title="Open Link in New Tab"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>

                    {/* Cancel Job */}
                    <button
                      onClick={() => onDeleteTask(task.id)}
                      className="p-2 rounded-lg hover:bg-red-950/40 text-gray-500 hover:text-accent-red border border-transparent hover:border-red-800/40 transition"
                      title="Cancel Job"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Failed Tasks Section */}
      {failedTasks.length > 0 && (
        <div className="mt-8 pt-6 border-t border-surface-border/60">
          <div className="flex items-center gap-2 text-xs font-semibold text-accent-red mb-3">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>Failed Jobs ({failedTasks.length}) — Click Retry to attempt again</span>
          </div>

          <div className="space-y-3">
            {failedTasks.map((task) => (
              <div
                key={task.id}
                className="p-3.5 sm:p-4 rounded-xl bg-red-950/20 border border-red-900/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4"
              >
                <div className="min-w-0 flex-1">
                  <h4 className="font-medium text-sm text-gray-200 truncate">
                    {task.title || "Job Application"}
                  </h4>
                  <div className="text-xs text-gray-400 mt-0.5">
                    {task.organization || "Company"}
                  </div>
                  {task.failureReason && (
                    <div className="text-[11px] text-red-400 mt-1 font-mono break-words">
                      {task.failureReason}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 self-end sm:self-auto shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-red-900/30 w-full sm:w-auto justify-end">
                  <button
                    onClick={() => handleCopy(task.id, task.url)}
                    className="p-2 rounded-lg bg-surface-2 border border-surface-border text-gray-400 hover:text-white transition"
                    title={copiedId === task.id ? "Copied!" : "Copy Job Link"}
                  >
                    {copiedId === task.id ? (
                      <Check className="w-3.5 h-3.5 text-accent-emerald" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                  <button
                    onClick={() => onRetryFailed(task.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent-blue hover:bg-blue-600 text-white font-medium text-xs transition"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Retry</span>
                  </button>
                  <button
                    onClick={() => onDeleteTask(task.id)}
                    className="p-2 rounded-lg hover:bg-red-900/40 text-gray-400 hover:text-white transition"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

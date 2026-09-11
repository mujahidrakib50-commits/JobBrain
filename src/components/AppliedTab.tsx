"use client";

import { useState } from "react";
import { Task } from "./ApplyingTab";
import {
  Copy,
  Check,
  CheckCircle2,
  Calendar,
  Trash2,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  FileText,
  Lock,
  ArrowUpDown,
} from "lucide-react";

interface AppliedTabProps {
  tasks: Task[];
  onDeleteTask: (id: string) => void;
}

export function AppliedTab({ tasks, onDeleteTask }: AppliedTabProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expandedTaskIds, setExpandedTaskIds] = useState<Record<string, boolean>>({});
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "title" | "company">("newest");

  const handleCopy = (e: React.MouseEvent, id: string, url: string) => {
    e.stopPropagation();
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const toggleAccordion = (taskId: string) => {
    setExpandedTaskIds((prev) => ({
      ...prev,
      [taskId]: !prev[taskId],
    }));
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "Recently completed";
    const d = new Date(dateStr);
    return d.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  // Sort tasks according to selected order (Newest at top as default)
  const sortedTasks = [...tasks].sort((a, b) => {
    if (sortBy === "newest") {
      const timeA = new Date(a.appliedAt || a.createdAt).getTime();
      const timeB = new Date(b.appliedAt || b.createdAt).getTime();
      return timeB - timeA;
    }
    if (sortBy === "oldest") {
      const timeA = new Date(a.appliedAt || a.createdAt).getTime();
      const timeB = new Date(b.appliedAt || b.createdAt).getTime();
      return timeA - timeB;
    }
    if (sortBy === "title") {
      return (a.title || "").localeCompare(b.title || "");
    }
    if (sortBy === "company") {
      return (a.organization || "").localeCompare(b.organization || "");
    }
    return 0;
  });

  return (
    <div className="w-full max-w-4xl mx-auto space-y-3">
      {tasks.length > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-1 px-1">
          <div className="text-xs text-gray-400">
            <span>{tasks.length} {tasks.length === 1 ? "application" : "applications"} submitted</span>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <span className="text-xs text-gray-400 flex items-center gap-1">
              <ArrowUpDown className="w-3 h-3 text-gray-400" />
              <span>Sort:</span>
            </span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-2.5 py-1 rounded-lg bg-surface-2 border border-surface-border text-xs text-gray-200 focus:outline-none focus:border-accent-emerald transition cursor-pointer"
            >
              <option value="newest">Newest at top (Default)</option>
              <option value="oldest">Oldest First</option>
              <option value="title">Job Title (A-Z)</option>
              <option value="company">Company (A-Z)</option>
            </select>
          </div>
        </div>
      )}

      {tasks.length === 0 ? (
        <div className="p-12 rounded-2xl bg-surface border border-surface-border text-center">
          <p className="text-gray-400 text-sm">No applications submitted yet.</p>
          <p className="text-gray-500 text-xs mt-1">
            When a job application is successfully submitted by the AI, it will appear here with the exact completion timestamp and submitted data history.
          </p>
        </div>
      ) : null}

      {sortedTasks.map((task) => {
        const isExpanded = !!expandedTaskIds[task.id];

        // Parse submitted data history
        let submittedFields: any[] = [];
        const rawData = task.submittedData || task.missingQuestions;
        if (rawData) {
          try {
            submittedFields = JSON.parse(rawData);
          } catch {}
        }

        return (
          <div
            key={task.id}
            className={`rounded-xl bg-surface border transition-all overflow-hidden ${
              isExpanded
                ? "border-accent-emerald/70 shadow-xl shadow-emerald-500/5 ring-1 ring-accent-emerald/30"
                : "border-surface-border hover:border-gray-700"
            }`}
          >
            {/* 1-Line Accordion Header */}
            <div
              onClick={() => toggleAccordion(task.id)}
              className="p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer select-none bg-surface hover:bg-surface-2/60 transition"
            >
              {/* Left Info */}
              <div className="flex items-start sm:items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
                <div className="w-2.5 h-2.5 rounded-full bg-accent-emerald shadow-[0_0_8px_#10b981] shrink-0 mt-1.5 sm:mt-0" />

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-sm sm:text-base text-white truncate max-w-[200px] xs:max-w-[260px] sm:max-w-none">
                      {task.title || "Job Application"}
                    </h3>
                    <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-950/60 border border-emerald-800 text-accent-emerald uppercase tracking-wider shrink-0">
                      <CheckCircle2 className="w-3 h-3" />
                      <span>Submitted</span>
                    </span>
                  </div>

                  <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-400 flex-wrap">
                    <span className="font-semibold text-gray-300">
                      {task.organization || "Company"}
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1 text-gray-400">
                      <Calendar className="w-3 h-3 text-gray-500" />
                      <span>{formatDate(task.appliedAt || task.createdAt)}</span>
                    </span>
                  </div>
                </div>
              </div>

              {/* Right Controls */}
              <div className="flex items-center gap-2 self-end sm:self-auto shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-surface-border/40 w-full sm:w-auto justify-end">
                {/* Icon-only Copy Button */}
                <button
                  onClick={(e) => handleCopy(e, task.id, task.url)}
                  className="p-2 rounded-lg bg-surface-2 border border-surface-border hover:border-gray-600 text-gray-400 hover:text-white text-xs transition"
                  title={copiedId === task.id ? "Copied!" : "Copy Job Link"}
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
                  onClick={(e) => e.stopPropagation()}
                  className="p-2 rounded-lg bg-surface-2 border border-surface-border hover:border-gray-600 text-gray-400 hover:text-white transition"
                  title="Open Link"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>

                {/* Delete from history */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteTask(task.id);
                  }}
                  className="p-2 rounded-lg hover:bg-red-950/40 text-gray-500 hover:text-accent-red border border-transparent hover:border-red-800/40 transition"
                  title="Remove From History"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>

                {/* Chevron */}
                <div className="p-1 text-gray-400">
                  {isExpanded ? (
                    <ChevronUp className="w-4 h-4 text-accent-emerald" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )}
                </div>
              </div>
            </div>

            {/* Accordion Slide-Down Content (Read-Only Submitted Data History) */}
            {isExpanded && (
              <div className="border-t border-surface-border p-5 space-y-4 bg-surface-2/30 animate-in fade-in duration-200">
                <div className="flex items-center justify-between text-xs text-gray-400">
                  <div className="flex items-center gap-1.5 font-semibold text-gray-200">
                    <Lock className="w-3.5 h-3.5 text-accent-emerald" />
                    <span>Submitted Application Data History (Read-Only)</span>
                  </div>
                  <span className="text-[11px] text-gray-500">
                    Exact values sent to employer • Cannot be changed
                  </span>
                </div>

                {submittedFields.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {submittedFields.map((field: any, idx: number) => {
                      const val = field.currentVal || field.value || "";
                      const isFile = field.type === "file" || field.isAttachment;

                      return (
                        <div
                          key={field.id || idx}
                          className={`p-3.5 rounded-xl bg-surface-2/70 border border-surface-border space-y-1 ${
                            isFile ? "sm:col-span-2" : ""
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-semibold text-gray-300 truncate">
                              {field.questionEn || field.questionOriginal || `Field #${idx + 1}`}
                            </span>
                            <span className="text-[10px] uppercase font-bold text-accent-emerald bg-emerald-950/60 border border-emerald-800/80 px-1.5 py-0.5 rounded">
                              Submitted
                            </span>
                          </div>

                          {field.questionOriginal &&
                            field.questionOriginal !== field.questionEn && (
                              <div className="text-[10px] text-gray-500 truncate font-mono">
                                Original: {field.questionOriginal}
                              </div>
                            )}

                          <div className="pt-1 text-xs font-mono text-white break-words">
                            {isFile ? (
                              <div className="flex items-center gap-1.5 text-accent-emerald">
                                <FileText className="w-3.5 h-3.5 shrink-0" />
                                <span>Attached: {val ? val.split(/[/\\]/).pop() : "File attached"}</span>
                              </div>
                            ) : field.type === "checkbox" ? (
                              <span>{/true|yes|1/i.test(val) ? "Agreed & Checked (true)" : "Unchecked"}</span>
                            ) : val ? (
                              <span>{val}</span>
                            ) : (
                              <span className="text-gray-500 italic">Left empty (optional)</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-4 rounded-xl bg-surface-2/50 border border-surface-border text-xs text-gray-400">
                    Application successfully submitted to {task.organization || "employer"} on{" "}
                    {formatDate(task.appliedAt || task.createdAt)}.
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

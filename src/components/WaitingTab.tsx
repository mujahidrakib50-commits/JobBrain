"use client";

import { useState, useEffect } from "react";
import { Task } from "./ApplyingTab";
import {
  Copy,
  Check,
  RotateCcw,
  ShieldAlert,
  Sparkles,
  Trash2,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  FileText,
  Upload,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

interface WaitingTabProps {
  tasks: Task[];
  onRefresh: () => void;
  onDeleteTask: (id: string) => void;
}

export function WaitingTab({ tasks, onRefresh, onDeleteTask }: WaitingTabProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expandedTaskIds, setExpandedTaskIds] = useState<Record<string, boolean>>({});
  const [taskFormValues, setTaskFormValues] = useState<Record<string, Record<string, string>>>({});
  const [profileAttachments, setProfileAttachments] = useState<any[]>([]);
  const [restartingId, setRestartingId] = useState<string | null>(null);
  const [notification, setNotification] = useState<{
    taskId: string;
    type: "success" | "error" | "info";
    text: string;
  } | null>(null);

  useEffect(() => {
    fetch("/api/profile/attachments")
      .then((res) => res.json())
      .then((data) => {
        if (data.attachments) setProfileAttachments(data.attachments);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    setTaskFormValues((prev) => {
      const next = { ...prev };
      for (const task of tasks) {
        if (!next[task.id] && task.missingQuestions) {
          try {
            const fields = JSON.parse(task.missingQuestions);
            if (Array.isArray(fields)) {
              next[task.id] = {};
              for (const f of fields) {
                const key = f.id || f.selector || f.questionEn;
                next[task.id][key] = f.currentVal || "";
              }
            }
          } catch {}
        }
      }
      return next;
    });

    if (tasks.length > 0) {
      setExpandedTaskIds((prev) => {
        if (Object.keys(prev).length === 0) {
          return { [tasks[0].id]: true };
        }
        return prev;
      });
    }
  }, [tasks]);

  const toggleAccordion = (taskId: string) => {
    setExpandedTaskIds((prev) => ({
      ...prev,
      [taskId]: !prev[taskId],
    }));
  };

  const handleCopy = (e: React.MouseEvent, id: string, url: string) => {
    e.stopPropagation();
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleFieldValueChange = (taskId: string, fieldKey: string, val: string) => {
    setTaskFormValues((prev) => ({
      ...prev,
      [taskId]: {
        ...(prev[taskId] || {}),
        [fieldKey]: val,
      },
    }));
  };

  const handleFileUpload = async (taskId: string, fieldKey: string, question: string, file: File) => {
    const formData = new FormData();
    formData.append("question", question);
    formData.append("file", file);

    try {
      const res = await fetch("/api/profile/attachments", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (res.ok && data.attachment) {
        setProfileAttachments((prev) => [...prev, data.attachment]);
        handleFieldValueChange(taskId, fieldKey, data.attachment.fileUrl);
      }
    } catch (e) {
      console.error("Upload error:", e);
    }
  };

  const handleRestart = async (task: Task, fields: any[]) => {
    setRestartingId(task.id);
    setNotification(null);

    const currentTaskVals = taskFormValues[task.id] || {};
    const payload = fields.map((f) => {
      const key = f.id || f.selector || f.questionEn;
      return {
        question: f.questionEn || f.questionOriginal || "",
        selector: f.selector,
        answer: currentTaskVals[key] !== undefined ? currentTaskVals[key] : f.currentVal || "",
      };
    });

    try {
      const res = await fetch(`/api/tasks/${task.id}/restart`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: payload }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Restart failed");

      if (data.resolved) {
        setNotification({
          taskId: task.id,
          type: "success",
          text: "All required fields resolved! Task moved to front of Applying queue.",
        });
        setTimeout(() => {
          onRefresh();
        }, 1200);
      } else {
        setNotification({
          taskId: task.id,
          type: "info",
          text: `Updated! ${data.remaining} required field(s) still need an answer before submitting.`,
        });
        onRefresh();
      }
    } catch (err: any) {
      setNotification({
        taskId: task.id,
        type: "error",
        text: err.message || "Failed to restart task",
      });
    } finally {
      setRestartingId(null);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-3">
      {tasks.length === 0 ? (
        <div className="p-12 rounded-2xl bg-surface border border-surface-border text-center">
          <p className="text-gray-400 text-sm">No jobs waiting for input.</p>
          <p className="text-gray-500 text-xs mt-1">
            When a job application requires fields not yet in your profile, it will appear here for you to review and answer.
          </p>
        </div>
      ) : null}

      {tasks.map((task) => {
        let fields: any[] = [];
        if (task.missingQuestions) {
          try {
            fields = JSON.parse(task.missingQuestions);
          } catch {}
        }

        const isExpanded = !!expandedTaskIds[task.id];
        const taskVals = taskFormValues[task.id] || {};

        // Calculate required missing count
        let requiredTotal = 0;
        let requiredFilled = 0;
        let optionalTotal = 0;

        for (const f of fields) {
          const key = f.id || f.selector || f.questionEn;
          const val = taskVals[key] !== undefined ? taskVals[key] : f.currentVal || "";
          const hasVal = val && val.trim().length > 0;

          if (f.isRequired) {
            requiredTotal++;
            if (hasVal) requiredFilled++;
          } else {
            optionalTotal++;
          }
        }
        const requiredMissing = requiredTotal - requiredFilled;

        return (
          <div
            key={task.id}
            className={`rounded-xl bg-surface border transition-all overflow-hidden ${
              isExpanded
                ? "border-accent-amber/70 shadow-xl shadow-amber-500/5 ring-1 ring-accent-amber/30"
                : "border-surface-border hover:border-gray-700"
            }`}
          >
            {/* 1-Line Compact Accordion Header */}
            <div
              onClick={() => toggleAccordion(task.id)}
              className="p-4 flex items-center justify-between gap-3 cursor-pointer select-none bg-surface hover:bg-surface-2/60 transition"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                    requiredMissing === 0
                      ? "bg-accent-emerald shadow-[0_0_8px_#10b981]"
                      : "bg-accent-amber shadow-[0_0_8px_#f59e0b]"
                  }`}
                />

                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-sm sm:text-base text-white truncate">
                      {task.title || "Job Application"}
                    </h3>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${
                        requiredMissing === 0
                          ? "bg-emerald-950/60 border border-emerald-800 text-accent-emerald"
                          : "bg-amber-950/60 border border-amber-800/80 text-accent-amber"
                      }`}
                    >
                      {requiredMissing === 0 ? "Ready to Apply" : `${requiredMissing} Required Missing`}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-400">
                    <span className="font-semibold text-gray-300">
                      {task.organization || "Company"}
                    </span>
                    <span>•</span>
                    <span className="text-gray-400">
                      {requiredFilled} of {requiredTotal} required filled
                      {optionalTotal > 0 ? ` (${optionalTotal} optional)` : ""}
                    </span>
                  </div>
                </div>
              </div>

              {/* Right Controls */}
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={(e) => handleCopy(e, task.id, task.url)}
                  className="p-2 rounded-lg bg-surface-2 border border-surface-border hover:border-gray-600 text-gray-400 hover:text-white transition"
                  title={copiedId === task.id ? "Copied!" : "Copy Link"}
                >
                  {copiedId === task.id ? (
                    <Check className="w-3.5 h-3.5 text-accent-emerald" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>

                <a
                  href={task.url}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="p-1.5 rounded-lg bg-surface-2 border border-surface-border hover:border-gray-600 text-gray-400 hover:text-white transition"
                  title="Open in Browser"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteTask(task.id);
                  }}
                  className="p-1.5 rounded-lg hover:bg-red-950/40 text-gray-500 hover:text-accent-red border border-transparent hover:border-red-800/40 transition"
                  title="Remove Job"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>

                <div className="p-1 text-gray-400">
                  {isExpanded ? (
                    <ChevronUp className="w-4 h-4 text-accent-amber" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )}
                </div>
              </div>
            </div>

            {/* Accordion Slide-Down Content */}
            {isExpanded && (
              <div className="border-t border-surface-border p-5 space-y-5 bg-surface-2/30 animate-in fade-in duration-200">
                {task.captchaDetected && (
                  <div className="p-3.5 rounded-xl bg-amber-950/30 border border-accent-amber/50 flex items-start gap-2.5 text-xs text-amber-200">
                    <ShieldAlert className="w-4 h-4 text-accent-amber shrink-0 mt-0.5" />
                    <div>
                      <span className="font-semibold text-accent-amber">CAPTCHA Detected:</span>{" "}
                      This job application page has human verification. Please open the link in your browser to solve it or fill any fields below and restart.
                    </div>
                  </div>
                )}

                {notification && notification.taskId === task.id && (
                  <div
                    className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                      notification.type === "success"
                        ? "bg-emerald-950/40 border border-emerald-800 text-emerald-300"
                        : notification.type === "error"
                        ? "bg-red-950/40 border border-red-800 text-red-300"
                        : "bg-amber-950/40 border border-amber-800 text-amber-300"
                    }`}
                  >
                    <span>{notification.text}</span>
                  </div>
                )}

                {/* Form Fields List */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs text-gray-400">
                    <span className="font-semibold text-gray-300">
                      Application Form Fields:
                    </span>
                    <span className="text-[11px] text-gray-500">
                      Optional fields can be left blank if not desired
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {fields.map((field, idx) => {
                      const key = field.id || field.selector || field.questionEn;
                      const currentVal =
                        taskVals[key] !== undefined ? taskVals[key] : field.currentVal || "";
                      const hasVal = currentVal && currentVal.trim().length > 0;
                      const isFile = field.type === "file" || field.isAttachment;
                      const isRequired = field.isRequired;

                      return (
                        <div
                          key={field.id || idx}
                          className={`p-3.5 rounded-xl border transition ${
                            hasVal
                              ? "bg-surface-2/60 border-surface-border"
                              : isRequired
                              ? "bg-amber-950/10 border-accent-amber/40"
                              : "bg-surface-2/30 border-surface-border/60"
                          } ${isFile ? "sm:col-span-2" : ""}`}
                        >
                          <div className="flex items-center justify-between gap-2 mb-1.5">
                            <label className="text-xs font-semibold text-white truncate">
                              {field.questionEn || field.questionOriginal || `Field #${idx + 1}`}
                            </label>

                            <div className="flex items-center gap-1.5 shrink-0">
                              {hasVal ? (
                                <span className="flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-950/70 border border-emerald-800 text-accent-emerald">
                                  <CheckCircle2 className="w-2.5 h-2.5" />
                                  <span>Filled</span>
                                </span>
                              ) : isRequired ? (
                                <span className="flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-950/70 border border-amber-800 text-accent-amber">
                                  <AlertCircle className="w-2.5 h-2.5" />
                                  <span>Required</span>
                                </span>
                              ) : (
                                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-surface border border-surface-border text-gray-400">
                                  Optional
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Original language subtitle if different */}
                          {field.questionOriginal &&
                            field.questionOriginal !== field.questionEn && (
                              <div className="text-[10px] text-gray-500 mb-2 truncate font-mono">
                                Original label: {field.questionOriginal}
                              </div>
                            )}

                          {/* Input Type Handling */}
                          {isFile ? (
                            <div className="space-y-2 pt-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                {profileAttachments.length > 0 && (
                                  <select
                                    value={currentVal}
                                    onChange={(e) =>
                                      handleFieldValueChange(task.id, key, e.target.value)
                                    }
                                    className="px-3 py-1.5 rounded-lg bg-surface border border-surface-border text-xs text-white focus:outline-none focus:border-accent-blue"
                                  >
                                    <option value="">-- Choose From Saved Profile Attachments --</option>
                                    {profileAttachments.map((att) => (
                                      <option key={att.id} value={att.fileUrl}>
                                        {att.question} ({att.filename})
                                      </option>
                                    ))}
                                  </select>
                                )}

                                <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-2 border border-surface-border hover:border-gray-600 text-gray-200 text-xs cursor-pointer font-medium transition">
                                  <Upload className="w-3.5 h-3.5 text-accent-blue" />
                                  <span>Upload New Document</span>
                                  <input
                                    type="file"
                                    className="hidden"
                                    onChange={(e) => {
                                      const f = e.target.files?.[0];
                                      if (f) {
                                        handleFileUpload(
                                          task.id,
                                          key,
                                          field.questionEn || "Document",
                                          f
                                        );
                                      }
                                    }}
                                  />
                                </label>
                              </div>

                              {hasVal && (
                                <div className="text-[11px] text-accent-emerald flex items-center gap-1.5 font-mono">
                                  <FileText className="w-3 h-3" />
                                  <span>Attached: {currentVal.split(/[/\\]/).pop()}</span>
                                </div>
                              )}
                            </div>
                          ) : field.type === "textarea" ? (
                            <textarea
                              rows={2}
                              value={currentVal}
                              onChange={(e) =>
                                handleFieldValueChange(task.id, key, e.target.value)
                              }
                              placeholder={
                                field.placeholder ||
                                (isRequired
                                  ? "Type required answer here..."
                                  : "Optional — type if you want to include, or leave empty")
                              }
                              className="w-full px-3 py-2 rounded-lg bg-surface border border-surface-border text-xs text-white placeholder-gray-500 focus:outline-none focus:border-accent-blue resize-y"
                            />
                          ) : field.type === "select" && field.options && field.options.length > 0 ? (
                            <select
                              value={currentVal}
                              onChange={(e) =>
                                handleFieldValueChange(task.id, key, e.target.value)
                              }
                              className="w-full px-3 py-2 rounded-lg bg-surface border border-surface-border text-xs text-white focus:outline-none focus:border-accent-blue"
                            >
                              <option value="">-- Choose Option --</option>
                              {field.options.map((opt: string) => (
                                <option key={opt} value={opt}>
                                  {opt}
                                </option>
                              ))}
                            </select>
                          ) : field.type === "checkbox" ? (
                            <div className="flex items-center gap-2 pt-1">
                              <input
                                type="checkbox"
                                checked={/true|yes|1/i.test(currentVal)}
                                onChange={(e) =>
                                  handleFieldValueChange(
                                    task.id,
                                    key,
                                    e.target.checked ? "true" : "false"
                                  )
                                }
                                className="w-4 h-4 rounded bg-surface border-surface-border text-accent-blue focus:ring-0"
                              />
                              <span className="text-xs text-gray-300">
                                {field.questionEn || "Agree / Confirm"}
                              </span>
                            </div>
                          ) : (
                            <input
                              type={
                                field.type === "email"
                                  ? "email"
                                  : field.type === "tel"
                                  ? "tel"
                                  : "text"
                              }
                              value={currentVal}
                              onChange={(e) =>
                                handleFieldValueChange(task.id, key, e.target.value)
                              }
                              placeholder={
                                field.placeholder ||
                                (isRequired
                                  ? "Type required answer here..."
                                  : "Optional — leave empty to skip")
                              }
                              className="w-full px-3 py-2 rounded-lg bg-surface border border-surface-border text-xs text-white placeholder-gray-500 focus:outline-none focus:border-accent-blue"
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Action Bar */}
                <div className="pt-3 border-t border-surface-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-1.5 text-[11px] text-gray-400">
                    <Sparkles className="w-3.5 h-3.5 text-accent-blue shrink-0" />
                    <span>
                      {requiredMissing === 0
                        ? "All required fields are ready! Click Restart to apply."
                        : `${requiredMissing} required field(s) need your input before applying.`}
                    </span>
                  </div>

                  <button
                    onClick={() => handleRestart(task, fields)}
                    disabled={restartingId === task.id}
                    className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-accent-blue hover:bg-blue-600 disabled:opacity-50 text-white font-semibold text-xs transition shadow-lg shadow-blue-500/20 shrink-0"
                  >
                    {restartingId === task.id ? (
                      <>
                        <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Evaluating...</span>
                      </>
                    ) : (
                      <>
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Restart Application</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

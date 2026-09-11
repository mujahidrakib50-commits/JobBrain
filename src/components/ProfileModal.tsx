"use client";

import { useState, useEffect, useRef } from "react";
import { X, Plus, Paperclip, Trash2, Upload, User, Check, AlertCircle, FileText } from "lucide-react";

interface ProfileField {
  id: string;
  question: string;
  answer: string;
  createdAt: string;
}

interface Attachment {
  id: string;
  question: string;
  filename: string;
  mimeType: string;
  createdAt: string;
}

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProfileUpdated?: () => void;
}

export function ProfileModal({ isOpen, onClose, onProfileUpdated }: ProfileModalProps) {
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [fields, setFields] = useState<ProfileField[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(true);

  // Add Q&A state
  const [showAddForm, setShowAddForm] = useState(false);
  const [newQuestion, setNewQuestion] = useState("");
  const [newAnswer, setNewAnswer] = useState("");
  const [savingField, setSavingField] = useState(false);

  // Attach state
  const [showAttachForm, setShowAttachForm] = useState(false);
  const [attachQuestion, setAttachQuestion] = useState("");
  const [attachFile, setAttachFile] = useState<File | null>(null);
  const [uploadingAttach, setUploadingAttach] = useState(false);

  // Avatar upload
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchProfile();
    }
  }, [isOpen]);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/profile");
      const data = await res.json();
      if (data.profile) {
        setAvatarUrl(data.profile.avatarUrl || null);
        setFields(data.profile.fields || []);
        setAttachments(data.profile.attachments || []);
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingAvatar(true);
    const formData = new FormData();
    formData.append("avatar", file);

    try {
      const res = await fetch("/api/profile/avatar", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (res.ok && data.avatarUrl) {
        setAvatarUrl(data.avatarUrl);
        setMessage({ type: "success", text: "Profile picture updated!" });
        onProfileUpdated?.();
      }
    } catch (err: any) {
      setMessage({ type: "error", text: "Failed to upload avatar" });
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleAddField = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newQuestion.trim() || !newAnswer.trim()) return;

    setSavingField(true);
    try {
      const res = await fetch("/api/profile/fields", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: newQuestion.trim(), answer: newAnswer.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setNewQuestion("");
      setNewAnswer("");
      setShowAddForm(false);
      setMessage({ type: "success", text: "Profile field saved permanently!" });
      fetchProfile();
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "Failed to save field" });
    } finally {
      setSavingField(false);
    }
  };

  const handleDeleteField = async (id: string) => {
    if (!confirm("Are you sure? This data will be permanently removed and never used in applications.")) {
      return;
    }
    try {
      await fetch("/api/profile/fields", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      fetchProfile();
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddAttachment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!attachQuestion.trim() || !attachFile) return;

    setUploadingAttach(true);
    const formData = new FormData();
    formData.append("question", attachQuestion.trim());
    formData.append("file", attachFile);

    try {
      const res = await fetch("/api/profile/attachments", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setAttachQuestion("");
      setAttachFile(null);
      setShowAttachForm(false);
      setMessage({ type: "success", text: "Attachment uploaded and saved permanently!" });
      fetchProfile();
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "Failed to upload attachment" });
    } finally {
      setUploadingAttach(false);
    }
  };

  const handleDeleteAttachment = async (id: string) => {
    if (!confirm("Delete attachment permanently? It will be removed from disk and never used again.")) {
      return;
    }
    try {
      await fetch("/api/profile/attachments", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      fetchProfile();
    } catch (err) {
      console.error(err);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-[96vw] sm:w-full max-w-3xl max-h-[92vh] bg-surface border border-surface-border rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-4 sm:px-6 py-3.5 sm:py-4 border-b border-surface-border flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <User className="w-5 h-5 text-accent-blue" />
            <h2 className="font-bold text-base sm:text-lg text-white">Application Profile</h2>
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
          {message && (
            <div
              className={`p-3 rounded-xl text-xs flex items-center justify-between ${
                message.type === "success"
                  ? "bg-emerald-950/40 border border-emerald-800 text-emerald-300"
                  : "bg-red-950/40 border border-red-800 text-red-300"
              }`}
            >
              <span>{message.text}</span>
              <button onClick={() => setMessage(null)}>
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Profile Picture (Circled view with upload) */}
          <div className="flex flex-col sm:flex-row items-center sm:items-start text-center sm:text-left gap-3.5 sm:gap-5 p-4 rounded-xl bg-surface-2/60 border border-surface-border">
            <div className="relative group shrink-0">
              <div className="w-20 h-20 rounded-full border-2 border-accent-blue/50 overflow-hidden bg-surface-2 flex items-center justify-center shadow-lg mx-auto">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <User className="w-8 h-8 text-gray-400" />
                )}
              </div>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingAvatar}
                className="absolute inset-0 rounded-full bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition text-xs font-semibold"
              >
                <Upload className="w-4 h-4" />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarChange}
                className="hidden"
              />
            </div>

            <div className="flex-1">
              <h3 className="font-semibold text-sm text-white">Profile Photo</h3>
              <p className="text-xs text-gray-400 mt-0.5">
                Used for applications that require a candidate photo.
              </p>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingAvatar}
                className="mt-2 text-xs font-medium text-accent-blue hover:underline"
              >
                {uploadingAvatar ? "Uploading..." : "Click to change photo"}
              </button>
            </div>
          </div>

          {/* Section: Questions & Answers (Form Data) */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div>
                <h3 className="font-bold text-sm text-white">Questions & Answers</h3>
                <p className="text-xs text-gray-400">
                  Exact data to fill in job listings. Nothing else is ever submitted.
                </p>
              </div>

              <button
                onClick={() => setShowAddForm(!showAddForm)}
                className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent-blue hover:bg-blue-600 text-white text-xs font-semibold shadow-md shadow-blue-500/20 transition w-full sm:w-auto self-end sm:self-auto shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Data</span>
              </button>
            </div>

            {/* Add Q&A Form */}
            {showAddForm && (
              <form
                onSubmit={handleAddField}
                className="p-4 rounded-xl bg-surface-2 border border-accent-blue/50 space-y-3 animate-in fade-in duration-150"
              >
                <div className="text-xs font-semibold text-accent-blue">
                  Add New Question & Answer
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-medium text-gray-300 mb-1">
                      Question / Field Target (e.g. First Name, Expected Salary)
                    </label>
                    <input
                      type="text"
                      value={newQuestion}
                      onChange={(e) => setNewQuestion(e.target.value)}
                      placeholder="e.g. Expected Monthly Salary"
                      required
                      className="w-full px-3 py-2 rounded-lg bg-surface border border-surface-border text-xs text-white placeholder-gray-500 focus:outline-none focus:border-accent-blue"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-gray-300 mb-1">
                      Answer to Submit
                    </label>
                    <input
                      type="text"
                      value={newAnswer}
                      onChange={(e) => setNewAnswer(e.target.value)}
                      placeholder="e.g. €4,500"
                      required
                      className="w-full px-3 py-2 rounded-lg bg-surface border border-surface-border text-xs text-white placeholder-gray-500 focus:outline-none focus:border-accent-blue"
                    />
                  </div>
                </div>

                <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowAddForm(false)}
                    className="w-full sm:w-auto px-3 py-1.5 rounded-lg bg-surface border border-surface-border text-xs text-gray-300 hover:text-white text-center"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingField}
                    className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-4 py-1.5 rounded-lg bg-accent-blue hover:bg-blue-600 text-xs font-semibold text-white transition shadow"
                  >
                    {savingField ? "Saving..." : "Save Data"}
                  </button>
                </div>
              </form>
            )}

            {/* List of Fields */}
            <div className="rounded-xl border border-surface-border overflow-hidden bg-surface-2/40">
              {fields.length === 0 ? (
                <div className="p-6 text-center text-xs text-gray-500">
                  No profile fields saved yet. Click "Add Data" to set up your answers (e.g. First Name, Phone, Salary, Driving License).
                </div>
              ) : (
                <div className="divide-y divide-surface-border">
                  {fields.map((field) => (
                    <div
                      key={field.id}
                      className="p-3 flex items-center justify-between gap-4 hover:bg-surface-2/80 transition"
                    >
                      <div className="min-w-0 grid grid-cols-1 sm:grid-cols-2 gap-2 flex-1">
                        <div className="text-xs font-semibold text-white truncate">
                          {field.question}
                        </div>
                        <div className="text-xs font-mono text-gray-300 truncate">
                          {field.answer}
                        </div>
                      </div>

                      <button
                        onClick={() => handleDeleteField(field.id)}
                        className="p-1.5 rounded-lg text-gray-500 hover:text-accent-red hover:bg-red-950/40 transition shrink-0"
                        title="Delete permanently"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Section: Attachments */}
          <div className="space-y-3 pt-2 border-t border-surface-border">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div>
                <h3 className="font-bold text-sm text-white">Attachments</h3>
                <p className="text-xs text-gray-400">
                  Upload your CV, Cover Letter, or documents for file upload fields.
                </p>
              </div>

              <button
                onClick={() => setShowAttachForm(!showAttachForm)}
                className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-2 border border-surface-border hover:border-gray-600 text-gray-200 hover:text-white text-xs font-semibold transition w-full sm:w-auto self-end sm:self-auto shrink-0"
              >
                <Paperclip className="w-3.5 h-3.5 text-accent-blue" />
                <span>Attach File</span>
              </button>
            </div>

            {/* Attach Form */}
            {showAttachForm && (
              <form
                onSubmit={handleAddAttachment}
                className="p-4 rounded-xl bg-surface-2 border border-accent-blue/50 space-y-3 animate-in fade-in duration-150"
              >
                <div className="text-xs font-semibold text-accent-blue">
                  Upload New Attachment
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-medium text-gray-300 mb-1">
                      Document Type / Description (e.g. CV, Cover Letter)
                    </label>
                    <input
                      type="text"
                      value={attachQuestion}
                      onChange={(e) => setAttachQuestion(e.target.value)}
                      placeholder="e.g. Resume / CV"
                      required
                      className="w-full px-3 py-2 rounded-lg bg-surface border border-surface-border text-xs text-white placeholder-gray-500 focus:outline-none focus:border-accent-blue"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-gray-300 mb-1">
                      Select File (.pdf, .docx, .png, etc.)
                    </label>
                    <input
                      type="file"
                      onChange={(e) => setAttachFile(e.target.files?.[0] || null)}
                      required
                      className="w-full px-2 py-1.5 rounded-lg bg-surface border border-surface-border text-xs text-gray-300 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:bg-surface-2 file:text-white"
                    />
                  </div>
                </div>

                <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowAttachForm(false)}
                    className="w-full sm:w-auto px-3 py-1.5 rounded-lg bg-surface border border-surface-border text-xs text-gray-300 hover:text-white text-center"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={uploadingAttach || !attachFile}
                    className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-4 py-1.5 rounded-lg bg-accent-blue hover:bg-blue-600 text-xs font-semibold text-white transition shadow"
                  >
                    {uploadingAttach ? "Uploading..." : "Save Attachment"}
                  </button>
                </div>
              </form>
            )}

            {/* List of Attachments */}
            <div className="rounded-xl border border-surface-border overflow-hidden bg-surface-2/40">
              {attachments.length === 0 ? (
                <div className="p-6 text-center text-xs text-gray-500">
                  No attachments uploaded yet. Click "Attach File" to upload your CV or Cover Letter.
                </div>
              ) : (
                <div className="divide-y divide-surface-border">
                  {attachments.map((att) => (
                    <div
                      key={att.id}
                      className="p-3 flex items-center justify-between gap-4 hover:bg-surface-2/80 transition"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-accent-blue shrink-0">
                          <FileText className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-white truncate">
                            {att.question}
                          </div>
                          <div className="text-[11px] text-gray-400 truncate">
                            {att.filename}
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={() => handleDeleteAttachment(att.id)}
                        className="p-1.5 rounded-lg text-gray-500 hover:text-accent-red hover:bg-red-950/40 transition shrink-0"
                        title="Delete permanently"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
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

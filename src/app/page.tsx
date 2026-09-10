"use client";

import { useState, useEffect, useCallback } from "react";
import { Header } from "@/components/Header";
import { LinkInputHero } from "@/components/LinkInputHero";
import { TabsHeader, TabType } from "@/components/TabsHeader";
import { ApplyingTab, Task } from "@/components/ApplyingTab";
import { WaitingTab } from "@/components/WaitingTab";
import { AppliedTab } from "@/components/AppliedTab";
import { ProfileModal } from "@/components/ProfileModal";
import { BrainModal } from "@/components/BrainModal";

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState<TabType>("applying");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isQueueRunning, setIsQueueRunning] = useState(false);
  const [activeBrain, setActiveBrain] = useState<any>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [brainModalOpen, setBrainModalOpen] = useState(false);

  const fetchStatus = useCallback(async () => {
    try {
      // Fetch queue running status
      const qRes = await fetch("/api/queue/status");
      if (qRes.ok) {
        const qData = await qRes.json();
        setIsQueueRunning(qData.isRunning);
      }

      // Fetch active brain and user profile
      const meRes = await fetch("/api/auth/me");
      if (meRes.ok) {
        const meData = await meRes.json();
        setActiveBrain(meData.activeBrain || null);
        setAvatarUrl(meData.user?.avatarUrl || null);
      }

      // Fetch tasks
      const tRes = await fetch("/api/tasks");
      if (tRes.ok) {
        const tData = await tRes.json();
        setTasks(tData.tasks || []);
      }
    } catch (err) {
      console.error("Fetch status error:", err);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    // Auto-refresh periodically to reflect background automation
    const interval = setInterval(fetchStatus, 3000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  const handleToggleQueue = async () => {
    try {
      const res = await fetch("/api/queue/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isRunning: !isQueueRunning }),
      });
      if (res.ok) {
        const data = await res.json();
        setIsQueueRunning(data.isRunning);
      }
    } catch (err) {
      console.error("Failed to toggle queue:", err);
    }
  };

  const handleApplySingle = async (taskId: string) => {
    try {
      await fetch(`/api/tasks/${taskId}/apply-single`, {
        method: "POST",
      });
      fetchStatus();
    } catch (err) {
      console.error("Failed to start single task:", err);
    }
  };

  const handleDeleteTask = async (id: string) => {
    try {
      const res = await fetch("/api/tasks", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (res.ok) {
        fetchStatus();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleRetryFailed = async (id: string) => {
    try {
      await fetch(`/api/tasks/${id}/restart`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: [] }),
      });
      fetchStatus();
    } catch (err) {
      console.error(err);
    }
  };

  const handleReorderTasks = async (taskIds: string[]) => {
    try {
      // Optimistic update
      const idMap = new Map(tasks.map((t) => [t.id, t]));
      const reordered = taskIds.map((id) => idMap.get(id)).filter(Boolean) as Task[];
      const others = tasks.filter((t) => !taskIds.includes(t.id));
      setTasks([...reordered, ...others]);

      await fetch("/api/queue/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskIds }),
      });
      fetchStatus();
    } catch (err) {
      console.error(err);
    }
  };

  // Group tasks by status
  const applyingTasks = tasks.filter((t) => t.status === "APPLYING");
  const waitingTasks = tasks.filter((t) => t.status === "WAITING");
  const appliedTasks = tasks.filter((t) => t.status === "APPLIED");
  const failedTasks = tasks.filter((t) => t.status === "FAILED");

  return (
    <div className="min-h-screen bg-background text-gray-200 flex flex-col selection:bg-accent-blue selection:text-white pb-16">
      {/* Header */}
      <Header
        onOpenProfile={() => setProfileModalOpen(true)}
        onOpenBrain={() => setBrainModalOpen(true)}
        isQueueRunning={isQueueRunning}
        onToggleQueue={handleToggleQueue}
        activeBrain={activeBrain}
        avatarUrl={avatarUrl}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 pt-6 sm:pt-8">
        {/* Link Input Hero */}
        <LinkInputHero onLinksSubmitted={fetchStatus} />

        {/* Dashboard 3 Tabs */}
        <TabsHeader
          activeTab={activeTab}
          onChangeTab={setActiveTab}
          counts={{
            applying: applyingTasks.length + failedTasks.length,
            waiting: waitingTasks.length,
            applied: appliedTasks.length,
          }}
        />

        {/* Active Tab View */}
        {activeTab === "applying" && (
          <ApplyingTab
            tasks={applyingTasks}
            failedTasks={failedTasks}
            isQueueRunning={isQueueRunning}
            onRefresh={fetchStatus}
            onDeleteTask={handleDeleteTask}
            onRetryFailed={handleRetryFailed}
            onReorderTasks={handleReorderTasks}
            onApplySingle={handleApplySingle}
          />
        )}

        {activeTab === "waiting" && (
          <WaitingTab
            tasks={waitingTasks}
            onRefresh={fetchStatus}
            onDeleteTask={handleDeleteTask}
          />
        )}

        {activeTab === "applied" && (
          <AppliedTab tasks={appliedTasks} onDeleteTask={handleDeleteTask} />
        )}
      </main>

      {/* Modals */}
      <ProfileModal
        isOpen={profileModalOpen}
        onClose={() => setProfileModalOpen(false)}
        onProfileUpdated={fetchStatus}
      />

      <BrainModal
        isOpen={brainModalOpen}
        onClose={() => setBrainModalOpen(false)}
        onBrainSwitched={fetchStatus}
      />
    </div>
  );
}

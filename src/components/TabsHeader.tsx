"use client";

import { Clock, HelpCircle, CheckCircle2, Mail } from "lucide-react";

export type TabType = "applying" | "waiting" | "applied" | "inbox";

interface TabsHeaderProps {
  activeTab: TabType;
  onChangeTab: (tab: TabType) => void;
  counts: {
    applying: number;
    waiting: number;
    applied: number;
    inbox?: number;
  };
}

export function TabsHeader({ activeTab, onChangeTab, counts }: TabsHeaderProps) {
  const tabs = [
    {
      id: "applying" as TabType,
      label: "Applying",
      count: counts.applying,
      icon: Clock,
      color: "text-accent-blue",
      badgeActive: "bg-accent-blue text-white",
      badgeInactive: "bg-surface-2 text-gray-400",
      borderActive: "border-accent-blue text-white",
    },
    {
      id: "waiting" as TabType,
      label: "Waiting",
      count: counts.waiting,
      icon: HelpCircle,
      color: "text-accent-amber",
      badgeActive: "bg-accent-amber text-gray-950 font-bold",
      badgeInactive: "bg-surface-2 text-gray-400",
      borderActive: "border-accent-amber text-white",
    },
    {
      id: "applied" as TabType,
      label: "Applied",
      count: counts.applied,
      icon: CheckCircle2,
      color: "text-accent-emerald",
      badgeActive: "bg-accent-emerald text-gray-950 font-bold",
      badgeInactive: "bg-surface-2 text-gray-400",
      borderActive: "border-accent-emerald text-white",
    },
    {
      id: "inbox" as TabType,
      label: "Inbox",
      count: counts.inbox ?? 0,
      icon: Mail,
      color: "text-purple-400",
      badgeActive: "bg-purple-500 text-white font-bold",
      badgeInactive: "bg-surface-2 text-gray-400",
      borderActive: "border-purple-500 text-white",
    },
  ];

  return (
    <div className="w-full max-w-4xl mx-auto border-b border-surface-border mb-6">
      <div className="flex gap-2 sm:gap-4">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => onChangeTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 border-b-2 font-medium text-xs sm:text-sm transition relative ${
                isActive
                  ? tab.borderActive
                  : "border-transparent text-gray-400 hover:text-gray-200"
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? tab.color : "text-gray-500"}`} />
              <span>{tab.label}</span>
              <span
                className={`text-[11px] px-2 py-0.5 rounded-full font-semibold transition ${
                  isActive ? tab.badgeActive : tab.badgeInactive
                }`}
              >
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

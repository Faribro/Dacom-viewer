"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { OrphanCase } from "@/utils/mockData";

interface FindingsPanelProps {
  patientName: string;
  patientId: string;
  studyDate: string;
  metadata: OrphanCase["extractedMetadata"];
}

type SyncState = "idle" | "syncing" | "verified";

export default function FindingsPanel({
  patientName,
  patientId,
  studyDate,
  metadata,
}: FindingsPanelProps) {
  const { abnormalityScore, findings } = metadata;
  const isHighRisk = abnormalityScore > 60;
  const [syncState, setSyncState] = useState<SyncState>("idle");

  const handleSync = () => {
    if (syncState !== "idle") return;
    setSyncState("syncing");
    setTimeout(() => setSyncState("verified"), 2000);
  };

  return (
    <div className="h-full bg-white/70 backdrop-blur-md flex flex-col overflow-hidden border-t border-white/80">
      {/* Panel header bar */}
      <div className="px-4 py-3 border-b border-slate-200/30 flex items-center justify-between shrink-0 bg-gradient-to-b from-white/50 to-transparent">
        <span className="text-[10px] font-semibold text-slate-500 tracking-wider uppercase">
          Genki AI Analysis Report
        </span>
        <span
          className={`px-2.5 py-1 rounded-full text-[9px] font-bold tracking-wider uppercase shadow-sm ${
            isHighRisk
              ? "bg-rose-50 text-rose-600 border border-rose-200/50"
              : "bg-amber-50 text-amber-600 border border-amber-200/50"
          }`}
        >
          {isHighRisk ? "High Risk" : "Moderate"}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
        {/* Metadata grid */}
        <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5">
          {(
            [
              ["Name", patientName],
              ["ID", patientId],
              ["Date", studyDate],
            ] as [string, string][]
          ).map(([label, value]) => (
            <div key={label} className="contents">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider self-center">
                {label}
              </span>
              <span className={`text-xs font-semibold text-slate-800 ${label === "ID" ? "font-medical" : ""}`}>
                {value}
              </span>
            </div>
          ))}
        </div>

        {/* Luxury Car Dashboard Score Gauge */}
        <div className="space-y-2 glass-luxury rounded-xl p-4 shadow-luxury">
          <div className="flex justify-between items-center mb-2">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
              Abnormality Index
            </span>
            <span className="text-lg font-bold text-slate-900 font-medical">
              {abnormalityScore}%
            </span>
          </div>
          
          {/* Dashboard gradient bar with pulsing indicator */}
          <div className="relative h-3 w-full bg-slate-200/40 rounded-full overflow-hidden shadow-inner">
            <motion.div
              className="h-full rounded-full gradient-dashboard"
              initial={{ width: 0 }}
              animate={{ width: `${abnormalityScore}%` }}
              transition={{ duration: 1.2, ease: [0.34, 1.56, 0.64, 1] }}
            />
            
            {/* Pulsing position indicator */}
            <motion.div
              className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white shadow-lg score-pulse border-2 border-slate-900"
              initial={{ left: "0%" }}
              animate={{ left: `${abnormalityScore}%` }}
              transition={{ duration: 1.2, ease: [0.34, 1.56, 0.64, 1] }}
              style={{ marginLeft: "-6px" }}
            />
          </div>
          
          {/* Score scale markers */}
          <div className="flex justify-between text-[9px] font-medium text-slate-400 mt-1">
            <span>0</span>
            <span>25</span>
            <span>50</span>
            <span>75</span>
            <span>100</span>
          </div>
        </div>

        {/* Findings grid */}
        <div className="grid grid-cols-2 gap-2">
          {Object.entries(findings).map(([key, value]) => {
            const positive = value === "Yes";
            return (
              <motion.div
                key={key}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className={`flex items-center justify-between px-3 py-2 rounded-lg text-[10px] font-semibold transition-all shadow-sm ${
                  positive
                    ? "bg-rose-50/80 text-rose-700 border border-rose-200/50"
                    : "bg-slate-50/80 text-slate-400 border border-slate-200/50"
                }`}
              >
                <span className="truncate">{key}</span>
                <span className={`ml-2 font-bold shrink-0 ${positive ? "text-rose-800" : "text-slate-500"}`}>
                  {value}
                </span>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Sync button */}
      <div className="px-4 py-3 border-t border-slate-200/30 shrink-0 bg-gradient-to-t from-white/50 to-transparent">
        <motion.button
          onClick={handleSync}
          disabled={syncState !== "idle"}
          whileHover={syncState === "idle" ? { scale: 1.01, y: -1 } : {}}
          whileTap={syncState === "idle" ? { scale: 0.99 } : {}}
          className={`w-full py-2.5 rounded-lg text-[11px] font-bold tracking-wide uppercase border transition-all shadow-sm ${
            syncState === "verified"
              ? "bg-emerald-50/80 border-emerald-200/50 text-emerald-700 cursor-default"
              : syncState === "syncing"
              ? "bg-blue-50/80 border-blue-200/50 text-blue-600 cursor-wait"
              : "glass-luxury text-slate-700 hover:border-blue-300/50 hover:text-blue-600 hover:shadow-luxury"
          }`}
        >
          <AnimatePresence mode="wait">
            {syncState === "idle" && (
              <motion.span
                key="idle"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                ▶ Verify &amp; Sync to Master Database
              </motion.span>
            )}
            {syncState === "syncing" && (
              <motion.span
                key="syncing"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="flex items-center justify-center gap-2"
              >
                <motion.span
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 0.8, ease: "linear" }}
                  className="inline-block"
                >
                  ◌
                </motion.span>
                Syncing…
              </motion.span>
            )}
            {syncState === "verified" && (
              <motion.span
                key="verified"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.2 }}
              >
                ✓ Verified
              </motion.span>
            )}
          </AnimatePresence>
        </motion.button>
      </div>
    </div>
  );
}

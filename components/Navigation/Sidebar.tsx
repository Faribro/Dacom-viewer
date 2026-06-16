"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import axiosInstance from "@/utils/axiosInstance";
import type { OrphanCase } from "@/utils/mockData";

interface SidebarProps {
  activeOrphanId: string | null;
  onSelect: (orphanId: string, patient: OrphanCase) => void;
}

type GroupedCases = Record<string, Record<string, OrphanCase[]>>;

function groupByUnitAndDate(cases: OrphanCase[]): GroupedCases {
  return cases.reduce<GroupedCases>((acc, c) => {
    const [unit = "UNKNOWN", date = "UNKNOWN"] = c.context.split("|").map((s) => s.trim());
    if (!acc[unit]) acc[unit] = {};
    if (!acc[unit][date]) acc[unit][date] = [];
    acc[unit][date].push(c);
    return acc;
  }, {});
}

const springTransition = {
  type: "spring",
  stiffness: 300,
  damping: 30,
};

export default function Sidebar({ activeOrphanId, onSelect }: SidebarProps) {
  const [grouped, setGrouped] = useState<GroupedCases>({});
  const [openUnits, setOpenUnits] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [isEmpty, setIsEmpty] = useState(false);
  const [isLocked, setIsLocked] = useState(false);

  const fetchOrphans = useCallback(() => {
    setIsLoading(true);
    setIsEmpty(false);

    console.info("[SAMADHAAN] Fetching patients from live backend...");

    axiosInstance
      .get<{ total: number; records: OrphanCase[] }>("/patients/pipeline")
      .then(({ data }) => {
        const records = data.records || [];
        console.info(`[SAMADHAAN] Received ${records.length} patient cases`);

        if (records.length === 0) {
          setIsEmpty(true);
          setGrouped({});
        } else {
          const grouped = groupByUnitAndDate(records);
          setGrouped(grouped);
          setIsEmpty(false);
          setIsLocked(false);

          // Auto-open first unit
          const firstUnit = Object.keys(grouped)[0];
          if (firstUnit) {
            setOpenUnits(new Set([firstUnit]));
          }
        }
        setIsLoading(false);
        setIsRefreshing(false);
      })
      .catch((err) => {
        const status = err.response?.status;
        
        if (status === 401 || status === 403) {
          console.warn("[SAMADHAAN] Institutional lock detected - demo mode active");
          setIsLocked(true);
        }
        
        console.error("[SAMADHAAN] Failed to fetch patients:", err);
        setIsEmpty(true);
        setGrouped({});
        setIsLoading(false);
        setIsRefreshing(false);
      });
  }, []);

  useEffect(() => {
    fetchOrphans();
  }, [fetchOrphans]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    setIsScanning(true);
    
    try {
      console.info("[SAMADHAAN] Triggering Master Scan...");
      await axiosInstance.post("/hierarchy/scan");
      console.info("[SAMADHAAN] Master Scan completed successfully");
      
      // Wait 2 seconds for scan to complete, then refresh
      setTimeout(() => {
        fetchOrphans();
        setIsScanning(false);
      }, 2000);
    } catch (error: any) {
      const status = error.response?.status;
      
      if (status === 401 || status === 403) {
        console.warn("[SAMADHAAN] Institutional Lock - Demo Mode Active");
        if (typeof window !== "undefined") {
          window.__SAMADHAAN_DEMO_MODE__ = true;
        }
        setIsLocked(true);
      } else {
        console.error("[SAMADHAAN] Master Scan failed:", error);
      }
      
      setIsRefreshing(false);
      setIsScanning(false);
    }
  };

  const toggleUnit = (unit: string) =>
    setOpenUnits((prev) => {
      const next = new Set(prev);
      next.has(unit) ? next.delete(unit) : next.add(unit);
      return next;
    });

  return (
    <aside className="w-72 h-screen glass-luxury flex flex-col overflow-hidden shrink-0 shadow-luxury">
      {/* Header */}
      <div className="px-5 py-4 border-b border-white/50 bg-gradient-to-b from-white/60 to-transparent">
        <p className="text-[10px] font-semibold text-slate-400 tracking-wider uppercase mb-1">
          Samadhaan Vision Hub
        </p>
        <p className="text-sm font-bold text-slate-800 tracking-tight">
          Clinical File Cabinet
        </p>
      </div>

      {/* Tree */}
      <nav className="flex-1 overflow-y-auto py-3 px-2">
        {isLoading && !isRefreshing ? (
          <div className="space-y-2 px-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-10 neural-pulse rounded-lg" />
            ))}
          </div>
        ) : isEmpty ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center justify-center h-full px-4 text-center"
          >
            <motion.div
              animate={{
                scale: [1, 1.05, 1],
                opacity: [0.5, 1, 0.5],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut",
              }}
              className={`w-12 h-12 rounded-full mb-3 ${
                isLocked
                  ? "bg-gradient-to-br from-amber-400 to-amber-600"
                  : "bg-gradient-to-br from-blue-400 to-blue-600"
              }`}
            />
            <p className="text-xs font-bold text-slate-700 mb-1">
              {isLocked ? "Institutional Lock" : "Sovereign Node Active"}
            </p>
            <p className="text-[10px] font-medium text-slate-500 leading-relaxed">
              {isLocked ? "Demo Mode Active" : "Scanning Azure Orphans Container..."}
            </p>
          </motion.div>
        ) : (
          <div className="space-y-1">
            {Object.entries(grouped).map(([unit, dateMap]) => {
              const isOpen = openUnits.has(unit);
              return (
                <div key={unit}>
                  {/* Unit accordion header */}
                  <motion.button
                    onClick={() => toggleUnit(unit)}
                    whileHover={{ x: 2 }}
                    whileTap={{ scale: 0.98 }}
                    className="w-full flex items-center justify-between px-3 py-2.5 text-xs font-bold text-slate-700 hover:text-blue-600 hover:bg-white/40 rounded-lg transition-colors tracking-tight"
                  >
                    <span>{unit}</span>
                    <motion.span
                      animate={{ rotate: isOpen ? 90 : 0 }}
                      transition={{ duration: 0.2 }}
                      className="text-slate-400 text-[10px]"
                    >
                      ▸
                    </motion.span>
                  </motion.button>

                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={springTransition}
                        className="overflow-hidden ml-2"
                      >
                        {Object.entries(dateMap).map(([date, patients]) => (
                          <div key={date} className="mt-1">
                            {/* Date label */}
                            <div className="px-3 py-1.5 text-[10px] font-semibold text-slate-400 tracking-wider uppercase">
                              {date}
                            </div>

                            {/* Patient leaves */}
                            <div className="space-y-0.5">
                              {patients.map((p) => {
                                const patientId = (p as any).id || p.orphanId || p.patientId;
                                const isActive = activeOrphanId === patientId;
                                
                                // Parse patient name from context
                                const contextParts = (p.context || "").split("|").map(s => s.trim());
                                const uniqueId = contextParts[1] || p.patientId || "N/A";
                                const displayName = uniqueId.startsWith("AS") 
                                  ? `Patient ${uniqueId.substring(7)}`
                                  : p.patientName || "Patient";
                                
                                return (
                                  <motion.button
                                    key={patientId}
                                    onClick={() => onSelect(patientId, p)}
                                    whileHover={{ x: isActive ? 0 : 4 }}
                                    whileTap={{ scale: 0.98 }}
                                    className={`w-full text-left px-3 py-2 text-xs rounded-lg transition-all ${
                                      isActive
                                        ? "bg-blue-50 text-blue-700 font-bold border-r-4 border-blue-600 shadow-sm"
                                        : "text-slate-600 hover:bg-white/40 hover:text-slate-900"
                                    }`}
                                  >
                                    <span className="block truncate font-semibold tracking-tight">
                                      {displayName}
                                    </span>
                                    <span className="block text-[10px] font-mono text-slate-400 mt-0.5">
                                      {uniqueId}
                                    </span>
                                  </motion.button>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        )}
      </nav>

      {/* System Health Section */}
      <div className="px-4 py-3 border-t border-white/50 bg-gradient-to-t from-white/60 to-transparent">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[9px] font-bold text-slate-400 tracking-widest uppercase">
            System Health
          </span>
          
          {/* Refresh Button */}
          <motion.button
            onClick={handleRefresh}
            disabled={isRefreshing || isScanning}
            whileHover={!isRefreshing && !isScanning ? { scale: 1.1, rotate: 15 } : {}}
            whileTap={!isRefreshing && !isScanning ? { scale: 0.9 } : {}}
            animate={isRefreshing || isScanning ? { rotate: 360 } : { rotate: 0 }}
            transition={
              isRefreshing || isScanning
                ? { duration: 1, repeat: Infinity, ease: "linear" }
                : { duration: 0.2 }
            }
            className={`p-1.5 rounded-lg transition-colors ${
              isRefreshing || isScanning
                ? "text-blue-400 cursor-wait"
                : "text-slate-400 hover:text-blue-600 hover:bg-white/40"
            }`}
            title={isScanning ? "Sovereign Scan in Progress..." : "Trigger Master Scan"}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2" />
            </svg>
          </motion.button>
        </div>

        <div className="flex items-center gap-2.5">
          <span className="relative flex h-2.5 w-2.5 shrink-0">
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-50 ${
              isLocked ? "bg-amber-400" : "bg-blue-400"
            }`} />
            <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
              isLocked ? "bg-amber-500" : "bg-blue-500"
            }`} />
          </span>
          <span className={`text-[10px] font-bold tracking-wide uppercase ${
            isLocked ? "text-amber-600 institutional-lock" : "text-blue-600"
          }`}>
            {isLocked ? "Institutional Lock: Demo Mode Active" : "Sentinel Online"}
          </span>
        </div>
      </div>
    </aside>
  );
}

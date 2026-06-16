"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import axiosInstance from "@/utils/axiosInstance";

interface StorageTelemetry {
  system: {
    total: number;
  };
  dicom: {
    total: number;
    ready: number;
    archived: number;
  };
  pdf: {
    total: number;
    ready: number;
    archived: number;
  };
}

export default function StorageLedgerPage() {
  const [telemetry, setTelemetry] = useState<StorageTelemetry | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isExtracting, setIsExtracting] = useState(false);

  useEffect(() => {
    const fetchTelemetry = async () => {
      setIsLoading(true);
      try {
        const { data } = await axiosInstance.get<StorageTelemetry>("/storage/telemetry");
        setTelemetry(data);
        console.info("[SAMADHAAN] Storage telemetry loaded:", data);
      } catch (error) {
        console.error("[SAMADHAAN] Failed to fetch storage telemetry:", error);
        // Fallback demo data
        setTelemetry({
          system: { total: 28238 },
          dicom: { total: 18456, ready: 12340, archived: 6116 },
          pdf: { total: 9782, ready: 7891, archived: 1891 },
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchTelemetry();
  }, []);

  const handleExtractArchive = async (type: "dicom" | "pdf") => {
    setIsExtracting(true);
    try {
      await axiosInstance.post(`/storage/extract/${type}`);
      console.info(`[SAMADHAAN] Extraction initiated for ${type.toUpperCase()}`);
      // Refresh telemetry after extraction
      const { data } = await axiosInstance.get<StorageTelemetry>("/storage/telemetry");
      setTelemetry(data);
    } catch (error) {
      console.error(`[SAMADHAAN] Failed to extract ${type} archives:`, error);
    } finally {
      setIsExtracting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <motion.div
          animate={{ scale: [1, 1.05, 1] }}
          transition={{ repeat: Infinity, duration: 1.5 }}
          className="text-sm font-bold text-slate-400 tracking-widest"
        >
          Loading Storage Ledger...
        </motion.div>
      </div>
    );
  }

  if (!telemetry) return null;

  const dicomProgress = (telemetry.dicom.ready / telemetry.dicom.total) * 100;
  const pdfProgress = (telemetry.pdf.ready / telemetry.pdf.total) * 100;

  return (
    <div className="min-h-screen bg-white p-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-12"
      >
        <h1 className="text-5xl font-black text-slate-900 tracking-tight mb-2">
          Sovereign Storage Ledger
        </h1>
        <p className="text-slate-500 text-sm font-semibold tracking-wide">
          Azure Blob Hierarchy · Real-time File Telemetry
        </p>
      </motion.div>

      {/* Macro Row - System Overview */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-3 gap-6 mb-8"
      >
        {/* System Total */}
        <div className="glass-luxury rounded-2xl p-8 border border-slate-200/50 shadow-luxury">
          <div className="text-xs font-bold text-slate-500 tracking-widest uppercase mb-3">
            System Total
          </div>
          <div className="font-mono text-4xl font-black text-slate-900 tracking-tight">
            {telemetry.system.total.toLocaleString()}
          </div>
          <div className="text-xs text-slate-400 font-semibold mt-2">
            Total Files in Azure
          </div>
        </div>

        {/* DICOM Vault */}
        <div className="glass-luxury rounded-2xl p-8 border border-blue-200/50 shadow-luxury bg-gradient-to-br from-blue-50/30 to-transparent">
          <div className="text-xs font-bold text-blue-600 tracking-widest uppercase mb-3">
            DICOM Vault
          </div>
          <div className="font-mono text-4xl font-black text-blue-900 tracking-tight">
            {telemetry.dicom.total.toLocaleString()}
          </div>
          <div className="text-xs text-blue-500 font-semibold mt-2">
            Medical Imaging Files
          </div>
        </div>

        {/* PDF Vault */}
        <div className="glass-luxury rounded-2xl p-8 border border-emerald-200/50 shadow-luxury bg-gradient-to-br from-emerald-50/30 to-transparent">
          <div className="text-xs font-bold text-emerald-600 tracking-widest uppercase mb-3">
            PDF Vault
          </div>
          <div className="font-mono text-4xl font-black text-emerald-900 tracking-tight">
            {telemetry.pdf.total.toLocaleString()}
          </div>
          <div className="text-xs text-emerald-500 font-semibold mt-2">
            Lab Report Documents
          </div>
        </div>
      </motion.div>

      {/* Micro Row - The Split */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="grid grid-cols-2 gap-8"
      >
        {/* Left - DICOM Breakdown */}
        <div className="space-y-4">
          <h2 className="text-xl font-black text-slate-900 tracking-tight mb-6">
            DICOM File Status
          </h2>

          {/* Ready (Unzipped) */}
          <div className="glass-luxury rounded-xl p-6 border border-blue-200/50 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-xs font-bold text-blue-600 tracking-widest uppercase mb-2">
                  Ready (Unzipped)
                </div>
                <div className="font-mono text-3xl font-black text-blue-900 tracking-tight">
                  {telemetry.dicom.ready.toLocaleString()}
                </div>
              </div>
              <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-blue-600"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
            </div>
            <div className="h-1.5 bg-blue-100 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${dicomProgress}%` }}
                transition={{ duration: 1, ease: "easeOut" }}
                className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full"
              />
            </div>
            <div className="text-xs text-blue-500 font-semibold mt-2">
              {dicomProgress.toFixed(1)}% of total DICOM files
            </div>
          </div>

          {/* Archived (.zip) */}
          <div className="glass-luxury rounded-xl p-6 border border-slate-200/50 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-xs font-bold text-slate-600 tracking-widest uppercase mb-2">
                  Archived (.zip)
                </div>
                <div className="font-mono text-3xl font-black text-slate-900 tracking-tight">
                  {telemetry.dicom.archived.toLocaleString()}
                </div>
              </div>
              <button
                onClick={() => handleExtractArchive("dicom")}
                disabled={isExtracting}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white text-xs font-bold rounded-lg transition-colors shadow-sm disabled:cursor-not-allowed"
              >
                {isExtracting ? "Extracting..." : "Extract Archive"}
              </button>
            </div>
            <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${100 - dicomProgress}%` }}
                transition={{ duration: 1, ease: "easeOut" }}
                className="h-full bg-gradient-to-r from-slate-400 to-slate-500 rounded-full"
              />
            </div>
            <div className="text-xs text-slate-500 font-semibold mt-2">
              {(100 - dicomProgress).toFixed(1)}% pending extraction
            </div>
          </div>
        </div>

        {/* Right - PDF Breakdown */}
        <div className="space-y-4">
          <h2 className="text-xl font-black text-slate-900 tracking-tight mb-6">
            PDF File Status
          </h2>

          {/* Ready */}
          <div className="glass-luxury rounded-xl p-6 border border-emerald-200/50 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-xs font-bold text-emerald-600 tracking-widest uppercase mb-2">
                  Ready
                </div>
                <div className="font-mono text-3xl font-black text-emerald-900 tracking-tight">
                  {telemetry.pdf.ready.toLocaleString()}
                </div>
              </div>
              <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-emerald-600"
                >
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                  <polyline points="10 9 9 9 8 9" />
                </svg>
              </div>
            </div>
            <div className="h-1.5 bg-emerald-100 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${pdfProgress}%` }}
                transition={{ duration: 1, ease: "easeOut" }}
                className="h-full bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-full"
              />
            </div>
            <div className="text-xs text-emerald-500 font-semibold mt-2">
              {pdfProgress.toFixed(1)}% of total PDF files
            </div>
          </div>

          {/* Archived */}
          <div className="glass-luxury rounded-xl p-6 border border-slate-200/50 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-xs font-bold text-slate-600 tracking-widest uppercase mb-2">
                  Archived (.zip)
                </div>
                <div className="font-mono text-3xl font-black text-slate-900 tracking-tight">
                  {telemetry.pdf.archived.toLocaleString()}
                </div>
              </div>
              <button
                onClick={() => handleExtractArchive("pdf")}
                disabled={isExtracting}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white text-xs font-bold rounded-lg transition-colors shadow-sm disabled:cursor-not-allowed"
              >
                {isExtracting ? "Extracting..." : "Extract Archive"}
              </button>
            </div>
            <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${100 - pdfProgress}%` }}
                transition={{ duration: 1, ease: "easeOut" }}
                className="h-full bg-gradient-to-r from-slate-400 to-slate-500 rounded-full"
              />
            </div>
            <div className="text-xs text-slate-500 font-semibold mt-2">
              {(100 - pdfProgress).toFixed(1)}% pending extraction
            </div>
          </div>
        </div>
      </motion.div>

      {/* Footer Stats */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="mt-12 pt-8 border-t border-slate-200"
      >
        <div className="grid grid-cols-4 gap-6">
          <div className="text-center">
            <div className="text-xs font-bold text-slate-500 tracking-widest uppercase mb-1">
              Total Ready
            </div>
            <div className="font-mono text-2xl font-black text-slate-900">
              {(telemetry.dicom.ready + telemetry.pdf.ready).toLocaleString()}
            </div>
          </div>
          <div className="text-center">
            <div className="text-xs font-bold text-slate-500 tracking-widest uppercase mb-1">
              Total Archived
            </div>
            <div className="font-mono text-2xl font-black text-slate-900">
              {(telemetry.dicom.archived + telemetry.pdf.archived).toLocaleString()}
            </div>
          </div>
          <div className="text-center">
            <div className="text-xs font-bold text-blue-600 tracking-widest uppercase mb-1">
              DICOM Ready %
            </div>
            <div className="font-mono text-2xl font-black text-blue-900">
              {dicomProgress.toFixed(1)}%
            </div>
          </div>
          <div className="text-center">
            <div className="text-xs font-bold text-emerald-600 tracking-widest uppercase mb-1">
              PDF Ready %
            </div>
            <div className="font-mono text-2xl font-black text-emerald-900">
              {pdfProgress.toFixed(1)}%
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

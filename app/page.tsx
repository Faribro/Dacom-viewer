"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { FollowUpPipeline } from "@/components/FollowUpPipeline";
import { TokenInitializer } from "@/components/TokenInitializer";

export default function HomePage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchQuery(value);
    
    // Debounce search by 500ms
    setTimeout(() => {
      setDebouncedQuery(value);
    }, 500);
  };

  return (
    <>
      <TokenInitializer />
      <div className="h-screen w-screen flex flex-col bg-[#F8FAFC] overflow-hidden">
      {/* Header with Search */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-luxury border-b border-white/50 px-6 py-4 shadow-luxury"
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black bg-gradient-dashboard bg-clip-text text-transparent tracking-tight">
              Samadhaan Vision Hub
            </h1>
            <p className="text-xs font-semibold text-slate-500 tracking-wide mt-0.5">
              Clinical Diagnostic Operating System
            </p>
          </div>

          {/* Search Bar */}
          <div className="relative w-96">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={handleSearch}
              placeholder="Search by name, ID, location..."
              className="w-full pl-11 pr-4 py-2.5 glass-luxury rounded-xl text-sm font-medium text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all shadow-sm"
            />
          </div>
        </div>
      </motion.div>

      {/* Pipeline Grid */}
      <div className="flex-1 overflow-hidden">
        <FollowUpPipeline searchQuery={debouncedQuery} />
        </div>
      </div>
    </>
  );
}

"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import axiosInstance from "@/utils/axiosInstance";
import { MOCK_ORPHAN, type OrphanCase } from "@/utils/mockData";

interface FollowUpPipelineProps {
  onPatientClick?: (patient: OrphanCase) => void;
  searchQuery?: string;
}

const calculatePatientPhase = (patient: OrphanCase): { phase: string } => {
  const score = patient.extractedMetadata?.abnormalityScore ?? 0;
  if (score > 60) {
    return { phase: "Diagnosis" };
  } else if (score > 30) {
    return { phase: "Sputum Test" };
  }
  return { phase: "Screening" };
};

const calculateDaysElapsed = (dateStr: string): number => {
  if (!dateStr) return 0;
  
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return 0;
  
  const now = new Date();
  const diffTime = Math.abs(now.getTime() - date.getTime());
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
};

const PatientCard = ({ 
  patient, 
  onClick,
  index 
}: { 
  patient: OrphanCase; 
  onClick: () => void;
  index: number;
}) => {
  const phase = calculatePatientPhase(patient);
  const daysElapsed = calculateDaysElapsed(patient.studyDate);
  const isStale = daysElapsed > 5;
  
  // Parse backend response structure
  // context format: "DICOM | AS01UJJ00130062"
  const contextParts = (patient.context || "").split("|").map(s => s.trim());
  const patientIdFromContext = contextParts[1] || "";
  const fileType = contextParts[0] || "DICOM";
  
  // Extract patient ID from context and parse location
  const displayId = patientIdFromContext || patient.unique_id || patient.patientId || patient.id || "N/A";
  
  // Parse location from patient ID (AS01UJJ00130062)
  let displayName = "Patient";
  let location = "Location Pending";
  let isFieldUpload = true;
  
  if (patientIdFromContext && patientIdFromContext.startsWith("AS")) {
    // Extract from AS-schema ID
    const stateCode = patientIdFromContext.substring(2, 4);
    const districtCode = patientIdFromContext.substring(4, 7);
    
    const STATE_MAP: Record<string, string> = {
      "01": "Madhya Pradesh",
      "02": "Maharashtra",
      "03": "Uttar Pradesh",
    };
    
    const DISTRICT_MAP: Record<string, string> = {
      "UJJ": "Ujjain",
      "IND": "Indore",
      "BPL": "Bhopal",
    };
    
    const state = STATE_MAP[stateCode] || `State ${stateCode}`;
    const district = DISTRICT_MAP[districtCode] || `District ${districtCode}`;
    
    location = `${district}, ${state}`;
    displayName = `Patient ${patientIdFromContext.substring(7)}`;
    isFieldUpload = false;
  } else if (patient.screening_district && patient.screening_state) {
    location = `${patient.screening_district}, ${patient.screening_state}`;
    displayName = patient.inmate_name || patient.patientName || "Patient";
    isFieldUpload = false;
  } else if (patient.inmate_name || patient.patientName) {
    displayName = patient.inmate_name || patient.patientName || "Patient";
  }

  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, scale: 0.95, y: 20 },
        show: { opacity: 1, scale: 1, y: 0 }
      }}
      onClick={onClick}
      className={`glass-luxury rounded-2xl p-5 shadow-luxury hover:shadow-luxury-lg hover:-translate-y-1 transition-all duration-300 group cursor-pointer flex flex-col justify-between min-h-[160px] ${
        isStale ? "border-2 border-amber-400/50" : ""
      }`}
      style={{
        animation: isStale ? "pulse-border 3s ease-in-out infinite" : undefined
      }}
    >
      <div className="flex justify-between items-start mb-4">
        <div className="flex-1">
          <h3 className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors tracking-tight">
            {displayName}
          </h3>
          <span className="text-xs font-mono text-slate-400 bg-slate-50 px-2 py-1 rounded-md mt-1 inline-block">
            {displayId}
          </span>
        </div>
        
        {/* File type pills */}
        <div className="flex gap-1.5 ml-2">
          {(patient as any).has_dicom && (
            <span className="px-2 py-0.5 rounded-md text-[9px] font-bold tracking-wider uppercase bg-cyan-50 text-cyan-700 border border-cyan-200/50">
              DICOM
            </span>
          )}
          {(patient as any).has_pdf && (
            <span className="px-2 py-0.5 rounded-md text-[9px] font-bold tracking-wider uppercase bg-emerald-50 text-emerald-700 border border-emerald-200/50">
              REPORT
            </span>
          )}
        </div>
      </div>
      
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <div className={`w-6 h-6 rounded-md flex items-center justify-center ${
            isFieldUpload ? "bg-amber-100" : "bg-slate-100"
          }`}>
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={isFieldUpload ? "text-amber-600" : "text-slate-600"}>
              <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
              <circle cx="12" cy="10" r="3"/>
            </svg>
          </div>
          <span className={`truncate ${
            isFieldUpload ? "text-amber-700 font-semibold" : ""
          }`}>{location}</span>
        </div>
        
        <div className="flex items-center justify-between pt-3 border-t border-slate-100">
          <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold tracking-wide uppercase shadow-sm ${
            phase.phase === "Sputum Test" ? "bg-amber-50 text-amber-700 border border-amber-200/50" :
            phase.phase === "Diagnosis" ? "bg-blue-50 text-blue-700 border border-blue-200/50" :
            "bg-slate-50 text-slate-700 border border-slate-200/50"
          }`}>
            {phase.phase}
          </span>
          <span className={`text-[10px] font-bold ${
            isStale ? "text-amber-600" : "text-slate-500"
          }`}>
            {daysElapsed > 0 ? `${daysElapsed}d ${isStale ? "Stale" : "Active"}` : "New"}
          </span>
        </div>
      </div>
    </motion.div>
  );
};

export function FollowUpPipeline({ onPatientClick, searchQuery }: FollowUpPipelineProps) {
  const router = useRouter();
  const [patients, setPatients] = useState<OrphanCase[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isScanning, setIsScanning] = useState(false);
  const [selectedState, setSelectedState] = useState<string | null>(null);
  const [selectedDistrict, setSelectedDistrict] = useState<string | null>(null);

  useEffect(() => {
    const fetchPatients = async () => {
      setIsLoading(true);
      try {
        const { data } = await axiosInstance.get<OrphanCase[]>("/patients", {
          timeout: 5000,
        });
        console.info("[SAMADHAAN] Loaded", data.length, "patients");
        setPatients(data);
      } catch (error: any) {
        try {
          const { data } = await axiosInstance.get<OrphanCase[]>("/orphans", {
            timeout: 5000,
          });
          console.info("[SAMADHAAN] Loaded", data.length, "patients from /orphans");
          setPatients(data);
        } catch (fallbackError: any) {
          console.warn("[SAMADHAAN] Backend offline - showing demo patient");
          setPatients([MOCK_ORPHAN]);
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchPatients();
  }, [searchQuery]);

  const filteredPatients = patients.filter((p) => {
    if (selectedState && p.screening_state !== selectedState) return false;
    if (selectedDistrict && p.screening_district !== selectedDistrict) return false;
    return true;
  });

  const uniqueStates = Array.from(new Set(patients.map(p => p.screening_state).filter(Boolean)));
  const uniqueDistricts = Array.from(new Set(patients.map(p => p.screening_district).filter(Boolean)));

  const handlePatientClick = (patient: OrphanCase) => {
    // Use id from backend response
    const patientId = (patient as any).id || patient.unique_id || patient.orphanId || patient.patientId;
    
    if (onPatientClick) {
      onPatientClick(patient);
    } else {
      router.push(`/viewer/${patientId}`);
    }
  };

  const clearFilters = () => {
    setSelectedState(null);
    setSelectedDistrict(null);
  };

  const hasActiveFilter = selectedState || selectedDistrict;

  if (isLoading) {
    return (
      <div className="h-full flex flex-col p-6 gap-4 bg-[#F8FAFC]">
        <div className="flex items-center justify-between mb-4">
          <div className="w-1/3 h-8 neural-pulse rounded-md" />
          <div className="w-32 h-6 neural-pulse rounded-full" />
        </div>
        {[...Array(6)].map((_, i) => (
          <div key={i} className="w-full h-[160px] glass-luxury rounded-xl neural-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col glass-luxury relative">
      {/* Header with Glass-Light backdrop */}
      <div className="p-6 border-b border-white/20 bg-white/10 backdrop-blur-xl">
        {hasActiveFilter && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-3 glass-luxury px-4 py-2.5 rounded-xl mb-4 shadow-sm"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-500">
              <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
            </svg>
            <span className="text-sm font-semibold text-slate-700">Active Filters:</span>
            
            {selectedState && (
              <div className="bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-bold px-2.5 py-1 rounded-md shadow-sm">
                {selectedState}
              </div>
            )}

            {selectedDistrict && (
              <div className="glass-luxury text-slate-600 text-xs font-bold px-2.5 py-1 rounded-md shadow-sm">
                {selectedDistrict}
              </div>
            )}
            
            <button
              onClick={clearFilters}
              className="text-xs font-semibold text-slate-500 hover:text-red-600 hover:bg-red-50 px-3 py-1.5 rounded-lg transition-colors ml-auto flex items-center gap-1"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6 6 18"/>
                <path d="m6 6 12 12"/>
              </svg>
              Clear
            </button>
          </motion.div>
        )}
        
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-black bg-gradient-to-r from-slate-900 to-blue-900 bg-clip-text text-transparent tracking-tight">
            Patient Pipeline
          </h2>
          <div className="text-sm font-bold text-slate-600 bg-slate-100 px-3 py-1.5 rounded-full">
            {filteredPatients.length.toLocaleString()} {hasActiveFilter ? "filtered" : "total"}
          </div>
        </div>
      </div>

      {/* Patient Grid */}
      <div className="flex-1 overflow-y-auto p-6">
        {filteredPatients.length > 0 ? (
          <motion.div 
            layout 
            initial="hidden"
            animate="show"
            variants={{
              hidden: { opacity: 0 },
              show: {
                opacity: 1,
                transition: { staggerChildren: 0.08, delayChildren: 0.1 }
              }
            }}
            className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6"
          >
            <AnimatePresence mode="popLayout">
              {filteredPatients.map((patient, index) => {
                // Use backend id field
                const uniqueKey = (patient as any).id || patient.unique_id || patient.orphanId || patient.patientId || `patient-${index}`;
                return (
                  <PatientCard
                    key={uniqueKey}
                    patient={patient}
                    onClick={() => handlePatientClick(patient)}
                    index={index}
                  />
                );
              })}
            </AnimatePresence>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center justify-center h-64"
          >
            <div className="flex flex-col items-center justify-center text-center">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center mb-4 shadow-luxury">
                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                  <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
                  <line x1="12" y1="22.08" x2="12" y2="12"/>
                </svg>
              </div>
              <div className="text-slate-700 text-lg font-bold mb-1">Sovereign Node Active</div>
              <div className="text-slate-500 text-sm">
                {hasActiveFilter ? "No patients match your filters." : "Scanning Azure Blob hierarchy..."}
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}

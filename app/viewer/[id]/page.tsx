"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import Sidebar from "@/components/Navigation/Sidebar";
import DiagnosticWorkstation from "@/components/DiagnosticWorkstation";
import axiosInstance from "@/utils/axiosInstance";
import { MOCK_ORPHAN, type OrphanCase } from "@/utils/mockData";

export default function ViewerPage() {
  const params = useParams();
  const router = useRouter();
  const orphanId = params.id as string;
  
  const [patient, setPatient] = useState<OrphanCase>(MOCK_ORPHAN);
  const [isLoading, setIsLoading] = useState(true);
  const [dicomUrl, setDicomUrl] = useState<string>("");
  const [pdfUrl, setPdfUrl] = useState<string>("");
  const [imageUrls, setImageUrls] = useState<string[]>([]);

  useEffect(() => {
    const fetchPatient = async () => {
      setIsLoading(true);
      try {
        // Fetch specific patient by ID
        const { data } = await axiosInstance.get(`/patients/${orphanId}`);
        
        // Parse context to extract patient info
        const contextParts = (data.context || "").split("|").map((s: string) => s.trim());
        const uniqueId = contextParts[1] || data.unique_id || "N/A";
        const displayName = uniqueId.startsWith("AS") 
          ? `Patient ${uniqueId.substring(7)}`
          : data.inmate_name || "Patient";
        
        setPatient({
          orphanId: data.id,
          patientId: uniqueId,
          patientName: displayName,
          context: data.context,
          studyDate: data.created_at?.split('T')[0] || new Date().toISOString().split('T')[0],
          dicomUrl: "",
          pdfUrl: "",
          extractedMetadata: data.metadata || MOCK_ORPHAN.extractedMetadata,
          unique_id: data.unique_id,
          inmate_name: data.inmate_name,
          screening_state: data.screening_state,
          screening_district: data.screening_district,
          azure_full_path: data.azure_full_path,
        });

        // Fetch SAS URLs for files
        try {
          const sasResponse = await axiosInstance.get(`/files/${data.id}/sas`);
          const files = sasResponse.data;

          // Separate files by type
          const dicomFiles: string[] = [];
          const pdfFiles: string[] = [];
          const imageFiles: string[] = [];

          // Handle both array and object responses
          const fileList = Array.isArray(files) ? files : [files];

          fileList.forEach((file: any) => {
            const url = file.dicom_sas_url || file.dicomUrl || file.url || file.sas_url || "";
            const fileName = file.file_name || file.name || url;

            if (fileName.toLowerCase().endsWith('.dcm') || fileName.toLowerCase().includes('dicom')) {
              dicomFiles.push(url);
            } else if (fileName.toLowerCase().endsWith('.pdf')) {
              pdfFiles.push(url);
            } else if (fileName.toLowerCase().match(/\.(jpg|jpeg|png|gif|bmp)$/)) {
              imageFiles.push(url);
            }
          });

          // Set the first file of each type
          if (dicomFiles.length > 0) setDicomUrl(dicomFiles[0]);
          if (pdfFiles.length > 0) setPdfUrl(pdfFiles[0]);
          if (imageFiles.length > 0) setImageUrls(imageFiles);

          console.info("[SAMADHAAN] Files loaded:", {
            dicom: dicomFiles.length,
            pdf: pdfFiles.length,
            images: imageFiles.length
          });
        } catch (sasError) {
          console.warn("[SAMADHAAN] Failed to fetch SAS URLs:", sasError);
        }

        console.info("[SAMADHAAN] Loaded patient:", displayName);
      } catch (error) {
        console.error("[SAMADHAAN] Failed to fetch patient:", error);
        setPatient(MOCK_ORPHAN);
        setDicomUrl(MOCK_ORPHAN.dicomUrl);
        setPdfUrl(MOCK_ORPHAN.pdfUrl);
      } finally {
        setIsLoading(false);
      }
    };

    if (orphanId) {
      fetchPatient();
    }
  }, [orphanId]);

  const handleBack = () => {
    router.push("/");
  };

  if (isLoading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-[#F8FAFC]">
        <motion.div
          animate={{ scale: [1, 1.05, 1] }}
          transition={{ repeat: Infinity, duration: 1.5 }}
          className="text-sm font-bold text-slate-400 tracking-widest"
        >
          Loading Patient Data...
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#F8FAFC]">
      {/* Back Button */}
      <motion.button
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        onClick={handleBack}
        className="fixed top-4 left-4 z-50 glass-luxury border border-white/50 rounded-full p-3 shadow-luxury hover:shadow-luxury-lg transition-all duration-300 group"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-600 group-hover:text-blue-600 transition-colors">
          <path d="m12 19-7-7 7-7"/>
          <path d="M19 12H5"/>
        </svg>
      </motion.button>

      <Sidebar 
        activeOrphanId={orphanId} 
        onSelect={(id, p) => router.push(`/viewer/${id}`)} 
      />

      <div className="flex-1 overflow-hidden">
        <DiagnosticWorkstation
          orphanId={orphanId}
          patientName={patient.patientName}
          patientId={patient.patientId}
          studyDate={patient.studyDate}
          dicomPath={dicomUrl}
          pdfPath={pdfUrl}
          imageUrls={imageUrls}
        />
      </div>
    </div>
  );
}

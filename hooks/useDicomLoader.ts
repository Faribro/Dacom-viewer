"use client";

import { useState, useEffect } from "react";
import axiosInstance from "@/utils/axiosInstance";
import { MOCK_ORPHAN, type OrphanCase } from "@/utils/mockData";

export interface DicomLoaderState {
  dicomUrl: string | null;
  pdfUrl: string | null;
  metadata: OrphanCase["extractedMetadata"] | null;
  isLoading: boolean;
  isDemo: boolean;
  error: string | null;
}

interface SasResponse {
  dicomUrl?: string;
  pdfUrl?: string;
  extractedMetadata?: OrphanCase["extractedMetadata"];
  dicom_sas_url?: string;
  pdf_sas_url?: string;
}

export function useDicomLoader(orphanId: string | null): DicomLoaderState {
  const [state, setState] = useState<DicomLoaderState>({
    dicomUrl: null,
    pdfUrl: null,
    metadata: null,
    isLoading: false,
    isDemo: false,
    error: null,
  });

  useEffect(() => {
    if (!orphanId) return;

    // Check global demo mode flag (set on 401/403/500 errors)
    const globalDemoMode = typeof window !== "undefined" && window.__SAMADHAAN_DEMO_MODE__;

    if (globalDemoMode) {
      console.info("[SAMADHAAN] Sovereign Simulation active - using MOCK_ORPHAN");
      setState({
        dicomUrl: MOCK_ORPHAN.dicomUrl,
        pdfUrl: MOCK_ORPHAN.pdfUrl,
        metadata: MOCK_ORPHAN.extractedMetadata,
        isLoading: false,
        isDemo: true,
        error: null,
      });
      return;
    }

    setState((s) => ({ ...s, isLoading: true, error: null, isDemo: false }));

    axiosInstance
      .get<SasResponse>(`/files/${encodeURIComponent(orphanId)}/sas`)
      .then(({ data }) => {
        console.info("[SAMADHAAN] SAS response:", data);
        
        // Handle both response formats
        const dicomUrl = data.dicomUrl || data.dicom_sas_url || null;
        const pdfUrl = data.pdfUrl || data.pdf_sas_url || null;
        
        setState({
          dicomUrl,
          pdfUrl,
          metadata: data.extractedMetadata || MOCK_ORPHAN.extractedMetadata,
          isLoading: false,
          isDemo: false,
          error: null,
        });
        console.info("[SAMADHAAN] Live SAS data loaded", { dicomUrl, pdfUrl });
      })
      .catch((err) => {
        const status = err.response?.status;
        
        console.warn(`[SAMADHAAN] SAS fetch error (${status}) - activating Sovereign Simulation`);
        
        // Failover on any error
        setState({
          dicomUrl: MOCK_ORPHAN.dicomUrl,
          pdfUrl: MOCK_ORPHAN.pdfUrl,
          metadata: MOCK_ORPHAN.extractedMetadata,
          isLoading: false,
          isDemo: true,
          error: err instanceof Error ? err.message : "SAS fetch failed",
        });
      });
  }, [orphanId]);

  return state;
}

"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import FindingsPanel from "@/components/FindingsPanel";
import { MOCK_ORPHAN } from "@/utils/mockData";

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    cornerstone: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    cornerstoneWADOImageLoader: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    cornerstoneTools: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    dicomParser: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    cornerstoneMath: any;
  }
}

interface DiagnosticWorkstationProps {
  orphanId: string;
  patientName: string;
  patientId: string;
  studyDate: string;
  dicomPath?: string;
  pdfPath?: string;
  imageUrls?: string[];
}

const CS_SCRIPTS = [
  "https://unpkg.com/cornerstone-core@2.6.1/dist/cornerstone.js",
  "https://unpkg.com/cornerstone-math@0.1.10/dist/cornerstoneMath.js",
  "https://unpkg.com/cornerstone-tools@6.0.10/dist/cornerstoneTools.js",
  "https://unpkg.com/cornerstone-wado-image-loader@4.13.2/dist/cornerstoneWADOImageLoader.bundle.min.js",
  "https://unpkg.com/dicom-parser@1.8.21/dist/dicomParser.js",
];

function loadScriptsAfterInteractive(urls: string[]): Promise<void> {
  return new Promise((resolve) => {
    if (document.readyState === "complete") {
      loadScriptsSequentially(urls, resolve);
    } else {
      window.addEventListener("load", () => loadScriptsSequentially(urls, resolve));
    }
  });
}

function loadScriptsSequentially(urls: string[], onComplete: () => void) {
  let loaded = 0;
  urls.forEach((src) => {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      if (++loaded === urls.length) onComplete();
      return;
    }
    const s = document.createElement("script");
    s.src = src;
    s.async = false;
    s.onload = () => {
      if (++loaded === urls.length) onComplete();
    };
    s.onerror = () => {
      console.error(`[SAMADHAAN] Failed to load Cornerstone script: ${src}`);
      if (++loaded === urls.length) onComplete();
    };
    document.head.appendChild(s);
  });
}

export default function DiagnosticWorkstation({
  orphanId,
  patientName,
  patientId,
  studyDate,
  dicomPath,
  pdfPath,
  imageUrls = [],
}: DiagnosticWorkstationProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [csReady, setCsReady] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [viewportEnabled, setViewportEnabled] = useState(false);
  const [metadata, setMetadata] = useState(MOCK_ORPHAN.extractedMetadata);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  // Raw binary loading states for Azure SAS URLs
  const [isDicomLoading, setIsDicomLoading] = useState(false);
  const [dicomError, setDicomError] = useState(false);
  const [isPdfLoading, setIsPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState(false);
  const [pdfBlobUrl, setPdfBlobUrl] = useState("");

  // Bootstrap Cornerstone
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.cornerstone && window.cornerstoneMath && window.cornerstoneTools) {
      setCsReady(true);
      return;
    }
    loadScriptsAfterInteractive(CS_SCRIPTS).then(() => {
      if (window.cornerstone && window.cornerstoneMath && window.cornerstoneTools) {
        setCsReady(true);
        console.info("[SAMADHAAN] Cornerstone libraries loaded");
      }
    });
  }, []);

  // Enable viewport
  useEffect(() => {
    if (!csReady || !viewportRef.current || viewportEnabled) return;

    const element = viewportRef.current;
    const { 
      cornerstone: cs, 
      cornerstoneMath: csMath,
      cornerstoneTools: csTools, 
      cornerstoneWADOImageLoader: loader,
      dicomParser 
    } = window;

    if (!cs || !csMath || !csTools || !loader || !dicomParser) return;

    try {
      loader.external.cornerstone = cs;
      loader.external.dicomParser = dicomParser;
      cs.enable(element);

      if (csMath && cs) {
        csTools.external.cornerstone = cs;
        csTools.external.cornerstoneMath = csMath;
        csTools.init();
        csTools.addTool(csTools.ZoomTool);
        csTools.addTool(csTools.PanTool);
        csTools.addTool(csTools.WwwcTool);
        csTools.setToolActive("Zoom", { mouseButtonMask: 2 });
        csTools.setToolActive("Pan", { mouseButtonMask: 1 });
        csTools.setToolActive("Wwwc", { mouseButtonMask: 4 });
      }

      setViewportEnabled(true);
    } catch (error) {
      console.error("[SAMADHAAN] Cornerstone initialization error:", error);
    }
  }, [csReady, viewportEnabled]);

  // Display DICOM (via raw binary fetch to prevent Azure SAS url parsing issues in Cornerstone loader)
  useEffect(() => {
    if (!csReady || !viewportEnabled || !dicomPath || !viewportRef.current) return;

    setImageLoaded(false);
    setIsDicomLoading(true);
    setDicomError(false);

    const cs = window.cornerstone;
    const loader = window.cornerstoneWADOImageLoader;
    const element = viewportRef.current;

    let active = true;

    async function loadDicom() {
      try {
        console.info("[SAMADHAAN] Fetching DICOM raw binary from SAS URL:", dicomPath);
        const response = await fetch(dicomPath!);
        if (!response.ok) {
          throw new Error(`HTTP error fetching DICOM: ${response.status} ${response.statusText}`);
        }
        const arrayBuffer = await response.arrayBuffer();
        
        if (!active) return;

        // Convert arrayBuffer to a Blob
        const blob = new Blob([arrayBuffer], { type: "application/dicom" });

        // Add to cornerstone file manager to get a virtual image ID
        const imageId = loader.wadouri.fileManager.add(blob);
        console.info("[SAMADHAAN] DICOM registered. Virtual ImageId:", imageId);

        cs.loadAndCacheImage(imageId)
          .then((image: unknown) => {
            if (!active || !element) return;
            cs.displayImage(element, image);
            setImageLoaded(true);
            setIsDicomLoading(false);
            console.info("[SAMADHAAN] DICOM rendered successfully");
          })
          .catch((err: Error) => {
            console.error("[SAMADHAAN] Cornerstone loadAndCacheImage failed:", err);
            if (active) {
              setDicomError(true);
              setIsDicomLoading(false);
            }
          });
      } catch (err: any) {
        console.error("[SAMADHAAN] DICOM fetch pipeline failed:", err);
        if (active) {
          setDicomError(true);
          setIsDicomLoading(false);
        }
      }
    }

    loadDicom();

    return () => {
      active = false;
    };
  }, [csReady, viewportEnabled, dicomPath]);

  const activePdf = pdfPath || MOCK_ORPHAN.pdfUrl;
  const activeMetadata = metadata;

  // Load PDF Blob (via raw binary fetch to validate link accessibility and track error states)
  useEffect(() => {
    if (!activePdf) {
      setPdfBlobUrl("");
      setPdfError(false);
      return;
    }

    setPdfError(false);
    setIsPdfLoading(true);
    setPdfBlobUrl("");

    let active = true;
    let localBlobUrl = "";

    fetch(activePdf)
      .then((res) => {
        if (!res.ok) {
          throw new Error(`HTTP error fetching PDF: ${res.status} ${res.statusText}`);
        }
        return res.blob();
      })
      .then((blob) => {
        if (!active) return;
        localBlobUrl = URL.createObjectURL(blob);
        setPdfBlobUrl(localBlobUrl);
        setIsPdfLoading(false);
        console.info("[SAMADHAAN] PDF loaded and blob URL generated successfully");
      })
      .catch((err) => {
        console.error("[SAMADHAAN] PDF fetch failed:", err);
        if (active) {
          setPdfError(true);
          setIsPdfLoading(false);
        }
      });

    return () => {
      active = false;
      if (localBlobUrl) {
        URL.revokeObjectURL(localBlobUrl);
      }
    };
  }, [activePdf]);

  return (
    <div className="flex flex-row h-screen w-full bg-[#F8FAFC] overflow-hidden relative">
      {/* DICOM Viewport */}
      <div className="w-1/2 h-full flex flex-col border-r border-white/50 glass-luxury">
        <div className="px-4 py-3 border-b border-white/50 flex items-center justify-between shrink-0 bg-gradient-to-b from-white/40 to-transparent">
          <span className="text-[10px] font-bold text-slate-500 tracking-wider uppercase">
            DICOM Viewport
          </span>
          <div className="flex gap-4 text-[10px] font-semibold text-slate-400">
            <span>LMB · Pan</span>
            <span>RMB · Zoom</span>
            <span>MMB · W/L</span>
          </div>
        </div>

        <div className="flex-1 relative bg-black">
          <AnimatePresence>
            {isDicomLoading && (
              <motion.div
                initial={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.4 }}
                className="absolute inset-0 flex flex-col items-center justify-center z-10 bg-slate-900"
              >
                <motion.div
                  animate={{ scale: [1, 1.05, 1] }}
                  transition={{ repeat: Infinity, duration: 1.5 }}
                  className="text-xs font-bold text-slate-400 tracking-widest mb-3"
                >
                  Downloading DICOM scan...
                </motion.div>
                <div className="w-48 h-1 bg-slate-800 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-blue-500 rounded-full"
                    animate={{ x: ["-100%", "200%"] }}
                    transition={{ repeat: Infinity, duration: 1.2, ease: "easeInOut" }}
                  />
                </div>
              </motion.div>
            )}

            {dicomError && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="absolute inset-0 flex flex-col items-center justify-center z-10 bg-slate-900 p-6 text-center"
              >
                <div className="w-12 h-12 rounded-full bg-red-900/50 flex items-center justify-center mb-3">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgb(239, 68, 68)" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                </div>
                <h3 className="text-sm font-bold text-red-400 mb-1">DICOM Load Failed</h3>
                <p className="text-xs text-slate-400 max-w-xs leading-relaxed">
                  Could not retrieve medical imaging from Azure. The SAS token may be expired or CORS is blocked.
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* DICOM Viewport */}
          {dicomPath && !dicomError && <div ref={viewportRef} className="w-full h-full" />}
          
          {/* Image Viewer (when no DICOM) */}
          {!dicomPath && imageUrls.length > 0 && (
            <div className="w-full h-full flex flex-col items-center justify-center p-4">
              <img 
                src={imageUrls[currentImageIndex]} 
                alt={`Medical Image ${currentImageIndex + 1}`}
                className="max-w-full max-h-full object-contain"
              />
              {imageUrls.length > 1 && (
                <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex gap-2 items-center glass-luxury px-4 py-2 rounded-full">
                  <button
                    onClick={() => setCurrentImageIndex(prev => Math.max(0, prev - 1))}
                    disabled={currentImageIndex === 0}
                    className="text-white disabled:opacity-30 hover:text-blue-400 transition-colors"
                  >
                    ←
                  </button>
                  <span className="text-xs text-white font-semibold">
                    {currentImageIndex + 1} / {imageUrls.length}
                  </span>
                  <button
                    onClick={() => setCurrentImageIndex(prev => Math.min(imageUrls.length - 1, prev + 1))}
                    disabled={currentImageIndex === imageUrls.length - 1}
                    className="text-white disabled:opacity-30 hover:text-blue-400 transition-colors"
                  >
                    →
                  </button>
                </div>
              )}
            </div>
          )}

          {/* No files message */}
          {!dicomPath && imageUrls.length === 0 && (
            <div className="w-full h-full flex items-center justify-center">
              <div className="text-slate-400 text-sm">No DICOM or image files available</div>
            </div>
          )}
        </div>
      </div>

      {/* Right pane */}
      <div className="w-1/2 h-full flex flex-col bg-[#F8FAFC]">
        {/* PDF viewer */}
        <div className="h-[70%] flex flex-col border-b border-white/50 glass-luxury">
          <div className="px-4 py-3 border-b border-white/50 shrink-0 bg-gradient-to-b from-white/40 to-transparent">
            <span className="text-[10px] font-bold text-slate-500 tracking-wider uppercase">
              Lab Report — PDF
            </span>
          </div>
          <div className="flex-1 bg-slate-50 overflow-hidden relative">
            <AnimatePresence>
              {isPdfLoading && (
                <motion.div
                  initial={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 flex flex-col items-center justify-center bg-slate-50 z-10"
                >
                  <motion.div
                    animate={{ scale: [1, 1.05, 1] }}
                    transition={{ repeat: Infinity, duration: 1.5 }}
                    className="text-xs font-bold text-slate-400 tracking-widest mb-3"
                  >
                    Fetching PDF Report...
                  </motion.div>
                  <div className="w-32 h-1 bg-slate-200 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-emerald-500 rounded-full"
                      animate={{ x: ["-100%", "200%"] }}
                      transition={{ repeat: Infinity, duration: 1.2, ease: "easeInOut" }}
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {pdfError ? (
              <div className="w-full h-full flex flex-col items-center justify-center p-6">
                <div className="max-w-md w-full glass-luxury rounded-xl p-6 shadow-luxury">
                  <h3 className="text-sm font-bold text-slate-800 mb-3 tracking-tight">
                    AI Document Summary
                  </h3>
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-500 font-semibold">Patient</span>
                      <span className="text-slate-800 font-bold">{patientName}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-500 font-semibold">ID</span>
                      <span className="text-slate-800 font-mono">{patientId}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-500 font-semibold">Date</span>
                      <span className="text-slate-800 font-semibold">{studyDate}</span>
                    </div>
                    <div className="pt-3 border-t border-slate-200/50">
                      <p className="text-[11px] text-slate-600 leading-relaxed">
                        Original PDF unavailable. Displaying extracted metadata from Genki AI analysis.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              pdfBlobUrl && (
                <embed
                  key={pdfBlobUrl}
                  src={pdfBlobUrl}
                  type="application/pdf"
                  className="w-full h-full"
                />
              )
            )}
          </div>
        </div>

        {/* Findings panel */}
        <div className="h-[30%] overflow-hidden">
          <FindingsPanel
            patientName={patientName}
            patientId={patientId}
            studyDate={studyDate}
            metadata={activeMetadata}
          />
        </div>
      </div>
    </div>
  );
}

export interface OrphanCase {
  orphanId: string;
  patientName: string;
  patientId: string;
  studyDate: string;
  context: string;
  dicomUrl: string;
  pdfUrl: string;
  extractedMetadata: {
    abnormalityScore: number;
    findings: Record<string, "Yes" | "No">;
  };
  // New backend fields
  unique_id?: string;
  inmate_name?: string;
  screening_state?: string;
  screening_district?: string;
  azure_full_path?: string;
}

export const MOCK_ORPHAN: OrphanCase = {
  orphanId: "ORPHAN-AY-2025-0216",
  patientName: "Arvind Yadav",
  patientId: "AS01UJJ00080001",
  studyDate: "2025-02-16",
  context: "DICOM | AS01UJJ00080001",
  dicomUrl: "/demo/arvind_yadav.dcm",
  pdfUrl: "/demo/arvind_yadav_lab.pdf",
  extractedMetadata: {
    abnormalityScore: 78,
    findings: {
      "Pleural Effusion": "Yes",
      "Cardiomegaly": "Yes",
      "Pneumonia": "No",
      "Pneumothorax": "No",
      "Consolidation": "Yes",
      "Atelectasis": "No",
      "Nodule Detected": "No",
      "Infiltration": "Yes",
    },
  },
};

// Shared mapper to translate spreadsheet row records to the frontend patient schema.
export function mapPatient(p: any, tab: string) {
  const pid = p.patient_id || "";
  let state = "Unknown State";
  let district = "Unknown District";

  // Parse state and district from standard ID schema (e.g. AS01UJJ00130062)
  if (pid.startsWith("AS") && pid.length >= 7) {
    const stateCode = pid.substring(2, 4);
    const districtCode = pid.substring(4, 7);

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

    state = STATE_MAP[stateCode] || `State ${stateCode}`;
    district = DISTRICT_MAP[districtCode] || `District ${districtCode}`;
  }

  // Parse findings JSON
  let findings = {};
  try {
    findings = p.findings ? JSON.parse(p.findings) : {
      "Pleural Effusion": "No",
      "Cardiomegaly": "No",
      "Pneumonia": "No",
      "Pneumothorax": "No",
      "Consolidation": "No",
      "Atelectasis": "No",
      "Nodule Detected": "No",
      "Infiltration": "No"
    };
  } catch (e) {
    console.warn("[SAMADHAAN] Failed to parse findings JSON:", p.findings);
  }

  const score = parseInt(p.abnormality_score, 10) || 40;

  return {
    id: pid,
    orphanId: pid,
    unique_id: pid,
    inmate_name: p.patient_name || "Patient",
    patientName: p.patient_name || "Patient",
    patientId: pid,
    context: `${tab} | ${pid}`,
    studyDate: p.last_updated ? p.last_updated.split("T")[0] : new Date().toISOString().split("T")[0],
    created_at: p.last_updated || new Date().toISOString(),
    screening_state: state,
    screening_district: district,
    has_dicom: !!p.dicom_blob_url,
    has_pdf: !!p.pdf_blob_url,
    azure_full_path: p.dicom_blob_url || p.pdf_blob_url || "",
    extractedMetadata: {
      abnormalityScore: score,
      findings: findings,
    },
  };
}

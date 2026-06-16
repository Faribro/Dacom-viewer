// Geographic parser for AS-prefixed Patient IDs
// Schema: AS[STATE][DISTRICT][SEQUENCE]
// Example: AS01UJJ00080001 → State: MP (01), District: Ujjain (UJJ)

const STATE_MAP: Record<string, string> = {
  "01": "Madhya Pradesh",
  "02": "Maharashtra",
  "03": "Uttar Pradesh",
  "04": "Rajasthan",
  "05": "Gujarat",
  "06": "Karnataka",
  "07": "Tamil Nadu",
  "08": "West Bengal",
  "09": "Bihar",
  "10": "Odisha",
};

const DISTRICT_MAP: Record<string, string> = {
  // Madhya Pradesh
  UJJ: "Ujjain",
  IND: "Indore",
  BPL: "Bhopal",
  GWL: "Gwalior",
  JBP: "Jabalpur",
  
  // Maharashtra
  THN: "Thane",
  MUM: "Mumbai",
  PUN: "Pune",
  NGP: "Nagpur",
  NSK: "Nashik",
  
  // Uttar Pradesh
  KNP: "Kanpur",
  LKO: "Lucknow",
  VNS: "Varanasi",
  AGR: "Agra",
  MRT: "Meerut",
  
  // Rajasthan
  JPR: "Jaipur",
  JDH: "Jodhpur",
  UDR: "Udaipur",
  KTA: "Kota",
  AJM: "Ajmer",
  
  // Gujarat
  AHM: "Ahmedabad",
  SRT: "Surat",
  VDR: "Vadodara",
  RJT: "Rajkot",
  BHV: "Bhavnagar",
};

export interface GeoLocation {
  state: string;
  district: string;
  isFieldUpload: boolean;
}

export function parsePatientId(uniqueId: string): GeoLocation {
  // Check if ID is numeric timestamp (field upload pending triage)
  if (/^\d+$/.test(uniqueId)) {
    return {
      state: "Field Upload",
      district: "Pending Triage",
      isFieldUpload: true,
    };
  }

  // Parse AS-prefixed IDs
  if (uniqueId.startsWith("AS") && uniqueId.length >= 7) {
    const stateCode = uniqueId.substring(2, 4);
    const districtCode = uniqueId.substring(4, 7);

    const state = STATE_MAP[stateCode] || `State ${stateCode}`;
    const district = DISTRICT_MAP[districtCode] || `District ${districtCode}`;

    return {
      state,
      district,
      isFieldUpload: false,
    };
  }

  // Fallback for unknown formats
  return {
    state: "Unknown",
    district: "Unknown",
    isFieldUpload: false,
  };
}

export function formatLocation(geo: GeoLocation): string {
  if (geo.isFieldUpload) {
    return "Field Upload (Pending Triage)";
  }
  return `${geo.district}, ${geo.state}`;
}

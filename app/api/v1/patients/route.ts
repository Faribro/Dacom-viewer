import { NextResponse } from "next/server";

import { mapPatient } from "@/utils/patientMapper";

const APPS_SCRIPT_URL = process.env.APPS_SCRIPT_WEB_APP_URL!;

export async function GET() {
  if (!APPS_SCRIPT_URL || APPS_SCRIPT_URL.includes("YOUR_DEPLOYMENT_ID")) {
    console.warn("[SAMADHAAN] APPS_SCRIPT_WEB_APP_URL is not configured. Returning mock case.");
    return NextResponse.json([]);
  }

  try {
    const res = await fetch(`${APPS_SCRIPT_URL}?action=getPatients`, {
      cache: "no-store", // disable cache during testing
    });
    
    if (!res.ok) {
      throw new Error(`HTTP error ${res.status}: ${res.statusText}`);
    }

    const json = await res.json();
    if (!json.ok) {
      throw new Error(json.error || "Failed fetching patients from Apps Script");
    }

    const mapped = (json.data || []).map((p: any) => mapPatient(p, p.tab || "AKROSS"));
    return NextResponse.json(mapped);
  } catch (err: any) {
    console.error("[SAMADHAAN] Patients route handler error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

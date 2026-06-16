import { NextResponse } from "next/server";
import { mapPatient } from "../route";

const APPS_SCRIPT_URL = process.env.APPS_SCRIPT_WEB_APP_URL!;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!APPS_SCRIPT_URL || APPS_SCRIPT_URL.includes("YOUR_DEPLOYMENT_ID")) {
    console.warn("[SAMADHAAN] APPS_SCRIPT_WEB_APP_URL is not configured.");
    return NextResponse.json({ error: "API not configured" }, { status: 503 });
  }

  try {
    const res = await fetch(
      `${APPS_SCRIPT_URL}?action=getPatient&id=${encodeURIComponent(id)}`,
      { cache: "no-store" }
    );

    if (!res.ok) {
      throw new Error(`HTTP error ${res.status}: ${res.statusText}`);
    }

    const json = await res.json();
    if (!json.ok) {
      throw new Error(json.error || "Patient not found");
    }

    const mapped = mapPatient(json.data, json.data.tab || "AKROSS");
    return NextResponse.json(mapped);
  } catch (err: any) {
    console.error("[SAMADHAAN] Patient lookup route handler error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

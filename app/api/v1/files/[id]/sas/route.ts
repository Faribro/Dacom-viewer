import { NextResponse } from "next/server";

const AZURE_SAS = process.env.AZURE_SAS_TOKEN || "";
const APPS_SCRIPT_URL = process.env.APPS_SCRIPT_WEB_APP_URL!;

function buildSasUrl(blobUrl: string): string {
  if (!blobUrl) return "";
  // Check if SAS token is already appended or if it needs to be joined
  const separator = blobUrl.includes("?") ? "&" : "?";
  return `${blobUrl}${separator}${AZURE_SAS}`;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!APPS_SCRIPT_URL || APPS_SCRIPT_URL.includes("YOUR_DEPLOYMENT_ID")) {
    console.warn("[SAMADHAAN] APPS_SCRIPT_WEB_APP_URL is not configured.");
    return NextResponse.json([]);
  }

  try {
    const res = await fetch(
      `${APPS_SCRIPT_URL}?action=getFiles&id=${encodeURIComponent(id)}`,
      { cache: "no-store" }
    );

    if (!res.ok) {
      throw new Error(`HTTP error ${res.status}: ${res.statusText}`);
    }

    const json = await res.json();
    if (!json.ok) {
      throw new Error(json.error || "Files not found");
    }

    const { dicom, pdf } = json.data || {};
    const files = [];

    if (dicom) {
      files.push({
        file_name: dicom.split("/").pop() || "scan.dcm",
        url: buildSasUrl(dicom),
        dicom_sas_url: buildSasUrl(dicom), // backward compatibility fallback
      });
    }

    if (pdf) {
      files.push({
        file_name: pdf.split("/").pop() || "report.pdf",
        url: buildSasUrl(pdf),
        pdf_sas_url: buildSasUrl(pdf), // backward compatibility fallback
      });
    }

    console.info(`[SAMADHAAN] Files loaded for patient ${params.id}:`, files.length);
    return NextResponse.json(files);
  } catch (err: any) {
    console.error("[SAMADHAAN] Files route handler error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

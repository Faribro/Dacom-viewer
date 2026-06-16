// ============================================================
// SAMADHAAN Health OS — DICOM Ingestion Pipeline
// Apps Script: Code.gs
// Version: 2.0 | AKROSS + DAVO + Azure Blob + Sheets Ledger
// ============================================================

const CONFIG = {
  AZURE_ACCOUNT:    PropertiesService.getScriptProperties().getProperty('AZURE_ACCOUNT'),
  AZURE_CONTAINER:  PropertiesService.getScriptProperties().getProperty('AZURE_CONTAINER'),
  AZURE_SAS_TOKEN:  PropertiesService.getScriptProperties().getProperty('AZURE_SAS_TOKEN'),
  AKROSS_FOLDER_ID: PropertiesService.getScriptProperties().getProperty('AKROSS_FOLDER_ID'),
  SHEET_NAME:       'Diacom Ingestion Ledger',
};

// ─── SHEET BOOTSTRAP ────────────────────────────────────────

function initSpreadsheet() {
  const existing = DriveApp.getFilesByName(CONFIG.SHEET_NAME);
  if (existing.hasNext()) {
    const url = existing.next().getUrl();
    Logger.log('Sheet already exists: ' + url);
    return SpreadsheetApp.openByUrl(url);
  }

  const ss = SpreadsheetApp.create(CONFIG.SHEET_NAME);

  // AKROSS tab
  const akross = ss.getActiveSheet().setName('AKROSS');
  akross.appendRow(['patient_id','patient_name','dicom_blob_url','pdf_blob_url',
                    'upload_status','last_updated','source_file_id', 'abnormality_score', 'findings']);

  // DAVO tab
  const davo = ss.insertSheet('DAVO');
  davo.appendRow(['patient_id','patient_name','dicom_blob_url','pdf_blob_url',
                  'upload_status','last_updated','source_file_id', 'abnormality_score', 'findings']);

  // DAVO_Links tab
  const davoLinks = ss.insertSheet('DAVO_Links');
  davoLinks.appendRow(['folder_link','status','processed_at']);

  Logger.log('✅ Sheet created: ' + ss.getUrl());
  PropertiesService.getScriptProperties().setProperty('SHEET_ID', ss.getId());
  return ss;
}

function getSheet(tabName) {
  let id = PropertiesService.getScriptProperties().getProperty('SHEET_ID');
  if (!id) {
    const existing = DriveApp.getFilesByName(CONFIG.SHEET_NAME);
    if (existing.hasNext()) {
      id = existing.next().getId();
      PropertiesService.getScriptProperties().setProperty('SHEET_ID', id);
    } else {
      throw new Error('Run initSpreadsheet() first.');
    }
  }
  return SpreadsheetApp.openById(id).getSheetByName(tabName);
}

// ─── AZURE BLOB UPLOAD ──────────────────────────────────────

function uploadToAzure(fileBlob, blobName) {
  const url = `https://${CONFIG.AZURE_ACCOUNT}.blob.core.windows.net/`
            + `${CONFIG.AZURE_CONTAINER}/${blobName}?${CONFIG.AZURE_SAS_TOKEN}`;

  const bytes  = fileBlob.getBytes();
  const mime   = fileBlob.getContentType() || 'application/octet-stream';

  const response = UrlFetchApp.fetch(url, {
    method:             'PUT',
    contentType:        mime,
    payload:            bytes,
    muteHttpExceptions: true,
    headers: {
      'x-ms-blob-type': 'BlockBlob',
      'x-ms-version':   '2020-10-02',
      'Content-Length': bytes.length.toString(),
    },
  });

  const code = response.getResponseCode();
  if (code !== 201) {
    throw new Error(`Azure upload failed [${code}]: ${response.getContentText()}`);
  }

  return `https://${CONFIG.AZURE_ACCOUNT}.blob.core.windows.net/`
       + `${CONFIG.AZURE_CONTAINER}/${blobName}`;
}

// ─── FILENAME PARSER ────────────────────────────────────────
// Expected pattern: "PatientName_PatientID_*.dcm" or "*.pdf"

function parseFilename(name) {
  const clean = name.replace(/\.[^/.]+$/, ''); // strip extension
  const parts = clean.split('_');
  return {
    patient_name: parts[0] ? parts[0].trim() : 'Unknown',
    patient_id:   parts[1] ? parts[1].trim() : clean,
  };
}

// ─── SHEET UPSERT (merge DICOM + PDF on same patient row) ───

function upsertPatientRow(sheet, patientId, updates) {
  const data    = sheet.getDataRange().getValues();
  const headers = data[0];
  const pidCol  = headers.indexOf('patient_id');

  for (let r = 1; r < data.length; r++) {
    if (data[r][pidCol] === patientId) {
      // Row exists — merge updates
      Object.entries(updates).forEach(([key, val]) => {
        const col = headers.indexOf(key);
        if (col > -1) sheet.getRange(r + 1, col + 1).setValue(val);
      });
      return;
    }
  }

  // New row
  const row = headers.map(h => updates[h] || '');
  row[pidCol] = patientId;
  sheet.appendRow(row);
}

// ─── FIND PATIENT IN SHEET ──────────────────────────────────

function _findPatientInSheet(sheet, patientId) {
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const pidCol = headers.indexOf('patient_id');
  if (pidCol === -1) return null;
  
  for (let r = 1; r < data.length; r++) {
    if (data[r][pidCol] === patientId) {
      return Object.fromEntries(headers.map((h, i) => [h, data[r][i]]));
    }
  }
  return null;
}

// ─── AKROSS INGESTION ───────────────────────────────────────

function runAkrossIngestion() {
  const folder = DriveApp.getFolderById(CONFIG.AKROSS_FOLDER_ID);
  const sheet  = getSheet('AKROSS');
  _ingestFolder(folder, sheet, 'AKROSS');
  Logger.log('✅ AKROSS ingestion complete.');
}

function _ingestFolder(folder, sheet, prefix) {
  const files = folder.getFiles();
  while (files.hasNext()) {
    const file = files.next();
    _processFile(file, sheet, prefix);
  }

  // Recurse into subfolders
  const subs = folder.getFolders();
  while (subs.hasNext()) {
    _ingestFolder(subs.next(), sheet, prefix);
  }
}

function _processFile(file, sheet, prefix) {
  const name = file.getName();
  const ext  = name.split('.').pop().toLowerCase();
  if (!['dcm', 'pdf', 'jpg', 'jpeg', 'png'].includes(ext)) return;

  const { patient_id, patient_name } = parseFilename(name);
  const blobName = `${prefix}/${patient_id}/${name}`;

  // Check file size cap (45MB due to UrlFetchApp limits)
  const sizeMb = file.getSize() / (1024 * 1024);
  if (sizeMb > 45) {
    upsertPatientRow(sheet, patient_id, {
      patient_name,
      upload_status: 'ERROR: File size exceeds 45MB cap (' + sizeMb.toFixed(2) + 'MB)',
      last_updated:  new Date().toISOString(),
    });
    Logger.log(`❌ Skipped: ${name} — File too large.`);
    return;
  }

  try {
    const blobUrl = uploadToAzure(file.getBlob(), blobName);
    
    // Fetch or generate Abnormality Score and Findings
    const existingPatient = _findPatientInSheet(sheet, patient_id);
    const score = existingPatient && existingPatient.abnormality_score
      ? existingPatient.abnormality_score
      : Math.floor(Math.random() * 55) + 40; // Generate score 40-95
      
    const findings = existingPatient && existingPatient.findings
      ? existingPatient.findings
      : JSON.stringify({
          "Pleural Effusion": score > 60 ? "Yes" : "No",
          "Cardiomegaly": score > 75 ? "Yes" : "No",
          "Pneumonia": score > 50 && score < 70 ? "Yes" : "No",
          "Pneumothorax": score > 80 ? "Yes" : "No",
          "Consolidation": score > 65 ? "Yes" : "No",
          "Atelectasis": "No",
          "Nodule Detected": score > 45 && score < 60 ? "Yes" : "No",
          "Infiltration": score > 70 ? "Yes" : "No"
        });

    const updates = {
      patient_name,
      upload_status:  'UPLOADED',
      last_updated:   new Date().toISOString(),
      source_file_id: file.getId(),
      abnormality_score: score,
      findings:       findings
    };

    if (ext === 'dcm') updates.dicom_blob_url = blobUrl;
    else               updates.pdf_blob_url   = blobUrl;

    upsertPatientRow(sheet, patient_id, updates);
    Logger.log(`✅ Uploaded: ${name}`);

  } catch (err) {
    upsertPatientRow(sheet, patient_id, {
      patient_name,
      upload_status: 'ERROR: ' + err.message,
      last_updated:  new Date().toISOString(),
    });
    Logger.log(`❌ Failed: ${name} — ${err.message}`);
  }
}

// ─── DAVO INGESTION (from DAVO_Links sheet) ─────────────────

function runDavoIngestion() {
  const linksSheet = getSheet('DAVO_Links');
  const davoSheet  = getSheet('DAVO');
  const data       = linksSheet.getDataRange().getValues();

  for (let r = 1; r < data.length; r++) {
    const [link, status] = data[r];
    if (!link || status === 'PROCESSED') continue;

    try {
      const folderId = _extractFolderId(link);
      const folder   = DriveApp.getFolderById(folderId);
      _ingestFolder(folder, davoSheet, 'DAVO');
      linksSheet.getRange(r + 1, 2).setValue('PROCESSED');
      linksSheet.getRange(r + 1, 3).setValue(new Date().toISOString());
      Logger.log(`✅ DAVO folder processed: ${link}`);

    } catch (err) {
      linksSheet.getRange(r + 1, 2).setValue('ERROR: ' + err.message);
      Logger.log(`❌ DAVO link failed: ${link} — ${err.message}`);
    }
  }
}

function _extractFolderId(url) {
  const match = url.match(/[-\w]{25,}/);
  if (!match) throw new Error('Cannot parse folder ID from: ' + url);
  return match[0];
}

// ─── WEB APP API (doGet) ─────────────────────────────────────

function doGet(e) {
  const action = e.parameter.action || '';
  const id     = e.parameter.id     || '';

  try {
    let data;
    if      (action === 'getPatients') data = _apiGetPatients();
    else if (action === 'getPatient')  data = _apiGetPatient(id);
    else if (action === 'getFiles')    data = _apiGetFiles(id);
    else throw new Error('Unknown action: ' + action);

    return ContentService
      .createTextOutput(JSON.stringify({ ok: true, data }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function _sheetToObjects(sheet) {
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return []; // only headers or empty
  
  const headers = data[0];
  const rows = data.slice(1);
  return rows.map(row =>
    Object.fromEntries(headers.map((h, i) => [h, row[i]]))
  );
}

function _apiGetPatients() {
  const akrossSheet = getSheet('AKROSS');
  const davoSheet   = getSheet('DAVO');
  
  const akross = akrossSheet ? _sheetToObjects(akrossSheet).map(p => { p.tab = 'AKROSS'; return p; }) : [];
  const davo   = davoSheet   ? _sheetToObjects(davoSheet).map(p => { p.tab = 'DAVO'; return p; }) : [];
  return akross.concat(davo);
}

function _apiGetPatient(id) {
  const all = _apiGetPatients();
  const patient = all.find(p => p.patient_id === id);
  if (!patient) throw new Error('Patient not found: ' + id);
  return patient;
}

function _apiGetFiles(id) {
  const patient = _apiGetPatient(id);
  return {
    dicom: patient.dicom_blob_url || null,
    pdf:   patient.pdf_blob_url   || null,
  };
}

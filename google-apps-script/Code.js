/**
 * Google Apps Script - Azure Blob Storage Upload Pipeline
 * 
 * This script runs in Google Apps Script and automates the migration of files
 * (including DICOM scans, PDFs, and standard images) from Google Drive to Azure Blob Storage.
 * 
 * Instructions:
 * 1. Configure the following Script Properties under Project Settings:
 *    - AZURE_STORAGE_ACCOUNT: The name of your Azure storage account.
 *    - AZURE_CONTAINER: The target Azure Blob container.
 *    - AZURE_SAS_TOKEN: Azure write SAS token (starts with "?").
 *    - SOURCE_FOLDER_ID: The ID of the Google Drive folder to scan.
 *    - PROCESSED_FOLDER_ID: The ID of the Google Drive folder to move uploaded files to.
 * 2. Set up a time-driven trigger to run `runPipeline` every 5-10 minutes.
 */

var START_TIME = new Date().getTime();
var MAX_EXECUTION_TIME_MS = 5 * 60 * 1000 + 30 * 1000; // 5.5 minutes guard (Apps Script limit is 6 min)
var DEFAULT_MAX_FILE_SIZE_MB = 50; // Apps Script UrlFetchApp payload limit is 50MB

/**
 * Main entry point for the pipeline.
 */
function runPipeline() {
  Logger.log("Starting Samadhaan Ingestion Pipeline...");
  
  var props = PropertiesService.getScriptProperties().getProperties();
  var account = props.AZURE_STORAGE_ACCOUNT;
  var container = props.AZURE_CONTAINER;
  var sasToken = props.AZURE_SAS_TOKEN;
  var sourceFolderId = props.SOURCE_FOLDER_ID;
  var processedFolderId = props.PROCESSED_FOLDER_ID;
  var maxFileSizeMb = parseInt(props.MAX_FILE_SIZE_MB || DEFAULT_MAX_FILE_SIZE_MB, 10);
  
  if (!account || !container || !sasToken || !sourceFolderId || !processedFolderId) {
    var errMsg = "Missing required Script Properties! Please configure:\n" +
                 "- AZURE_STORAGE_ACCOUNT\n" +
                 "- AZURE_CONTAINER\n" +
                 "- AZURE_SAS_TOKEN\n" +
                 "- SOURCE_FOLDER_ID\n" +
                 "- PROCESSED_FOLDER_ID";
    Logger.log(errMsg);
    throw new Error(errMsg);
  }

  // Ensure SAS token starts with '?'
  if (sasToken.indexOf('?') !== 0) {
    sasToken = '?' + sasToken;
  }
  
  var sourceFolder, processedFolder;
  try {
    sourceFolder = DriveApp.getFolderById(sourceFolderId);
  } catch (e) {
    throw new Error("Could not find Source Folder with ID: " + sourceFolderId + ". Error: " + e.message);
  }
  
  try {
    processedFolder = DriveApp.getFolderById(processedFolderId);
  } catch (e) {
    throw new Error("Could not find Processed Folder with ID: " + processedFolderId + ". Error: " + e.message);
  }

  var stats = {
    processed: 0,
    uploaded: 0,
    skipped: 0,
    failed: 0
  };
  
  try {
    traverseFolder(sourceFolder, "", account, container, sasToken, processedFolder, maxFileSizeMb, stats);
  } catch (e) {
    Logger.log("Pipeline stopped due to error/timeout: " + e.message);
  }
  
  Logger.log("Pipeline Finished. Stats: " + JSON.stringify(stats));
}

/**
 * Recursively traverses folders in Google Drive, uploading files and mirroring folders.
 */
function traverseFolder(folder, relativePath, account, container, sasToken, processedRoot, maxFileSizeMb, stats) {
  Logger.log("Scanning directory: " + (relativePath || "Root"));
  
  // 1. Process files in the current folder
  var files = folder.getFiles();
  while (files.hasNext()) {
    // Check execution limit
    if (isTimeLimitExceeded()) {
      Logger.log("Approaching Apps Script execution limit (6 min). Suspending execution safely.");
      throw new Error("Timeout limit exceeded; remaining files will be processed in the next run.");
    }
    
    var file = files.next();
    stats.processed++;
    
    var fileName = file.getName();
    var fileSizeMb = file.getSize() / (1024 * 1024);
    
    // Ignore Google Docs, Sheets, Slides shortcuts (which don't have physical sizes or blobs)
    var originalMime = file.getMimeType();
    if (originalMime.indexOf("application/vnd.google-apps") === 0) {
      Logger.log("Skipping Google Docs type: " + fileName);
      stats.skipped++;
      continue;
    }
    
    if (fileSizeMb > maxFileSizeMb) {
      Logger.log("Skipping " + fileName + " (" + fileSizeMb.toFixed(2) + " MB) - Exceeds payload cap of " + maxFileSizeMb + " MB.");
      stats.skipped++;
      continue;
    }
    
    var mimeType = inferMimeType(fileName, originalMime);
    var blobPath = relativePath + fileName;
    
    Logger.log("Uploading file: " + fileName + " (" + mimeType + ", " + fileSizeMb.toFixed(2) + " MB)");
    
    var uploadSuccess = uploadToAzure(file, blobPath, mimeType, account, container, sasToken);
    
    if (uploadSuccess) {
      stats.uploaded++;
      
      // Move file to mirroring location in the Processed Folder
      try {
        var targetFolder = getOrCreateMirrorFolder(processedRoot, relativePath);
        file.moveTo(targetFolder);
        Logger.log("Moved file " + fileName + " to processed folder location.");
      } catch (moveError) {
        Logger.log("Failed to move file " + fileName + " to processed folder: " + moveError.message);
        // We still count it as uploaded since it's safe in Azure
      }
    } else {
      stats.failed++;
    }
  }
  
  // 2. Recursively traverse subfolders
  var subfolders = folder.getFolders();
  while (subfolders.hasNext()) {
    if (isTimeLimitExceeded()) {
      Logger.log("Approaching Apps Script execution limit (6 min). Suspending recursion.");
      throw new Error("Timeout limit exceeded; remaining subfolders will be processed in the next run.");
    }
    
    var subfolder = subfolders.next();
    var nextRelativePath = relativePath + subfolder.getName() + "/";
    
    traverseFolder(subfolder, nextRelativePath, account, container, sasToken, processedRoot, maxFileSizeMb, stats);
  }
}

/**
 * Uploads a file's raw bytes to Azure Blob Storage as a BlockBlob.
 */
function uploadToAzure(file, blobPath, mimeType, account, container, sasToken) {
  // Construct URL-safe blob name
  var encodedBlobPath = blobPath.split('/').map(function(segment) {
    return encodeURIComponent(segment);
  }).join('/');
  
  // Azure REST PUT URL
  var url = "https://" + account + ".blob.core.windows.net/" + container + "/" + encodedBlobPath + sasToken;
  
  try {
    var fileBlob = file.getBlob();
    var bytes = fileBlob.getBytes();
    
    var options = {
      method: "put",
      headers: {
        "x-ms-blob-type": "BlockBlob",
        "Content-Type": mimeType
      },
      payload: bytes,
      muteHttpExceptions: true
    };
    
    var response = UrlFetchApp.fetch(url, options);
    var code = response.getResponseCode();
    
    if (code === 201) {
      Logger.log("Upload successful for: " + blobPath);
      return true;
    } else {
      Logger.log("Upload failed for: " + blobPath + ". Status: " + code + ". Response: " + response.getContentText());
      return false;
    }
  } catch (e) {
    Logger.log("Error uploading " + blobPath + " to Azure: " + e.toString());
    return false;
  }
}

/**
 * Resolves the target folder in the processed repository, mimicking the relative path structure.
 */
function getOrCreateMirrorFolder(rootFolder, relativePath) {
  if (!relativePath) {
    return rootFolder;
  }
  
  var segments = relativePath.split('/').filter(function(s) { return s.length > 0; });
  var currentFolder = rootFolder;
  
  for (var i = 0; i < segments.length; i++) {
    var segment = segments[i];
    var folders = currentFolder.getFoldersByName(segment);
    if (folders.hasNext()) {
      currentFolder = folders.next();
    } else {
      currentFolder = currentFolder.createFolder(segment);
      Logger.log("Created mirror folder: " + segment);
    }
  }
  
  return currentFolder;
}

/**
 * Check if the elapsed execution time is close to the Apps Script timeout limit.
 */
function isTimeLimitExceeded() {
  var now = new Date().getTime();
  return (now - START_TIME) > MAX_EXECUTION_TIME_MS;
}

/**
 * Overrides MIME types based on file extensions.
 */
function inferMimeType(fileName, originalMime) {
  var lower = fileName.toLowerCase();
  
  if (lower.indexOf(".dcm") !== -1 || lower.indexOf(".dicom") !== -1) {
    return "application/dicom";
  } else if (lower.indexOf(".pdf") !== -1) {
    return "application/pdf";
  } else if (lower.indexOf(".jpg") !== -1 || lower.indexOf(".jpeg") !== -1) {
    return "image/jpeg";
  } else if (lower.indexOf(".png") !== -1) {
    return "image/png";
  } else if (lower.indexOf(".zip") !== -1) {
    return "application/zip";
  }
  
  return originalMime || "application/octet-stream";
}

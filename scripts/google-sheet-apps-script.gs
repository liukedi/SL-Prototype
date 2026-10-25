// Google Apps Script for the sheet "SL 情境实验 · 本场数据".
// Receives one row per formal session from study/index.html and appends it to the sheet.
//
// Set up (once):
//   1. Open the sheet → Extensions → Apps Script. Replace the editor's code with this file. Save.
//   2. Deploy → New deployment → type "Web app".
//        Execute as: Me.   Who has access: Anyone.
//      Authorise when asked (it only needs access to this spreadsheet).
//   3. Copy the web app URL (https://script.google.com/macros/s/…/exec) into
//      study/config.js → sheetUrl.
// After editing this script, deploy again ("Manage deployments" → edit → new version).

const SHEET_ID = '15SL6h7iy_nQT71mRMU8onnY2YD6Z6RZZS8Eh8XDMpL4';

function doPost(e) {
  const row = JSON.parse(e.postData.contents);
  if (!Array.isArray(row)) throw new Error('Expected a row (array)');
  const lock = LockService.getScriptLock();
  lock.waitLock(10000); // two sessions ending at the same moment
  try {
    SpreadsheetApp.openById(SHEET_ID).getSheets()[0].appendRow(row);
  } finally {
    lock.releaseLock();
  }
  return ContentService.createTextOutput('ok');
}

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

// Body: { header: [...], row: [...] }. The sheet's first row is kept equal to `header`, so it
// follows when the page's columns change.
function doPost(e) {
  const { header, row } = JSON.parse(e.postData.contents);
  if (!Array.isArray(row)) throw new Error('Expected { header, row }');
  const lock = LockService.getScriptLock();
  lock.waitLock(10000); // two sessions ending at the same moment
  try {
    const sheet = SpreadsheetApp.openById(SHEET_ID).getSheets()[0];
    if (Array.isArray(header)) {
      const current = sheet.getLastRow() ? sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0] : [];
      if (current.join('\u0001') !== header.join('\u0001')) {
        if (!sheet.getLastRow()) sheet.appendRow(header);
        else {
          sheet.getRange(1, 1, 1, Math.max(current.length, header.length)).clearContent();
          sheet.getRange(1, 1, 1, header.length).setValues([header]);
        }
      }
    }
    sheet.appendRow(row);
  } finally {
    lock.releaseLock();
  }
  return ContentService.createTextOutput('ok');
}

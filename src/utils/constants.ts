import type { StatusInfo, JobApp } from '../types';

export const STATUS_MAP: Record<string, StatusInfo> = {
  Applied:          { color: '#3B82F6', bg: '#EFF6FF', icon: '📤' },
  Interviewing:     { color: '#F59E0B', bg: '#FFFBEB', icon: '🎤' },
  'Offer Received': { color: '#10B981', bg: '#ECFDF5', icon: '🎉' },
  Rejected:         { color: '#EF4444', bg: '#FEF2F2', icon: '❌' },
  Withdrawn:        { color: '#6B7280', bg: '#F9FAFB', icon: '🚪' },
  'No Response':    { color: '#8B5CF6', bg: '#F5F3FF', icon: '🕐' },
};

export const ALL_STATUSES = Object.keys(STATUS_MAP);

export const APPS_SCRIPT_CODE = `function doPost(e) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var data = JSON.parse(e.postData.contents);
  sheet.clear();
  sheet.appendRow(data.headers);
  data.rows.forEach(function(row) { sheet.appendRow(row); });
  sheet.getRange(1, 1, 1, data.headers.length)
    .setFontWeight("bold")
    .setBackground("#f3f4f6");
  sheet.setFrozenRows(1);
  for (var i = 1; i <= data.headers.length; i++) {
    sheet.autoResizeColumn(i);
  }
  return ContentService
    .createTextOutput(JSON.stringify({status:"ok",rows:data.rows.length}))
    .setMimeType(ContentService.MimeType.JSON);
}`;

export function genId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export function emptyForm(): Omit<JobApp, 'id'> {
  return {
    company: '',
    role: '',
    url: '',
    location: '',
    status: 'Applied',
    notes: '',
    date: new Date().toISOString().split('T')[0],
  };
}

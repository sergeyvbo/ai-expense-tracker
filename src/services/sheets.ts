import { google } from 'googleapis';
import { config } from '../config';

export const auth = new google.auth.GoogleAuth({
  keyFile: config.googleServiceAccountPath,
  scopes: [
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/drive.readonly'
  ],
});

const sheets = google.sheets({ version: 'v4', auth });

export interface ExpenseItem {
  name: string;
  quantity: number;
  price: number;
}

export interface ExpenseRecord {
  date: string;
  merchant: string;
  items: ExpenseItem[];
  category: string;
  tax: number;
  total: number;
}

async function getSheetName(): Promise<string> {
  const meta = await sheets.spreadsheets.get({
    spreadsheetId: config.googleSheetId,
  });
  return meta.data.sheets?.[0]?.properties?.title || 'Sheet1';
}

export async function appendExpense(record: ExpenseRecord) {
  const sheetName = await getSheetName();
  const itemsString = JSON.stringify(record.items);

  const values = [
    [
      record.date,
      record.merchant,
      itemsString,
      record.category,
      record.tax,
      record.total,
    ],
  ];

  await sheets.spreadsheets.values.append({
    spreadsheetId: config.googleSheetId,
    range: `${sheetName}!A:F`,
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values,
    },
  });

  const today = new Date().toISOString().slice(0, 10);

  await sheets.spreadsheets.values.update({
    spreadsheetId: config.googleSheetId,
    range: "Dashboard!H35",
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [[today]],
    },
  });
}

export async function getExpenses() {
  const sheetName = await getSheetName();
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: config.googleSheetId,
    range: `${sheetName}!A:F`,
  });
  return response.data.values || [];
}

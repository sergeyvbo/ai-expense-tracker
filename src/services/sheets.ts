import { google } from 'googleapis';
import { config } from '../config';

const auth = new google.auth.GoogleAuth({
  keyFile: config.googleServiceAccountPath,
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
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
  const itemsString = record.items
    .map((i) => `${i.name} (${i.quantity}x${i.price})`)
    .join(', ');

  const values = [
    [
      record.date,
      record.merchant,
      itemsString,
      record.tax,
      record.total,
    ],
  ];

  await sheets.spreadsheets.values.append({
    spreadsheetId: config.googleSheetId,
    range: `${sheetName}!A:E`,
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values,
    },
  });
}

export async function getExpenses() {
  const sheetName = await getSheetName();
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: config.googleSheetId,
    range: `${sheetName}!A:E`,
  });
  return response.data.values || [];
}

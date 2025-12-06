import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

export const config = {
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN!,
  openaiApiKey: process.env.OPENAI_API_KEY!,
  googleSheetId: process.env.GOOGLE_SHEET_ID!,
  googleServiceAccountPath: path.resolve(__dirname, process.env.GOOGLE_SERVICE_ACCOUNT_PATH!),
};

if (!config.telegramBotToken) throw new Error('TELEGRAM_BOT_TOKEN is missing');
if (!config.openaiApiKey) throw new Error('OPENAI_API_KEY is missing');
if (!config.googleSheetId) throw new Error('GOOGLE_SHEET_ID is missing');

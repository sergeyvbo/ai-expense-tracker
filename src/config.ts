import dotenv from "dotenv";
import path from "path";
import { z } from "zod";

dotenv.config();

const EnvSchema = z.object({
  TELEGRAM_BOT_TOKEN: z.string().min(1),
  OPENAI_API_KEY: z.string().min(1),
  GOOGLE_SHEET_ID: z.string().min(1),
  GOOGLE_SERVICE_ACCOUNT_PATH: z.string().min(1),
  DASHBOARD_ENDPOINT: z.string().url(),
  DASHBOARD_MESSAGE_ID: z.string().min(1),
});

const envData = EnvSchema.parse(process.env);

export const config = {
  telegramBotToken: envData.TELEGRAM_BOT_TOKEN,
  openaiApiKey: envData.OPENAI_API_KEY,
  googleSheetId: envData.GOOGLE_SHEET_ID,
  googleServiceAccountPath: path.resolve(
    __dirname,
    envData.GOOGLE_SERVICE_ACCOUNT_PATH,
  ),
  dashboardEndpoint: envData.DASHBOARD_ENDPOINT,
  dashboardMessageId: envData.DASHBOARD_MESSAGE_ID,
};
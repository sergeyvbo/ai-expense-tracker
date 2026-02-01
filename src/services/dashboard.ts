import { config } from "../config";
import { Api } from "grammy";
import { InputFile } from "grammy";
import { google } from "googleapis";

const auth = new google.auth.GoogleAuth({
  keyFile: config.googleServiceAccountPath,
  scopes: [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive.readonly",
  ],
});

const drive = google.drive({ version: "v3", auth });

interface DashboardResponse {
  url: string;
}

function isDashboardResponse(data: unknown): data is DashboardResponse {
  return (
    typeof data === "object" &&
    data !== null &&
    "url" in data &&
    typeof (data as any).url === "string"
  );
}

async function getDashboardUrl(): Promise<string> {
  const res = await fetch(config.dashboardEndpoint);
  const data: unknown = await res.json();

  if (!isDashboardResponse(data)) {
    throw new Error("Invalid dashboard URL response");
  }

  return data.url;
}

function extractFileId(url: string): string {
  const match = url.match(/[?&]id=([^&]+)/);
  if (!match) {
    throw new Error("Could not extract file ID from URL");
  }
  return match[1];
}

async function getDashboardPdf(): Promise<Uint8Array> {
  const dashboardUrl = await getDashboardUrl();
  const fileId = extractFileId(dashboardUrl);

  try {
    const res = await drive.files.get(
      { fileId, alt: "media" },
      { responseType: "arraybuffer" },
    );
    return new Uint8Array(res.data as ArrayBuffer);
  } catch (error: any) {
    if (error.code === 403) {
      console.error("403 Forbidden error from Drive API. Please ensure:");
      console.error("1. Google Drive API is ENABLED in Cloud Console.");
      console.error("2. File is shared with service account email.");
      throw new Error(
        "Drive API Forbidden (403). Make sure Drive API is enabled and file is shared with service account."
      );
    }
    throw error;
  }
}

export async function updatePinnedDashboard(
  api: Api,
  chatId: number,
  messageId?: number | undefined,
): Promise<{ messageId: number; isNew: boolean }> {
  const pdfBytes = await getDashboardPdf();
  const pdfFile = new InputFile(pdfBytes, "dashboard.pdf");
  
  // Use provided messageId, or fall back to config, or create new
  const targetMessageId = messageId || config.dashboardMessageId;

  if (targetMessageId) {
    // Update existing pinned message
    const today = new Date().toISOString().slice(0, 10);
    try {
      await api.editMessageMedia(chatId, targetMessageId, {
        type: "document",
        media: pdfFile,
        caption: `📊 Dashboard (Updated ${today})`,
      });
      return { messageId: targetMessageId, isNew: false };
    } catch (error) {
      console.error("Failed to edit message, creating new one:", error);
      // If edit fails, create new pinned message
      const newMessageId = await createAndPinDashboard(api, chatId);
      return { messageId: newMessageId, isNew: true };
    }
  } else {
    // Create new pinned message
    const newMessageId = await createAndPinDashboard(api, chatId);
    return { messageId: newMessageId, isNew: true };
  }
}

async function createAndPinDashboard(
  api: Api,
  chatId: number,
): Promise<number> {
  const pdfBytes = await getDashboardPdf();
  const pdfFile = new InputFile(pdfBytes, "dashboard.pdf");

  const message = await api.sendDocument(chatId, pdfFile, {
    caption: "📊 Dashboard",
  });

  await api.pinChatMessage(chatId, message.message_id, {
    disable_notification: true,
  });

  return message.message_id;
}

import { config } from "../config";
import { Api, InputFile } from "grammy";
import { google } from "googleapis";
import { auth } from "./sheets";
import axios from "axios";

const drive = google.drive({ version: "v3", auth });

interface DashboardResponse {
  url: string;
  status: string;
  error?: string;
}

function isDashboardResponse(data: unknown): data is DashboardResponse {
  return (
    typeof data === "object" &&
    data !== null &&
    "url" in data &&
    typeof (data as any).url === "string"
  );
}

async function getDashboardPngUrl(): Promise<string> {
  console.log("🚀 Getting dashboard PNG URL from Apps Script...");
  try {
    const response = await axios.get<DashboardResponse>(config.dashboardEndpoint, {
      timeout: 60000,
    });
    const data = response.data;

    if (!isDashboardResponse(data)) {
      throw new Error(`Invalid dashboard response: ${JSON.stringify(data)}`);
    }

    if (data.status === "error") {
      throw new Error(`Apps Script Error: ${data.error}`);
    }

    console.log(`✅ Received PNG URL: ${data.url}`);
    return data.url;
  } catch (err: any) {
    console.error(`❌ Apps Script Fetch Error: ${err.message}`);
    throw err;
  }
}

async function getDashboardPngByFileId(fileId: string): Promise<Uint8Array> {
  console.log(`� Checking file access for ID: ${fileId}...`);
  try {
    // First, try to get metadata to verify visibility
    const metadata = await drive.files.get({ fileId, fields: "name, mimeType" });
    console.log(`👀 Service Account sees: "${metadata.data.name}" (${metadata.data.mimeType})`);

    console.log(`📥 Downloading content...`);
    const res = await drive.files.get(
      { fileId, alt: "media" },
      { responseType: "arraybuffer" }
    );
    
    const buffer = Buffer.from(res.data as ArrayBuffer);
    console.log(`📦 Downloaded ${buffer.byteLength} bytes via Service Account.`);
    return buffer;
  } catch (err: any) {
    console.error("❌ Drive Service Account Error:", err.message);
    if (err.message.includes("404")) {
      console.error("--- PERMISSION CHECK ---");
      console.error(`1. GO TO DRIVE: Ensure YOUR FOLDER is shared with:`);
      console.error(`   bot-39@ai-expense-tracker-480405.iam.gserviceaccount.com`);
      console.error(`2. CHECK ROLE: Should be at least 'Viewer'.`);
      console.error("-------------------------");
      throw new Error(`File not visible to bot. Ensure folder is shared with the service account.`);
    }
    throw err;
  }
}

async function getDashboardPngBytes(): Promise<Uint8Array> {
  console.log("⏳ Waiting for Sheets to sync (10s)...");
  await new Promise((resolve) => setTimeout(resolve, 10000));
  
  const pngUrl = await getDashboardPngUrl();

  // Extract file ID from URL: https://drive.google.com/uc?id=FILE_ID&export=download
  try {
    const urlObj = new URL(pngUrl);
    const fileId = urlObj.searchParams.get("id");

    if (!fileId) {
      throw new Error(`Could not extract file ID from URL: ${pngUrl}`);
    }

    return await getDashboardPngByFileId(fileId);
  } catch (err: any) {
    console.error("❌ Link Parsing Error:", err.message);
    throw err;
  }
}

export async function updatePinnedDashboard(
  api: Api,
  chatId: number,
  messageId?: number | undefined,
): Promise<{ messageId: number; isNew: boolean; pngBytes: Uint8Array }> {
  const pngBytes = await getDashboardPngBytes();
  const pngFile = new InputFile(pngBytes, "dashboard.png");
  
  const targetMessageId = messageId || config.dashboardMessageId;

  if (targetMessageId) {
    const today = new Date().toISOString().slice(0, 10);
    try {
      // Try updating as photo first
      await api.editMessageMedia(chatId, targetMessageId, {
        type: "photo",
        media: pngFile,
        caption: `📊 Dashboard (Updated ${today})`,
      });
      return { messageId: targetMessageId, isNew: false, pngBytes };
    } catch (error: any) {
      console.error("Failed to edit message as photo:", error.message);
      
      // Fallback: If it's a processing error, try editing as document
      if (error.message?.includes("IMAGE_PROCESS_FAILED") || error.message?.includes("wrong media type")) {
        try {
          await api.editMessageMedia(chatId, targetMessageId, {
            type: "document",
            media: pngFile,
            caption: `📊 Dashboard (Updated ${today})`,
          });
          return { messageId: targetMessageId, isNew: false, pngBytes };
        } catch (innerError) {
          console.error("Fallback edit failed, creating new one:", innerError);
        }
      }
      
      const result = await createAndPinDashboard(api, chatId, pngBytes);
      return { ...result, isNew: true };
    }
  } else {
    const result = await createAndPinDashboard(api, chatId, pngBytes);
    return { ...result, isNew: true };
  }
}

async function createAndPinDashboard(
  api: Api,
  chatId: number,
  providedBytes?: Uint8Array,
): Promise<{ messageId: number; pngBytes: Uint8Array }> {
  const pngBytes = providedBytes || await getDashboardPngBytes();
  const pngFile = new InputFile(pngBytes, "dashboard.png");

  let message;
  try {
    // Try sending as photo
    message = await api.sendPhoto(chatId, pngFile, {
      caption: "📊 Dashboard",
    });
  } catch (error: any) {
    console.error("Failed to send photo, falling back to document:", error.message);
    // Fallback: Send as document if photo processing fails
    message = await api.sendDocument(chatId, pngFile, {
      caption: "📊 Dashboard (PNG Download)",
    });
  }

  await api.pinChatMessage(chatId, message.message_id, {
    disable_notification: true,
  });

  return { messageId: message.message_id, pngBytes };
}

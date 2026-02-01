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
  console.log("🚀 Fetching dashboard URL...");
  const response = await axios.get<DashboardResponse>(config.dashboardEndpoint, {
    timeout: 60000,
  });
  const data = response.data;

  if (!isDashboardResponse(data) || data.status === "error") {
    throw new Error(`Apps Script Error: ${data.error || "Invalid response"}`);
  }

  return data.url;
}

async function getDashboardPngByFileId(fileId: string): Promise<Uint8Array> {
  try {
    const res = await drive.files.get(
      { fileId, alt: "media" },
      { responseType: "arraybuffer" }
    );
    return Buffer.from(res.data as ArrayBuffer);
  } catch (err: any) {
    throw new Error(`Drive Download Error: ${err.message}`);
  }
}

async function getDashboardPngBytes(): Promise<Uint8Array> {
  console.log("⏳ Syncing with Sheets...");
  await new Promise((resolve) => setTimeout(resolve, 10000));
  
  const pngUrl = await getDashboardPngUrl();
  const fileId = new URL(pngUrl).searchParams.get("id");

  if (!fileId) throw new Error("Could not extract file ID from Drive URL");

  return await getDashboardPngByFileId(fileId);
}

function getUpdateCaption() {
  const now = new Date();
  const date = now.toISOString().slice(0, 10);
  const time = now.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  return `📊 Dashboard (Updated ${date} ${time})`;
}

export async function updatePinnedDashboard(
  api: Api,
  chatId: number,
  messageId?: number | undefined,
): Promise<{ messageId: number; isNew: boolean; pngBytes: Uint8Array }> {
  const pngBytes = await getDashboardPngBytes();
  const pngFile = new InputFile(pngBytes, "dashboard.png");
  const targetMessageId = messageId || config.dashboardMessageId;
  const caption = getUpdateCaption();

  if (targetMessageId) {
    try {
      await api.editMessageMedia(chatId, targetMessageId, {
        type: "photo",
        media: pngFile,
        caption,
      });
      return { messageId: targetMessageId, isNew: false, pngBytes };
    } catch (error: any) {
      if (error.message?.includes("IMAGE_PROCESS_FAILED")) {
        try {
          await api.editMessageMedia(chatId, targetMessageId, {
            type: "document",
            media: pngFile,
            caption,
          });
          return { messageId: targetMessageId, isNew: false, pngBytes };
        } catch (e) {}
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
  const caption = "📊 Dashboard";

  let message;
  try {
    message = await api.sendPhoto(chatId, pngFile, { caption });
  } catch (error: any) {
    message = await api.sendDocument(chatId, pngFile, { caption });
  }

  await api.pinChatMessage(chatId, message.message_id, { disable_notification: true });
  return { messageId: message.message_id, pngBytes };
}

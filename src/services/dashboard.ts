import { config } from "../config";
import { Api } from "grammy";
import { InputFile } from "grammy";

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

export async function updatePinnedDashboard(
  api: Api,
  chatId: number,
  messageId?: number | undefined,
): Promise<number> {
  const dashboardUrl = await getDashboardUrl();
  const pdfFile = new InputFile(new URL(dashboardUrl));

  if (messageId) {
    // Update existing pinned message
    const today = new Date().toISOString().slice(0, 10);
    try {
      await api.editMessageMedia(chatId, messageId, {
        type: "document",
        media: pdfFile,
        caption: `📊 Dashboard (Updated ${today})`,
      });
      return messageId;
    } catch (error) {
      console.error("Failed to edit message, creating new one:", error);
      // If edit fails, create new pinned message
      return await createAndPinDashboard(api, chatId);
    }
  } else {
    // Create new pinned message
    return await createAndPinDashboard(api, chatId);
  }
}

async function createAndPinDashboard(
  api: Api,
  chatId: number,
): Promise<number> {
  const dashboardUrl = await getDashboardUrl();
  const pdfFile = new InputFile(new URL(dashboardUrl));

  const message = await api.sendDocument(chatId, pdfFile, {
    caption: "📊 Dashboard",
  });

  await api.pinChatMessage(chatId, message.message_id, {
    disable_notification: true,
  });

  return message.message_id;
}
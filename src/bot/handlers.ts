import { Context, SessionFlavor, InputFile } from 'grammy';
import { SessionData } from './session';
import { parseReceipt, correctExpenseData, answerQuery, parseExpenseText } from '../services/llm';
import { appendExpense, getExpenses } from '../services/sheets';
import { formatExpense } from '../services/formatter';
import { confirmKeyboard } from './keyboard';
import { updatePinnedDashboard } from '../services/dashboard';

export type MyContext = Context & SessionFlavor<SessionData>;

export async function handleStart(ctx: MyContext) {
  await ctx.reply('👋 Welcome! Send me a receipt photo, or expense description, or your query.');
}

export async function handlePhoto(ctx: MyContext) {
  const photo = ctx.message?.photo?.pop();
  if (!photo) return;

  const file = await ctx.api.getFile(photo.file_id);
  const fileUrl = `https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${file.file_path}`;

  await ctx.reply("⏳ Processing receipt...");
  
  try {
    const data = await parseReceipt(fileUrl);
    ctx.session.currentExpense = data;
    ctx.session.waitingForCorrection = true;

    await ctx.reply(formatExpense(ctx.session.currentExpense), {
      parse_mode: "MarkdownV2",
      reply_markup: confirmKeyboard,
    });

  } catch (error) {
    console.error(error);
    await ctx.reply('☠️ Failed to parse receipt.');
  }
}

export async function handleText(ctx: MyContext) {
  const text = ctx.message?.text;
  if (!text) return;

  if (ctx.session.waitingForCorrection && ctx.session.currentExpense) {
    const newData = await correctExpenseData(ctx.session.currentExpense, text);
    ctx.session.currentExpense = newData;
    await ctx.reply(formatExpense(ctx.session.currentExpense), {
      parse_mode: "MarkdownV2",
      reply_markup: confirmKeyboard,
    });
    return;
  }

  // Check if it's an expense entry or Q&A
  const result = await parseExpenseText(text);
  if (result.type === 'expense') {

    ctx.session.currentExpense = result.data;
    ctx.session.waitingForCorrection = true;
    await ctx.reply(formatExpense(ctx.session.currentExpense),
    {
      parse_mode: 'MarkdownV2',
      reply_markup: confirmKeyboard
    });
  } else {
    // Q&A
    const expenses = await getExpenses();
    const answer = await answerQuery(text, expenses);
    await ctx.reply(answer);
  }
}

export async function handleSave(ctx: MyContext) {
  try {
    await ctx.answerCallbackQuery();
  } catch (e) {
    console.error("Failed to answer callback query:", e);
  }

  if (!ctx.session.currentExpense) return;
  
  await appendExpense(ctx.session.currentExpense);
  ctx.session.currentExpense = undefined;
  ctx.session.waitingForCorrection = false;

  await ctx.editMessageReplyMarkup();
  
  await ctx.reply("💾 Expense saved!");

  try {
    // Update or create pinned dashboard
    const result = await updatePinnedDashboard(
      ctx.api,
      ctx.chat!.id,
      ctx.session.pinnedMessageId,
    );

    // Store the message ID for future updates in this session
    ctx.session.pinnedMessageId = result.messageId;

    const pngFile = new InputFile(result.pngBytes, "dashboard.png");
    // try {
    //   await ctx.replyWithPhoto(pngFile, {
    //     caption: "💾 Expense saved!"
    //   });
    // } catch (photoError: any) {
    //   console.error("Failed to send confirmation photo, falling back to document:", photoError.message);
    //   await ctx.replyWithDocument(pngFile, {
    //     caption: "💾 Expense saved! (Dashboard attached below)"
    //   });
    // }
    

    if (result.isNew) {
      await ctx.reply(
        `🆕 New dashboard message created and pinned!\n\n` +
        `To keep it persistent, please add this to your \`.env\` file and restart the bot:\n` +
        `\`DASHBOARD_MESSAGE_ID=${result.messageId}\``
      );
    }

  } catch (error) {
    console.error("Dashboard update failed:", error);
    await ctx.reply("💾 Expense saved, but dashboard update failed. ⚠️");
  }

}

export async function handleEdit(ctx: MyContext) {
  ctx.session.waitingForCorrection = true;

  await ctx.reply('✏️ Send corrections (e.g. "date is 2026-01-31")');
  await ctx.answerCallbackQuery();
}
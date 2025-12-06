import { Context, SessionFlavor } from 'grammy';
import { SessionData } from './session';
import { parseReceipt, correctExpenseData, answerQuery, parseExpenseText } from '../services/llm';
import { appendExpense, getExpenses } from '../services/sheets';

export type MyContext = Context & SessionFlavor<SessionData>;

export async function handleStart(ctx: MyContext) {
  await ctx.reply('Welcome! Send me a receipt photo to track your expense, or ask me questions about your spending.');
}

export async function handlePhoto(ctx: MyContext) {
  const photo = ctx.message?.photo?.pop(); // Get highest resolution
  if (!photo) return;

  const file = await ctx.api.getFile(photo.file_id);
  const fileUrl = `https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${file.file_path}`;

  await ctx.reply('Processing receipt...');
  
  try {
    const data = await parseReceipt(fileUrl);
    ctx.session.currentExpense = data;
    ctx.session.waitingForCorrection = true;

    await ctx.reply(
      `Parsed Data:\nMerchant: ${data.merchant}\nDate: ${data.date}\nTotal: ${data.total}\nItems: ${data.items.length}\n\nIs this correct? Reply with corrections or "yes" to save.`
    );
  } catch (error) {
    console.error(error);
    await ctx.reply('Failed to parse receipt.');
  }
}

export async function handleText(ctx: MyContext) {
  const text = ctx.message?.text;
  if (!text) return;

  if (ctx.session.waitingForCorrection && ctx.session.currentExpense) {
    if (text.toLowerCase() === 'yes') {
      await appendExpense(ctx.session.currentExpense);
      ctx.session.waitingForCorrection = false;
      ctx.session.currentExpense = undefined;
      await ctx.reply('Expense saved!');
    } else {
      // Correction
      const newData = await correctExpenseData(ctx.session.currentExpense, text);
      ctx.session.currentExpense = newData;
      await ctx.reply(
        `Updated Data:\nMerchant: ${newData.merchant}\nDate: ${newData.date}\nTotal: ${newData.total}\n\nIs this correct?`
      );
    }
  } else {
    // Check if it's an expense entry or Q&A
    const result = await parseExpenseText(text);
    if (result.type === 'expense') {
      ctx.session.currentExpense = result.data;
      ctx.session.waitingForCorrection = true;
      await ctx.reply(
        `Parsed Expense:\nMerchant: ${result.data.merchant}\nDate: ${result.data.date}\nTotal: ${result.data.total}\n\nIs this correct? Reply with corrections or "yes" to save.`
      );
    } else {
      // Q&A
      const expenses = await getExpenses();
      const answer = await answerQuery(text, expenses);
      await ctx.reply(answer);
    }
  }
}

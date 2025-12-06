import { Bot, session } from 'grammy';
import { config } from './config';
import { initialSession } from './bot/session';
import { handleStart, handlePhoto, handleText, MyContext } from './bot/handlers';

const bot = new Bot<MyContext>(config.telegramBotToken);

bot.use(session({ initial: initialSession }));

bot.command('start', handleStart);
bot.on('message:photo', handlePhoto);
bot.on('message:text', handleText);

bot.catch((err) => {
  const ctx = err.ctx;
  console.error(`Error while handling update ${ctx.update.update_id}:`);
  const e = err.error;
  if (e instanceof Error) {
    console.error(e.message);
    console.error(e.stack);
  } else {
    console.error(e);
  }
});

bot.start();
console.log('Bot started...');

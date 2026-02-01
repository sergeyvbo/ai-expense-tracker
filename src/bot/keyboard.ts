import { InlineKeyboard } from 'grammy';

const confirmKeyboard = new InlineKeyboard()
  .text("✅ OK", "expense_ok")
  .text("✏️ Edit", "expense_edit");

  export { confirmKeyboard };
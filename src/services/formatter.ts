import { ParsedExpense } from "./llm";

const WIDTH = 36;
const ITEM_WIDTH = WIDTH - 18;

export function formatExpense(expense: ParsedExpense) {
  const lines: string[] = [];

  const merchant = `* ${escape(expense.merchant)} *`;

  lines.push("=".repeat(WIDTH));
  lines.push(merchant);
  lines.push(`${expense.date} ${expense.category.padStart(WIDTH - 10)}`);
  lines.push("=".repeat(WIDTH));

  if (expense.items && Array.isArray(expense.items)) {
    for (const [i, item] of expense.items.entries()) {
      const index = (i + 1).toString().padStart(2);
      const name = escape(item.name).slice(0, ITEM_WIDTH).padEnd(ITEM_WIDTH);
      const qty = item.quantity.toString().padStart(2);
      const price = item.price.toFixed(2).padStart(7);
      lines.push(`${index}. ${name} ${qty} x ${price}`);
    }
  }

  lines.push("=".repeat(WIDTH));

  if (expense.tax) {
    lines.push(`Tax:${expense.tax.toFixed(2).padStart(WIDTH - 4)}`);
  }
  lines.push(`Total:${expense.total.toFixed(2).padStart(WIDTH - 6)}`);
  lines.push("=".repeat(WIDTH));
  lines.push("");
  

  return "```text\n" + lines.join("\n") + "\n```";
}

function escape(text: string) {
  return text.replace(/[_*[\]()~`>#+\-=|{}.!]/g, "\\$&");
}
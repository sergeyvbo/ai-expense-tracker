import { openai } from '@ai-sdk/openai';
import { generateObject, generateText } from 'ai';
import { z } from 'zod';

export const CategoryEnum = z.enum([
  "Household",
  "Internet",
  "Tech",
  "Car",
  "Gas",
  "Groceries",
  "Food & Dining",
  "Clothing & Gifts",
  "Insurance",
  "Drugstore",
  "Health",
]);

export const ExpenseSchema = z.object({
  merchant: z.string().describe("Name of the merchant"),
  date: z.string().describe("Date of purchase in YYYY-MM-DD format"),
  items: z.array(
    z.object({
      name: z.string(),
      quantity: z.number().default(1),
      price: z.number(),
    }),
  ),
  category: CategoryEnum.describe(
    "Overall category of the receipt. Must be one of the predefined categories.",
  ),
  tax: z.number().optional().default(0),
  total: z.number(),
});

export type ParsedExpense = z.infer<typeof ExpenseSchema>;

export async function parseReceipt(imageUrl: string): Promise<ParsedExpense> {
  const { object } = await generateObject({
    model: openai("gpt-4o"),
    temperature: 0,
    schema: ExpenseSchema,
    messages: [
      {
        role: "system",
        content: `
          You are a receipt parsing system.

          Extract structured expense data from receipts.
          The category MUST be exactly one of the predefined enum values.

          Category selection rules:
          - Choose exactly ONE category
          - Do not invent new categories
          - Prefer the most specific category
          - Gas is only for fuel stations
          - Drugstore is for CVS/Walgreens-type stores
          - Groceries is for food shopping
          - Food & Dining is for restaurants and cafes
          `,
      },
      {
        role: "user",
        content: [
          { type: "text", text: "Parse this receipt." },
          { type: "image", image: imageUrl },
        ],
      },
    ],
  });
  return object;
}

export async function correctExpenseData(currentData: ParsedExpense, instruction: string): Promise<ParsedExpense> {
  const { object } = await generateObject({
    model: openai("gpt-4o"),
    schema: ExpenseSchema,
    messages: [
      {
        role: "system",
        content: `
          You are correcting structured expense data.

          Rules:
          - Preserve the existing structure
          - Category must remain one of the predefined enum values
          - Only apply changes explicitly requested by the user

          Current data:
          ${JSON.stringify(currentData, null, 2)}
          `,
      },
      {
        role: "user",
        content: instruction,
      },
    ],
  });
  return object;
}

export async function parseExpenseText(text: string): Promise<{ type: 'expense'; data: ParsedExpense } | { type: 'query' }> {
  const schema = z.object({
    type: z.enum(['expense', 'query']).describe('Determine if the user wants to add an expense or ask a question.'),
    data: ExpenseSchema.nullable().describe('If type is expense, extract the expense details here. If type is query, this should be null.'),
  });

  const { object } = await generateObject({
    model: openai('gpt-4o'),
    schema: schema,
    messages: [
      {
        role: 'system',
        content: `You are an expense tracker assistant. 
        Current Date: ${new Date().toISOString().split('T')[0]}.
        If the user wants to add an expense (e.g., "Add Walmart $50", "Spent 20 on food"), extract the details.
        If the user asks a question (e.g., "How much did I spend?", "List expenses"), classify as query.`,
      },
      {
        role: 'user',
        content: text,
      },
    ],
  });

  if (object.type === 'expense' && object.data) {
    return { type: 'expense', data: object.data };
  }
  return { type: 'query' };
}

export async function answerQuery(query: string, contextData: any[]) {
    const { text } = await generateText({
        model: openai('gpt-4o'),
        messages: [
            {
                role: 'system',
                content: `You are an assistant that answers questions about expenses based on the provided data. Data: ${JSON.stringify(contextData)}`
            },
            {
                role: 'user',
                content: query
            }
        ]
    });
    return text;
}

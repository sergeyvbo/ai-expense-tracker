import { openai } from '@ai-sdk/openai';
import { generateObject, generateText } from 'ai';
import { z } from 'zod';

export const ExpenseSchema = z.object({
  merchant: z.string().describe('Name of the merchant'),
  date: z.string().describe('Date of purchase in YYYY-MM-DD format'),
  items: z.array(
    z.object({
      name: z.string(),
      quantity: z.number(),
      price: z.number(),
    })
  ),
  category: z.string().describe('Inferred category of the whole receipt (e.g., Groceries, Tech, Clothing, Household, etc.)'),
  tax: z.number().optional().default(0),
  total: z.number(),
});

export type ParsedExpense = z.infer<typeof ExpenseSchema>;

export async function parseReceipt(imageUrl: string): Promise<ParsedExpense> {
  const { object } = await generateObject({
    model: openai('gpt-4o'),
    schema: ExpenseSchema,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Parse this receipt. Extract merchant, date, items, tax, total, and the overall category.' },
          { type: 'image', image: imageUrl },
        ],
      },
    ],
  });
  return object;
}

export async function correctExpenseData(currentData: ParsedExpense, instruction: string): Promise<ParsedExpense> {
  const { object } = await generateObject({
    model: openai('gpt-4o'),
    schema: ExpenseSchema,
    messages: [
      {
        role: 'system',
        content: `You are a helpful assistant correcting expense data. Current data: ${JSON.stringify(currentData)}`,
      },
      {
        role: 'user',
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

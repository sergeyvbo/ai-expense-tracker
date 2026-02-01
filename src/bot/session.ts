import { ParsedExpense } from '../services/llm';

export interface SessionData {
  waitingForCorrection: boolean;
  currentExpense?: ParsedExpense;
  pinnedMessageId?: number;
}

export function initialSession(): SessionData {
  return {
    waitingForCorrection: false,
  };
}

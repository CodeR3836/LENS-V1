import type { AICompletionRequest } from "../services/ai/types";

export type SkillId =
  | "translate"
  | "rewrite"
  | "summarize"
  | "ask";

export type RewriteMode =
  | "Fix Grammar"
  | "Professional Touch"
  | "Academic"
  | "Short"
  | "Casual";

export type AskAIMode =
  | "make-question"
  | "ask-text";

export interface LanguageInfo {
  code: string;
  label: string;
}

export interface TranslateSkillPayload {
  text: string;
  fromLang: LanguageInfo;
  toLang: LanguageInfo;
}

export interface RewriteSkillPayload {
  text: string;
  mode: RewriteMode;
}

export interface SummarizeSkillPayload {
  text: string;
}

export interface AskAISkillPayload {
  /**
   * The article, pasted text, or cropped/selected text
   * that LENS should work with.
   */
  text: string;

  /**
   * Ask AI has two modes:
   *
   * make-question:
   * LENS generates important questions from the text
   * and answers them.
   *
   * ask-text:
   * The user asks a question based on the provided text.
   */
  mode: AskAIMode;

  /**
   * Only required when mode === "ask-text".
   */
  question?: string;
}

export type SkillPayload =
  | TranslateSkillPayload
  | RewriteSkillPayload
  | SummarizeSkillPayload
  | AskAISkillPayload;

export interface SkillExecutionResult {
  success: boolean;
  resultText: string;
  providerName: string;
  modelUsed?: string;
  error?: string;
}

export interface LensSkill<T extends SkillPayload = SkillPayload> {
  id: SkillId;
  name: string;
  description: string;
  validate(payload: T): string | null;
  buildPrompt(payload: T): AICompletionRequest;
}
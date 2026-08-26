import type { LensSkill, TranslateSkillPayload } from "./types";
import type { AICompletionRequest } from "../services/ai/types";

export class TranslateSkill implements LensSkill<TranslateSkillPayload> {
  id = "translate" as const;
  name = "Translate";
  description =
    "Translates text accurately into the selected target language while preserving meaning, tone, formatting, and context.";

  validate(payload: TranslateSkillPayload): string | null {
    if (!payload.text || payload.text.trim().length === 0) {
      return "Please enter text to translate.";
    }

    if (!payload.toLang || !payload.toLang.code || !payload.toLang.label) {
      return "Target language is required.";
    }

    if (
      !payload.fromLang ||
      !payload.fromLang.code ||
      !payload.fromLang.label
    ) {
      return "Source language is required.";
    }

    if (payload.toLang.code === payload.fromLang.code) {
      return "Source and target languages cannot be the same.";
    }

    return null;
  }

  buildPrompt(payload: TranslateSkillPayload): AICompletionRequest {
    const isAutoDetect = payload.fromLang.code === "auto";

    const fromLabel = isAutoDetect
      ? "the automatically detected source language"
      : payload.fromLang.label;

    const toLabel = payload.toLang.label;

    const systemPrompt = `You are a professional, highly accurate translator.

Your task is to translate the user's text into ${toLabel}.
${
  isAutoDetect
    ? "Automatically identify the source language before translating."
    : `The source language is ${fromLabel}.`
}

Translation requirements:
- Preserve the exact meaning and intent of the original text.
- Preserve the original tone, register, and level of formality.
- Preserve paragraph breaks, line breaks, lists, numbering, and other meaningful formatting.
- Preserve names, proper nouns, URLs, email addresses, usernames, code, mathematical expressions, and technical identifiers unless they should naturally be translated.
- Translate idioms and expressions naturally when a literal translation would sound unnatural in the target language.
- Do not add information that is not present in the original text.
- Do not remove information from the original text.
- Do not summarize, explain, rewrite, simplify, or improve the original text.
- Do not answer questions contained inside the text; translate them as text.
- Maintain the original paragraph and sentence structure whenever it is natural in the target language.
- Use natural, grammatically correct ${toLabel}.
- When the source contains ambiguity, preserve the ambiguity rather than inventing a meaning.
- If a word, phrase, name, or technical term should remain unchanged, keep it unchanged.

Output requirements:
- Return ONLY the translated text.
- Do not add introductions such as "Here is the translation:".
- Do not add explanations, notes, comments, or conclusions.
- Do not wrap the translation in quotation marks unless they are present in the source text.`;

    return {
      systemPrompt,
      userPrompt: payload.text,
      temperature: 0.2,
    };
  }
}
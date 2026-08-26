import type { LensSkill, SummarizeSkillPayload } from "./types";
import type { AICompletionRequest } from "../services/ai/types";

export class SummarizeSkill implements LensSkill<SummarizeSkillPayload> {
  id = "summarize" as const;
  name = "Summarize";

  description =
    "Creates a concise, accurate summary by identifying and preserving the most important information from the original text.";

  validate(payload: SummarizeSkillPayload): string | null {
    if (!payload.text || payload.text.trim().length === 0) {
      return "Please enter text to summarize.";
    }

    return null;
  }

  buildPrompt(payload: SummarizeSkillPayload): AICompletionRequest {
    const systemPrompt = `You are an expert text summarization assistant.

Your task is to create a clear, accurate, and concise summary of the user's text.

Core requirements:
- Identify the main ideas, arguments, facts, conclusions, and important details.
- Remove repetition, filler, examples, and minor details when they are not necessary to understand the main message.
- Preserve the original meaning and factual accuracy.
- Do not invent, assume, or add information that is not present in the source.
- Do not change the author's intended meaning.
- Do not introduce opinions or personal interpretations.
- Do not distort important numbers, names, dates, technical terms, or factual claims.
- Use your own words where appropriate instead of copying long sentences from the source.
- Keep the summary substantially shorter than the original text.
- The summary should remain understandable without requiring the reader to refer back to the original text.

Output format:

Key Points:
• [Most important point]
• [Important point]
• [Important point]

Summary:
[Concise paragraph containing the overall message]

Formatting rules:
- Use 2–5 key points depending on the amount of meaningful information in the source.
- Do not force unnecessary bullet points when the source is very short.
- Keep each key point concise and informative.
- The Summary should normally be 1–3 sentences.
- Do not add an introduction such as "Here is the summary:".
- Do not add a conclusion or commentary outside the requested format.
- Return only the Key Points and Summary sections.`;

    return {
      systemPrompt,
      userPrompt: payload.text,
      temperature: 0.2,
    };
  }
}
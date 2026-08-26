import type { LensSkill, RewriteSkillPayload, RewriteMode } from "./types";
import type { AICompletionRequest } from "../services/ai/types";

const REWRITE_INSTRUCTIONS: Record<RewriteMode, string> = {
  "Fix Grammar": `
Correct the text's grammar while making the minimum changes necessary.

Correct:
- Grammar and sentence structure
- Spelling and punctuation
- Subject-verb agreement
- Verb tense and verb forms
- Articles
- Prepositions
- Singular and plural agreement
- Pronoun usage
- Auxiliary and modal verb usage
- Infinitive and gerund patterns
- Common verb-pattern errors
- Clearly incorrect or unnatural grammatical constructions

Preserve:
- The original meaning
- The original information
- The original tone
- The author's writing style
- The original sentence structure whenever possible

Do NOT:
- Rewrite unnecessarily
- Make the text more professional or academic
- Shorten the text
- Add information
- Remove information
- Change the author's tone
- Replace correct wording merely because another wording sounds better

The goal is to correct the English, not to rewrite the author's voice.
`,

  "Professional Touch": `
Rewrite the text in a polished, professional, and confident style.

Improve:
- Clarity
- Sentence flow
- Word choice
- Professional vocabulary
- Structure and readability
- Overall polish

Preserve:
- The original meaning
- All important information
- The author's intended message

Use a professional tone suitable for workplace communication, formal messages, proposals, documentation, or professional correspondence.

Do not make the writing unnecessarily complicated or excessively formal.
`,

  Academic: `
Rewrite the text in a formal academic style.

Improve:
- Precision
- Logical structure
- Clarity
- Formal vocabulary
- Academic sentence structure
- Objective and analytical tone

Use appropriate scholarly language while keeping the text readable.

Preserve:
- The original meaning
- Important facts and information
- The author's intended argument

Do not invent evidence, citations, facts, or conclusions.
Do not make the writing unnecessarily complex just to sound academic.
`,

  Short: `
Rewrite the text to make it significantly shorter and more concise.

Requirements:
- Preserve the core meaning
- Preserve all essential information
- Remove repetition
- Remove unnecessary words and filler
- Combine redundant ideas when appropriate
- Use clear and direct sentences

Do not remove information that is necessary to understand the original message.

The result should be substantially shorter than the original while remaining natural and complete.
`,

  Casual: `
Rewrite the text in a natural, friendly, and conversational tone.

Make the writing:
- Relaxed
- Natural
- Approachable
- Easy to read
- Conversational

Use everyday language where appropriate.

Preserve:
- The original meaning
- Important information
- The author's intended message

Do not overuse slang, emojis, internet abbreviations, or overly informal expressions unless the original context clearly calls for them.
Do not make the text sound childish or unprofessional.
`,
};

export class RewriteSkill implements LensSkill<RewriteSkillPayload> {
  id = "rewrite" as const;
  name = "Rewrite";

  description =
    "Rewrites text according to the selected mode while preserving the original meaning and intent.";

  validate(payload: RewriteSkillPayload): string | null {
    if (!payload.text || payload.text.trim().length === 0) {
      return "Please enter text to rewrite.";
    }

    if (!payload.mode || !REWRITE_INSTRUCTIONS[payload.mode]) {
      return "Valid rewrite mode is required.";
    }

    return null;
  }

  buildPrompt(payload: RewriteSkillPayload): AICompletionRequest {
    const instruction = REWRITE_INSTRUCTIONS[payload.mode];

    const systemPrompt = `You are an expert editor and writing assistant.

The user selected the "${payload.mode}" rewrite mode.

Your task:
${instruction}

Universal rules:
- Output ONLY the final rewritten text.
- Do not add a preamble such as "Here is the rewritten text:".
- Do not add explanations, comments, analysis, or meta notes.
- Do not discuss what you changed.
- Do not invent information.
- Do not change the original meaning unless the selected mode explicitly requires condensation.
- Preserve important names, numbers, dates, technical terms, URLs, and factual information.
`;

    return {
      systemPrompt,
      userPrompt: payload.text,
      temperature: payload.mode === "Fix Grammar" ? 0.2 : 0.5,
    };
  }
}
import type {
  SkillId,
  SkillPayload,
  SkillExecutionResult,
  LensSkill,
} from "./types";

import { TranslateSkill } from "./TranslateSkill";
import { RewriteSkill } from "./RewriteSkill";
import { SummarizeSkill } from "./SummarizeSkill";
import { AskAISkill } from "./AskAISkill";
import { aiService } from "../services/ai/AIService";

class SkillRegistry {
  private readonly skills: Map<SkillId, LensSkill> = new Map();

  constructor() {
    this.registerSkill(new TranslateSkill());
    this.registerSkill(new RewriteSkill());
    this.registerSkill(new SummarizeSkill());
    this.registerSkill(new AskAISkill());
  }

  registerSkill(skill: LensSkill): void {
    this.skills.set(skill.id, skill);
  }

  getSkill(skillId: SkillId): LensSkill | undefined {
    return this.skills.get(skillId);
  }

  async executeSkill(
    skillId: SkillId,
    payload: SkillPayload,
    onChunk?: (chunk: string) => void,
    signal?: AbortSignal
  ): Promise<SkillExecutionResult> {
    const skill = this.getSkill(skillId);
    const providerName = aiService.getActiveProviderName();

    /* ----------------------------------------------------------
       Validate skill
    ---------------------------------------------------------- */

    if (!skill) {
      return {
        success: false,
        resultText: "",
        providerName,
        error: `Skill "${skillId}" is not registered in LENS.`,
      };
    }

    /* ----------------------------------------------------------
       Validate payload
    ---------------------------------------------------------- */

    const validationError = skill.validate(payload);

    if (validationError) {
      return {
        success: false,
        resultText: "",
        providerName,
        error: validationError,
      };
    }

    /* ----------------------------------------------------------
       Stop immediately if already cancelled
    ---------------------------------------------------------- */

    if (signal?.aborted) {
      return {
        success: false,
        resultText: "",
        providerName,
        error: "Request cancelled.",
      };
    }

    /* ----------------------------------------------------------
       Build AI request
    ---------------------------------------------------------- */

    try {
      const request = skill.buildPrompt(payload);

      /* --------------------------------------------------------
         Execute with streaming
      -------------------------------------------------------- */

      const response =
        await aiService.executeCompletionStream(
          request,
          (chunk: string) => {
            if (chunk.length > 0) {
              onChunk?.(chunk);
            }
          },
          signal
        );

      /* --------------------------------------------------------
         Return final response
      -------------------------------------------------------- */

      return {
        success: true,
        resultText: response.text,
        providerName,
        modelUsed: response.model,
      };
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : "An unknown error occurred during skill execution.";

      return {
        success: false,
        resultText: "",
        providerName,
        error: message,
      };
    }
  }
}

export const skillRegistry = new SkillRegistry();
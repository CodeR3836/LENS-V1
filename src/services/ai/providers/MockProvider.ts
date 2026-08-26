import type {
  AIProviderAdapter,
  AICompletionRequest,
  AICompletionResponse,
  ProviderConfig,
  ProviderType,
} from "../types";

function previewText(text: string, length = 64): string {
  const trimmed = text.trim().replace(/\s+/g, " ");
  if (trimmed.length <= length) return trimmed;
  return `${trimmed.slice(0, length).trimEnd()}…`;
}

export class MockProvider implements AIProviderAdapter {
  type: ProviderType = "mock";
  name = "Demo / Mock Provider";

  async complete(
    request: AICompletionRequest,
    _config: ProviderConfig
  ): Promise<AICompletionResponse> {
    // Artificial slight delay for demo simulation
    await new Promise((resolve) => setTimeout(resolve, 800));

    if (request.images && request.images.length > 0) {
      return {
        text: "Sample extracted text from image (Mock Provider).",
        model: "mock-v1",
      };
    }

    const sample = previewText(request.userPrompt);
    const system = request.systemPrompt ?? "";

    if (system.includes("translator")) {
      return {
        text: `Translation (Mock):\n\n"${sample}" — rendered with natural tone and accuracy.`,
        model: "mock-v1",
      };
    }

    if (system.includes("grammar correction")) {
      return {
        text: `Corrected Version:\n\n"${sample}" — punctuation, agreement, and phrasing normalized.`,
        model: "mock-v1",
      };
    }

    if (system.includes("professional")) {
      return {
        text: `Professional Version:\n\n"${sample}" — restated with executive tone, direct structure, and refined vocabulary.`,
        model: "mock-v1",
      };
    }

    if (system.includes("academic")) {
      return {
        text: `Academic Version:\n\n"${sample}" — framed with formal academic vocabulary, precise syntax, and scholarly structure.`,
        model: "mock-v1",
      };
    }

    if (system.includes("concise") || system.includes("Short")) {
      return {
        text: `Short Version:\n\n"${sample}" — condensed to its plain, core assertion.`,
        model: "mock-v1",
      };
    }

    if (system.includes("casual")) {
      return {
        text: `Casual Version:\n\n"${sample}" — rewritten in friendly, conversational, everyday language.`,
        model: "mock-v1",
      };
    }

    if (system.includes("summarize") || system.includes("Key Points")) {
      return {
        text: `Key Points:\n\n• Central idea presented directly.\n• Key context preserved.\n• Clear overall assertion.\n\nSummary: "${sample}"`,
        model: "mock-v1",
      };
    }

    return {
      text: `Based on your request:\n\n"${sample}" — LENS has processed your query directly.`,
      model: "mock-v1",
    };
  }
}

import type {
  AIProviderAdapter,
  AICompletionRequest,
  AICompletionResponse,
  ProviderConfig,
  ProviderType,
} from "../types";

export class CustomOpenAIProvider implements AIProviderAdapter {
  type: ProviderType = "openai_compatible";
  name = "OpenAI-Compatible API";

  async complete(
    request: AICompletionRequest,
    config: ProviderConfig
  ): Promise<AICompletionResponse> {
    const baseUrl = (config.baseUrl || "https://api.openai.com").replace(/\/$/, "");
    const model = config.model || "gpt-4o-mini";

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (config.apiKey && config.apiKey.trim().length > 0) {
      headers["Authorization"] = `Bearer ${config.apiKey.trim()}`;
    }

    const messages: Array<{ role: string; content: unknown }> = [];
    if (request.systemPrompt) {
      messages.push({ role: "system", content: request.systemPrompt });
    }

    if (request.images && request.images.length > 0) {
      const parts: Array<Record<string, unknown>> = [];
      for (const img of request.images) {
        if (img.data?.trim()) {
          parts.push({
            type: "image_url",
            image_url: {
              url: `data:${img.mimeType || "image/png"};base64,${img.data.trim().replace(/^data:image\/[a-zA-Z]+;base64,/, "")}`,
            },
          });
        }
      }
      parts.push({ type: "text", text: request.userPrompt });
      messages.push({ role: "user", content: parts });
    } else {
      messages.push({ role: "user", content: request.userPrompt });
    }

    try {
      const response = await fetch(`${baseUrl}/v1/chat/completions`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          model,
          messages,
          temperature: request.temperature ?? 0.7,
          ...(request.maxTokens ? { max_tokens: request.maxTokens } : {}),
        }),
      });

      if (!response.ok) {
        const errorJson = await response.json().catch(() => ({}));
        const message =
          errorJson?.error?.message ||
          `OpenAI-compatible endpoint failed with status ${response.status}.`;
        throw new Error(`OpenAI API Error (${response.status}): ${message}`);
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;

      return {
        text: content || "",
        model: data.model || model,
        usage: {
          inputTokens: data.usage?.prompt_tokens,
          outputTokens: data.usage?.completion_tokens,
        },
      };
    } catch (err: unknown) {
      if (err instanceof Error) throw err;
      throw new Error("An unexpected error occurred while communicating with OpenAI-compatible API.");
    }
  }
}

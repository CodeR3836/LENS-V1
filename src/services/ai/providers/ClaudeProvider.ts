import type {
  AIProviderAdapter,
  AICompletionRequest,
  AICompletionResponse,
  ProviderConfig,
  ProviderType,
} from "../types";

export class ClaudeProvider implements AIProviderAdapter {
  type: ProviderType = "claude";
  name = "Anthropic Claude";

  async complete(
    request: AICompletionRequest,
    config: ProviderConfig
  ): Promise<AICompletionResponse> {
    if (!config.apiKey || config.apiKey.trim().length === 0) {
      throw new Error("Claude API key is missing. Please configure your API key in LENS Settings.");
    }

    const baseUrl = (config.baseUrl || "https://api.anthropic.com").replace(/\/$/, "");
    const model = config.model || "claude-3-5-sonnet-20241022";

    const userContent: Array<Record<string, unknown>> = [];
    for (const img of request.images ?? []) {
      if (img.data?.trim()) {
        userContent.push({
          type: "image",
          source: {
            type: "base64",
            media_type: img.mimeType || "image/png",
            data: img.data.trim().replace(/^data:image\/[a-zA-Z]+;base64,/, ""),
          },
        });
      }
    }
    userContent.push({ type: "text", text: request.userPrompt });

    try {
      const response = await fetch(`${baseUrl}/v1/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": config.apiKey.trim(),
          "anthropic-version": "2023-06-01",
          "dangerously-allow-browser": "true",
        },
        body: JSON.stringify({
          model,
          max_tokens: request.maxTokens ?? 2048,
          system: request.systemPrompt,
          messages: [{ role: "user", content: userContent }],
          temperature: request.temperature ?? 0.7,
        }),
      });

      if (!response.ok) {
        const errorJson = await response.json().catch(() => ({}));
        const message =
          errorJson?.error?.message || `Claude API request failed with status ${response.status}.`;
        throw new Error(`Claude Provider Error (${response.status}): ${message}`);
      }

      const data = await response.json();
      const textContent = data.content
        ?.filter((c: { type: string; text?: string }) => c.type === "text")
        ?.map((c: { text?: string }) => c.text)
        ?.join("\n");

      return {
        text: textContent || "",
        model: data.model || model,
        usage: {
          inputTokens: data.usage?.input_tokens,
          outputTokens: data.usage?.output_tokens,
        },
      };
    } catch (err: unknown) {
      if (err instanceof Error) throw err;
      throw new Error("An unexpected error occurred while communicating with Claude API.");
    }
  }
}

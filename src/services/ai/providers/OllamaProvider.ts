import type {
  AIProviderAdapter,
  AICompletionRequest,
  AICompletionResponse,
  ProviderConfig,
  ProviderType,
} from "../types";

export class OllamaProvider implements AIProviderAdapter {
  type: ProviderType = "ollama";
  name = "Ollama (Local)";

  async complete(
    request: AICompletionRequest,
    config: ProviderConfig
  ): Promise<AICompletionResponse> {
    const baseUrl = (config.baseUrl || "http://localhost:11434").replace(/\/$/, "");
    const model = config.model || "llama3";

    const prompt = request.systemPrompt
      ? `System: ${request.systemPrompt}\n\nUser: ${request.userPrompt}`
      : request.userPrompt;

    const images = (request.images ?? [])
      .map((img) => img.data?.trim())
      .filter((data): data is string => Boolean(data));

    const body: Record<string, unknown> = {
      model,
      prompt,
      stream: false,
      options: {
        temperature: request.temperature ?? 0.7,
      },
    };
    if (images.length > 0) {
      body.images = images;
    }

    try {
      const response = await fetch(`${baseUrl}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Ollama Error (${response.status}): ${errorText || response.statusText}`);
      }

      const data = await response.json();
      return {
        text: data.response || "",
        model,
      };
    } catch (err: unknown) {
      if (err instanceof Error) {
        if (err.message.includes("Failed to fetch") || err.message.includes("ECONNREFUSED")) {
          throw new Error(
            `Could not connect to local Ollama server at ${baseUrl}. Please ensure Ollama is installed and running.`
          );
        }
        throw err;
      }
      throw new Error("An unexpected error occurred while communicating with Ollama.");
    }
  }
}

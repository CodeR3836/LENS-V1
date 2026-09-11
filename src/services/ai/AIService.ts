import type {
  AIProviderAdapter,
  AICompletionRequest,
  AICompletionResponse,
  ProviderConfig,
  ProviderType,
} from "./types";

import { MockProvider } from "./providers/MockProvider";
import { OllamaProvider } from "./providers/OllamaProvider";
import { ClaudeProvider } from "./providers/ClaudeProvider";
import { CustomOpenAIProvider } from "./providers/CustomOpenAIProvider";
import { GeminiProvider } from "./providers/GeminiProvider";
import { configStore } from "../config/configStore";

class AIService {
  private adapters: Map<ProviderType, AIProviderAdapter> = new Map();

  constructor() {
    this.registerAdapter(new MockProvider());
    this.registerAdapter(new OllamaProvider());
    this.registerAdapter(new ClaudeProvider());
    this.registerAdapter(new CustomOpenAIProvider());
    this.registerAdapter(new GeminiProvider());
  }

  registerAdapter(adapter: AIProviderAdapter): void {
    this.adapters.set(adapter.type, adapter);
  }

  async executeCompletion(
    request: AICompletionRequest
  ): Promise<AICompletionResponse> {
    const config = configStore.getActiveProviderConfig();
    const adapter = this.adapters.get(config.type);

    if (!adapter) {
      throw new Error(
        `AI Provider "${config.type}" is not supported.`
      );
    }

    return await adapter.complete(request, config);
  }

  async executeCompletionStream(
    request: AICompletionRequest,
    onChunk: (chunk: string) => void,
    signal?: AbortSignal
  ): Promise<AICompletionResponse> {
    const config = configStore.getActiveProviderConfig();
    const adapter = this.adapters.get(config.type);

    if (!adapter) {
      throw new Error(
        `AI Provider "${config.type}" is not supported.`
      );
    }

    if (adapter.completeStream) {
      return await adapter.completeStream(
        request,
        config,
        onChunk,
        signal
      );
    }

    const response = await adapter.complete(
      request,
      config
    );

    if (response.text) {
      onChunk(response.text);
    }

    return response;
  }

  async testConnection(
    type: ProviderType,
    config: ProviderConfig
  ): Promise<void> {
    const adapter = this.adapters.get(type);

    if (!adapter) {
      throw new Error(
        `AI Provider "${type}" is not supported.`
      );
    }

    const timeoutPromise = new Promise<never>(
      (_, reject) => {
        setTimeout(() => {
          reject(
            new Error(
              "Connection test timed out after 15 seconds."
            )
          );
        }, 15000);
      }
    );

    const testPromise = adapter.complete(
      {
        systemPrompt:
          "You are performing a connection test. Reply with exactly: OK",
        userPrompt:
          "Connection test. Reply with OK.",
        temperature: 0,
      },
      config
    );

    await Promise.race([
      testPromise,
      timeoutPromise,
    ]);
  }

  getActiveProviderName(): string {
    const config =
      configStore.getActiveProviderConfig();

    const adapter = this.adapters.get(config.type);

    return adapter?.name || config.type;
  }
}

export const aiService = new AIService();

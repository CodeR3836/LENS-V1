export type ProviderType =
  | "mock"
  | "ollama"
  | "claude"
  | "openai_compatible"
  | "gemini";

export interface ProviderConfig {
  type: ProviderType;
  apiKey?: string;
  baseUrl?: string;
  model?: string;
}

/**
 * Image input for vision-capable AI models.
 *
 * `data` must contain raw Base64 image data only.
 * Do NOT include the `data:image/png;base64,` prefix.
 */
export interface AIImageInput {
  data: string;
  mimeType: string;
}

export interface AICompletionRequest {
  systemPrompt?: string;
  userPrompt: string;

  /**
   * Optional images for vision-capable models.
   *
   * If omitted, the request is text-only.
   */
  images?: AIImageInput[];

  temperature?: number;
  maxTokens?: number;
}

export interface AICompletionResponse {
  text: string;
  model?: string;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
  };
}

export interface AIProviderAdapter {
  type: ProviderType;
  name: string;

  complete(
    request: AICompletionRequest,
    config: ProviderConfig
  ): Promise<AICompletionResponse>;

  completeStream?(
    request: AICompletionRequest,
    config: ProviderConfig,
    onChunk: (chunk: string) => void,
    signal?: AbortSignal
  ): Promise<AICompletionResponse>;
}
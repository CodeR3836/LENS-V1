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

export interface AIImageInput {
  data: string;
  mimeType: string;
}

export interface AICompletionRequest {
  systemPrompt?: string;
  userPrompt: string;

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

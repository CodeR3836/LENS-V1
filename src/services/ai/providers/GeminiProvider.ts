import type {
  AIProviderAdapter,
  AICompletionRequest,
  AICompletionResponse,
  ProviderConfig,
  ProviderType,
} from "../types";

export class GeminiProvider implements AIProviderAdapter {
  type: ProviderType = "gemini";
  name = "Google Gemini";

  async complete(
    request: AICompletionRequest,
    config: ProviderConfig
  ): Promise<AICompletionResponse> {
    return this.requestGemini(request, config, false);
  }

  async completeStream(
    request: AICompletionRequest,
    config: ProviderConfig,
    onChunk: (chunk: string) => void,
    signal?: AbortSignal
  ): Promise<AICompletionResponse> {
    return this.requestGemini(
      request,
      config,
      true,
      onChunk,
      signal
    );
  }

  private async requestGemini(
    request: AICompletionRequest,
    config: ProviderConfig,
    stream: boolean,
    onChunk?: (chunk: string) => void,
    signal?: AbortSignal
  ): Promise<AICompletionResponse> {
    if (!config.apiKey?.trim()) {
      throw new Error(
        "Gemini API key is missing. Please configure your API key in LENS Settings."
      );
    }

    const apiKey = config.apiKey.trim();

    const model =
      config.model?.trim() || "gemini-3.6-flash";

    const action = stream
      ? "streamGenerateContent"
      : "generateContent";

    const endpoint =
      `https://generativelanguage.googleapis.com/v1beta/models/` +
      `${encodeURIComponent(model)}:${action}` +
      `?key=${encodeURIComponent(apiKey)}` +
      (stream ? "&alt=sse" : "");


    const parts: Array<Record<string, unknown>> = [];

    for (const image of request.images ?? []) {
      if (!image.data?.trim()) {
        continue;
      }

      if (!image.mimeType?.trim()) {
        throw new Error(
          "Image MIME type is missing."
        );
      }

      const cleanData = image.data.trim().replace(/^data:image\/[a-zA-Z]+;base64,/, "");

      parts.push({
        inlineData: {
          mimeType: image.mimeType.trim(),
          data: cleanData,
        },
      });
    }

    parts.push({
      text: request.userPrompt,
    });

    const body: Record<string, unknown> = {
      contents: [
        {
          role: "user",
          parts,
        },
      ],
      generationConfig: {
        temperature: request.temperature ?? 0.7,
        ...(request.maxTokens ? { maxOutputTokens: request.maxTokens } : {}),
      },
    };

    if (request.systemPrompt?.trim()) {
      body.systemInstruction = {
        parts: [
          {
            text: request.systemPrompt.trim(),
          },
        ],
      };
    }

    /*
     * ----------------------------------------------------------
     * Debug information
     * ----------------------------------------------------------
     */

    console.log(
      `[Gemini] Model: ${model}`
    );

    console.log(
      `[Gemini] Images: ${
        request.images?.length ?? 0
      }`
    );

    const requestStartedAt = performance.now();

    /*
     * ----------------------------------------------------------
     * Send request
     * ----------------------------------------------------------
     */

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal,
    });

    console.log(
      `[Gemini] Response headers after ${
        Math.round(
          performance.now() - requestStartedAt
        )
      }ms`
    );

    /*
     * ----------------------------------------------------------
     * Handle API errors
     * ----------------------------------------------------------
     */

    if (!response.ok) {
      const errorJson = await response
        .json()
        .catch(() => null);

      const message =
        errorJson &&
        typeof errorJson === "object" &&
        "error" in errorJson &&
        errorJson.error &&
        typeof errorJson.error === "object" &&
        "message" in errorJson.error
          ? String(
              errorJson.error.message
            )
          : `Gemini API request failed with status ${response.status}.`;

      throw new Error(
        `Gemini API Error (${response.status}): ${message}`
      );
    }

    /*
     * ----------------------------------------------------------
     * Normal non-streaming completion
     * ----------------------------------------------------------
     */

    if (!stream) {
      const data = await response.json();

      const text =
        data?.candidates?.[0]?.content?.parts
          ?.map(
            (part: { text?: string }) =>
              part.text || ""
          )
          .join("") || "";

      return {
        text,
        model:
          data?.modelVersion || model,
        usage: {
          inputTokens:
            data?.usageMetadata
              ?.promptTokenCount,
          outputTokens:
            data?.usageMetadata
              ?.candidatesTokenCount,
        },
      };
    }

    /*
     * ----------------------------------------------------------
     * Streaming response
     * ----------------------------------------------------------
     */

    if (!response.body) {
      throw new Error(
        "Gemini streaming response body is unavailable."
      );
    }

    const reader =
      response.body.getReader();

    const decoder =
      new TextDecoder("utf-8");

    const streamStartedAt =
      performance.now();

    let hasLoggedFirstChunk = false;

    let buffer = "";
    let fullText = "";

    let modelUsed = model;

    let inputTokens:
      | number
      | undefined;

    let outputTokens:
      | number
      | undefined;

    /*
     * ----------------------------------------------------------
     * Process one complete SSE event
     * ----------------------------------------------------------
     */

    const processSSEEvent = (
      event: string
    ) => {
      const lines =
        event.split(/\r?\n/);

      const dataLines = lines
        .filter((line) =>
          line.startsWith("data:")
        )
        .map((line) =>
          line.slice(5).trim()
        );

      if (dataLines.length === 0) {
        return;
      }

      const jsonText =
        dataLines.join("");

      if (
        !jsonText ||
        jsonText === "[DONE]"
      ) {
        return;
      }

      try {
        const data =
          JSON.parse(jsonText);

        /*
         * Extract generated text.
         */

        const parts =
          data?.candidates?.[0]
            ?.content?.parts;

        if (Array.isArray(parts)) {
          const chunkText =
            parts
              .map(
                (
                  part: {
                    text?: string;
                  }
                ) =>
                  part.text || ""
              )
              .join("");

          if (chunkText) {
            if (
              !hasLoggedFirstChunk
            ) {
              hasLoggedFirstChunk =
                true;

              console.log(
                `[Gemini] First chunk after ${
                  Math.round(
                    performance.now() -
                      streamStartedAt
                  )
                }ms`
              );
            }

            fullText += chunkText;

            onChunk?.(
              chunkText
            );
          }
        }

        /*
         * Model information.
         */

        if (
          data?.modelVersion
        ) {
          modelUsed =
            data.modelVersion;
        }

        /*
         * Usage information.
         */

        if (
          data?.usageMetadata
        ) {
          inputTokens =
            data
              .usageMetadata
              .promptTokenCount ??
            inputTokens;

          outputTokens =
            data
              .usageMetadata
              .candidatesTokenCount ??
            outputTokens;
        }
      } catch {
        /*
         * Ignore malformed/
         * incomplete SSE events.
         */
      }
    };

    /*
     * ----------------------------------------------------------
     * Read SSE stream
     * ----------------------------------------------------------
     */

    try {
      while (true) {
        const {
          done,
          value,
        } = await reader.read();

        if (done) {
          break;
        }

        buffer +=
          decoder.decode(value, {
            stream: true,
          });

        const events =
          buffer.split(
            /\r?\n\r?\n/
          );

        buffer =
          events.pop() ?? "";

        for (
          const event of events
        ) {
          processSSEEvent(
            event
          );
        }
      }

      /*
       * Flush TextDecoder.
       */

      buffer +=
        decoder.decode();

      /*
       * Process final event.
       */

      if (buffer.trim()) {
        processSSEEvent(
          buffer
        );
      }
    } finally {
      reader.releaseLock();
    }

    /*
     * ----------------------------------------------------------
     * Final response
     * ----------------------------------------------------------
     */

    return {
      text: fullText,
      model: modelUsed,
      usage: {
        inputTokens,
        outputTokens,
      },
    };
  }
}

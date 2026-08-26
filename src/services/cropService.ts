/**
 * cropService.ts
 *
 * Screen crop capture & AI Vision OCR service.
 * Coordinates image capture from Tauri backend, delegates OCR extraction
 * directly to the configured AI provider/model, and updates cropStore.
 */

import { invoke } from "@tauri-apps/api/core";
import { configStore } from "./config/configStore";
import { aiService } from "./ai/AIService";
import { cropStore } from "./cropStore";
import type { ProviderType } from "./ai/types";

export const OCR_PROMPT = `Transcribe ONLY the text visibly present in this image.

Do not describe the image.
Do not summarize.
Do not translate.
Do not infer missing text.
Do not invent text.
Return only the extracted text.`;

export interface CapturedImagePayload {
  image_base64: string;
  mime_type: string;
  rect: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  session_id: number;
  width: number;
  height: number;
}

/**
 * Checks if the configured provider and model support vision / multimodal input.
 */
export function isModelVisionCapable(provider: ProviderType, model?: string): boolean {
  const m = (model || "").toLowerCase();
  switch (provider) {
    case "gemini":
      // All modern Gemini models support vision
      return true;
    case "claude":
      // Claude 3+ models support vision
      return m.includes("claude-3") || m.includes("claude-3-5") || m.includes("claude-3-7") || m === "";
    case "openai_compatible":
      // Vision-capable OpenAI-compatible models
      return (
        m.includes("gpt-4o") ||
        m.includes("gpt-4-turbo") ||
        m.includes("vision") ||
        m.includes("gemini") ||
        m.includes("claude") ||
        m.includes("qwen-vl") ||
        m.includes("llava") ||
        m === ""
      );
    case "ollama":
      // Vision-capable Ollama models
      return (
        m.includes("llava") ||
        m.includes("bakllava") ||
        m.includes("vision") ||
        m.includes("minicpm-v") ||
        m.includes("moondream")
      );
    case "mock":
      return true;
    default:
      return false;
  }
}

/**
 * Starts a native crop overlay session and registers the new session ID.
 * Returns the session ID assigned by the Rust backend.
 */
export async function startScreenCrop(): Promise<number> {
  const sessionId = await invoke<number>("open_crop_window");
  cropStore.startSession(sessionId);
  return sessionId;
}

/**
 * Executes AI vision OCR on the captured screen image.
 *
 * Correct order:
 *   1. Validate session (discard if superseded)
 *   2. Check provider vision capability
 *   3. Send image to AI provider
 *   4. Validate session again after async OCR
 *   5. Commit result to cropStore FIRST
 *   6. Return extracted text to caller
 *
 * Returns extracted text (may be empty string on empty image or stale session).
 * Throws on provider/capability errors.
 */
export async function executeVisionOCR(payload: CapturedImagePayload): Promise<string> {
  const { session_id, rect, width, height, image_base64, mime_type } = payload;

  console.log(`[AI OCR] CROP_START session=${session_id}`);
  console.log(`[AI OCR] MODE=AI_ONLY`);

  // 1. Pre-OCR session check
  if (session_id < cropStore.getActiveSessionId()) {
    console.log(`[AI OCR] STALE_DISCARD session=${session_id} (active=${cropStore.getActiveSessionId()})`);
    return "";
  }

  const activeConfig = configStore.getActiveProviderConfig();
  console.log(`[AI OCR] PROVIDER=${activeConfig.type}`);
  console.log(`[AI OCR] MODEL=${activeConfig.model || "default"}`);
  console.log(`[AI OCR] FINAL_PROVIDER=${activeConfig.type}`);
  console.log(`[AI OCR] FINAL_MODEL=${activeConfig.model || "default"}`);
  console.log(`[AI OCR] EXECUTING_PROVIDER=${activeConfig.type.toUpperCase()}`);

  const base64Clean = image_base64.trim().replace(/^data:image\/[a-zA-Z]+;base64,/, "");

  let hash = 0;
  for (let i = 0; i < Math.min(base64Clean.length, 1000); i++) {
    hash = (hash << 5) - hash + base64Clean.charCodeAt(i);
    hash |= 0;
  }
  const hashHex = (hash >>> 0).toString(16);

  console.log(`[AI OCR] SESSION=${session_id}`);
  console.log(`[AI OCR] IMAGE_WIDTH=${width}`);
  console.log(`[AI OCR] IMAGE_HEIGHT=${height}`);
  console.log(`[AI OCR] MIME=${mime_type}`);
  console.log(`[AI OCR] IMAGE_HASH=${hashHex}`);

  // 2. Vision capability check — throw a clear user-facing error
  if (!isModelVisionCapable(activeConfig.type, activeConfig.model)) {
    throw new Error(
      "AI OCR failed. Selected model does not support image OCR. Please select a vision-capable model in LENS Settings."
    );
  }

  const tReqStart = performance.now();
  console.log(`[CROP PERF] OCR_REQUEST_START session=${session_id} t=${tReqStart.toFixed(2)}ms`);

  // 3. Send to AI provider with maxTokens optimization to limit token decode buffer
  const response = await aiService.executeCompletion({
    userPrompt: OCR_PROMPT,
    images: [
      {
        data: image_base64,
        mimeType: mime_type,
      },
    ],
    temperature: 0.0,
    maxTokens: 1024,
  });

  const tRespRecv = performance.now();
  console.log(`[CROP PERF] OCR_RESPONSE_RECEIVED session=${session_id} t=${tRespRecv.toFixed(2)}ms (network latency = ${(tRespRecv - tReqStart).toFixed(2)}ms)`);

  const extractedText = (response.text || "").trim();
  const tParsed = performance.now();
  console.log(`[CROP PERF] OCR_RESULT_PARSED session=${session_id} t=${tParsed.toFixed(2)}ms (parse time = ${(tParsed - tRespRecv).toFixed(2)}ms)`);
  console.log(`[CROP FLOW] OCR_RESULT session=${session_id} text="${extractedText.slice(0, 80)}"`);
  console.log(`[CROP FLOW] ACTIVE_SESSION=${cropStore.getActiveSessionId()}`);

  // 4. Post-OCR session check — discard if superseded while AI was running
  if (session_id < cropStore.getActiveSessionId()) {
    console.log(`[CROP FLOW] STALE_DISCARD_POST_OCR session=${session_id}`);
    return "";
  }

  // 5. Commit to cropStore FIRST, before any UI update
  if (extractedText.length > 0) {
    const committed = cropStore.setRecentCrop(extractedText, rect, session_id);
    if (committed === null) {
      // setRecentCrop rejected it (session was superseded between check and commit)
      console.log(`[CROP FLOW] STORE_REJECTED session=${session_id}`);
      return "";
    }
  } else {
    cropStore.clearRecentCrop();
    console.log(`[CROP FLOW] STORE_CLEARED session=${session_id} (empty OCR result)`);
  }

  return extractedText;
}

/**
 * Returns the most recent validated cropped text from the store.
 * Only returns text if it belongs to the latest completed session.
 */
export function getRecentCroppedText(): string | null {
  return cropStore.getValidatedCrop()?.text ?? null;
}



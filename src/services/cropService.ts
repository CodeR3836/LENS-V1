

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

export function isModelVisionCapable(provider: ProviderType, model?: string): boolean {
  const m = (model || "").toLowerCase();
  switch (provider) {
    case "gemini":

      return true;
    case "claude":

      return m.includes("claude-3") || m.includes("claude-3-5") || m.includes("claude-3-7") || m === "";
    case "openai_compatible":

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

export async function startScreenCrop(): Promise<number> {
  const sessionId = await invoke<number>("open_crop_window");
  cropStore.startSession(sessionId);
  return sessionId;
}

export async function executeVisionOCR(payload: CapturedImagePayload): Promise<string> {
  const { session_id, rect, width, height, image_base64, mime_type } = payload;

  console.log(`[AI OCR] CROP_START session=${session_id}`);
  console.log(`[AI OCR] MODE=AI_ONLY`);

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

  if (!isModelVisionCapable(activeConfig.type, activeConfig.model)) {
    throw new Error(
      "AI OCR failed. Selected model does not support image OCR. Please select a vision-capable model in LENS Settings."
    );
  }

  const tReqStart = performance.now();
  console.log(`[CROP PERF] OCR_REQUEST_START session=${session_id} t=${tReqStart.toFixed(2)}ms`);

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

  if (session_id < cropStore.getActiveSessionId()) {
    console.log(`[CROP FLOW] STALE_DISCARD_POST_OCR session=${session_id}`);
    return "";
  }

  if (extractedText.length > 0) {
    const committed = cropStore.setRecentCrop(extractedText, rect, session_id);
    if (committed === null) {

      console.log(`[CROP FLOW] STORE_REJECTED session=${session_id}`);
      return "";
    }
  } else {
    cropStore.clearRecentCrop();
    console.log(`[CROP FLOW] STORE_CLEARED session=${session_id} (empty OCR result)`);
  }

  return extractedText;
}

export function getRecentCroppedText(): string | null {
  return cropStore.getValidatedCrop()?.text ?? null;
}



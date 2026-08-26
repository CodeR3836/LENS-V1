/**
 * CropApp.tsx
 *
 * Standalone root component for the crop-overlay window.
 * This window is opened by the main LENS window for screen-region selection.
 *
 * Flow:
 *  1. Window is created hidden (visible: false) by the Rust command.
 *  2. React mounts → calls show_crop_window → window becomes visible.
 *  3. User selects a region and confirms or cancels.
 *  4. CropOverlay emits a Tauri event and closes this window.
 */
import { useEffect, type FC } from "react";
import { invoke } from "@tauri-apps/api/core";
import CropOverlay from "./components/CropOverlay";
import "./App.css"; // keep global token/reset styles

const CropApp: FC = () => {
  useEffect(() => {
    // Show window only after React has finished painting the transparent overlay.
    // This avoids the black-flash that occurs when the native window is shown
    // before WebView2 has rendered the content.
    const timer = setTimeout(async () => {
      try {
        await invoke("show_crop_window");
      } catch (e) {
        console.error("Failed to show crop window:", e);
      }
    }, 50); // 50 ms is enough for a first paint

    return () => clearTimeout(timer);
  }, []);

  return <CropOverlay />;
};

export default CropApp;

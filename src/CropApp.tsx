
import { useEffect, type FC } from "react";
import { invoke } from "@tauri-apps/api/core";
import CropOverlay from "./components/CropOverlay";
import "./App.css"; 

const CropApp: FC = () => {
  useEffect(() => {

    const timer = setTimeout(async () => {
      try {
        await invoke("show_crop_window");
      } catch (e) {
        console.error("Failed to show crop window:", e);
      }
    }, 50); 

    return () => clearTimeout(timer);
  }, []);

  return <CropOverlay />;
};

export default CropApp;

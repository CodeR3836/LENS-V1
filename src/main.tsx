import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import CropApp from "./CropApp";

// Detect whether this window was opened as the crop overlay
const isCropMode = new URLSearchParams(window.location.search).has("crop");

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    {isCropMode ? <CropApp /> : <App />}
  </React.StrictMode>
);

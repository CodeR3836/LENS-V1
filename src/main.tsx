import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import CropApp from "./CropApp";

const isCropMode = new URLSearchParams(window.location.search).has("crop");

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    {isCropMode ? <CropApp /> : <App />}
  </React.StrictMode>
);

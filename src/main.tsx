import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { ThemeProvider } from "./components/ThemeProvider";

// Detect iOS WebKit and add class for targeted CSS fallbacks
(function detectiOS() {
  try {
    const ua = navigator.userAgent;
    const isIOS = /iPad|iPhone|iPod/.test(ua) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    if (isIOS) {
      document.documentElement.classList.add('ios-webkit');
    }
  } catch (_) {
    // Silent fail – never block app boot
  }
})();

const renderApp = () => {
  createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <ThemeProvider>
        <App />
      </ThemeProvider>
    </React.StrictMode>
  );
};

const bootstrap = async () => {
  try {
    await import("./i18n");
  } catch {
    // Prevent iOS WebKit startup crash from blocking app mount
  }

  renderApp();
};

bootstrap();

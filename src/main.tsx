import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { ThemeProvider } from "./components/ThemeProvider";

const VIEWPORT_CONTENT = "width=device-width, initial-scale=1.0, viewport-fit=cover";
const OAUTH_VIEWPORT_RESET_KEY = "oauth_viewport_reset_pending";

const ensureViewportMeta = () => {
  let viewportMeta = document.querySelector('meta[name="viewport"]');

  if (!viewportMeta) {
    viewportMeta = document.createElement("meta");
    viewportMeta.setAttribute("name", "viewport");
    document.head.appendChild(viewportMeta);
  }

  if (viewportMeta.getAttribute("content") !== VIEWPORT_CONTENT) {
    viewportMeta.setAttribute("content", VIEWPORT_CONTENT);
  }
};

const resetLayoutAfterOAuthRedirect = () => {
  let shouldReset = false;

  try {
    shouldReset = sessionStorage.getItem(OAUTH_VIEWPORT_RESET_KEY) === "1";
    if (shouldReset) sessionStorage.removeItem(OAUTH_VIEWPORT_RESET_KEY);
  } catch {
    shouldReset = false;
  }

  if (!shouldReset) return;

  document.documentElement.style.width = "100%";
  document.body.style.width = "100%";
  document.documentElement.style.minWidth = "0";
  document.body.style.minWidth = "0";

  requestAnimationFrame(() => {
    window.dispatchEvent(new Event("resize"));
    window.scrollTo(0, 0);
  });
};

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

  ensureViewportMeta();
  resetLayoutAfterOAuthRedirect();
  renderApp();
};

bootstrap();

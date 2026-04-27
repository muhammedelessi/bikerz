import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { ThemeProvider } from "./components/ThemeProvider";

/** After deploy, stale HTML can point at removed chunks — reload once instead of a blank screen. */
window.addEventListener("vite:preloadError", (event) => {
  event.preventDefault();
  window.location.reload();
});

/**
 * Service-worker auto-reload after deploy.
 *
 * The PWA is configured with `registerType: "autoUpdate"`, which makes the new
 * service worker call `skipWaiting` + `clientsClaim` as soon as it installs.
 * That swap fires the `controllerchange` event in every tab still running the
 * old chunks. Without an explicit reload here, those tabs keep showing the old
 * cached JavaScript (e.g. an old sidebar that's missing the "Apply as Trainer"
 * button) until the user manually refreshes. Reloading once on the swap means
 * users see new releases immediately.
 */
if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
  let reloading = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (reloading) return;
    reloading = true;
    window.location.reload();
  });
}

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

  // Force viewport meta reset
  ensureViewportMeta();

  // Reset any inline dimension overrides
  document.documentElement.style.width = "100%";
  document.body.style.width = "100%";
  document.documentElement.style.minWidth = "0";
  document.body.style.minWidth = "0";
  document.documentElement.style.maxWidth = "100vw";
  document.body.style.maxWidth = "100vw";
  document.documentElement.style.overflowX = "hidden";
  document.body.style.overflowX = "hidden";

  // Double-frame layout recalculation for WebKit
  requestAnimationFrame(() => {
    window.dispatchEvent(new Event("resize"));
    window.scrollTo(0, 0);
    requestAnimationFrame(() => {
      window.dispatchEvent(new Event("resize"));
    });
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

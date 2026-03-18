import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { ThemeProvider } from "./components/ThemeProvider";

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

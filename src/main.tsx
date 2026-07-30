import React from "react";
import { createRoot } from "react-dom/client";
import { disposeRenderWorkers } from "./core/renderDocument";
import { App } from "./ui/App";
import { AgentChatWindowApp } from "./ui/AgentChatWindowApp";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import "github-markdown-css/github-markdown.css";
import "highlight.js/styles/github.css";
import "katex/dist/katex.min.css";
import "./ui/styles.css";

window.addEventListener("beforeunload", disposeRenderWorkers);

const root = createRoot(document.getElementById("root") as HTMLElement);
const detachedAgentWindow =
  Boolean(
    (
      window as typeof window & {
        __TAURI_INTERNALS__?: unknown;
      }
    ).__TAURI_INTERNALS__,
  ) && getCurrentWebviewWindow().label.startsWith("agent-");

root.render(
  detachedAgentWindow ? (
    <AgentChatWindowApp />
  ) : (
    <React.StrictMode>
      <App />
    </React.StrictMode>
  ),
);

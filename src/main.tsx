import React from "react";
import { createRoot } from "react-dom/client";
import { disposeRenderWorkers } from "./core/renderDocument";
import { App } from "./ui/App";
import "github-markdown-css/github-markdown.css";
import "highlight.js/styles/github.css";
import "katex/dist/katex.min.css";
import "./ui/styles.css";

window.addEventListener("beforeunload", disposeRenderWorkers);

const root = createRoot(document.getElementById("root") as HTMLElement);

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

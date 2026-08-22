async function probeWorkerRender() {
  try {
    const module = await import("mermaid");
    module.default.initialize({ startOnLoad: false, securityLevel: "strict" });
    await module.default.render("worker-probe", "flowchart LR\nA-->B");
    self.postMessage({ status: "unexpected-render" });
  } catch {
    self.postMessage({
      status: typeof document === "undefined" ? "dom-unavailable" : "error",
    });
  }
}

void probeWorkerRender();

/* global addEventListener, parent, performance, window */

(() => {
  "use strict";

  const protocolVersion = 1;
  const resourcePattern = /(?:^|[,{\n\r])\s*["']?img["']?\s*:/iu;
  let connected = false;

  function exactRequest(value, scope) {
    if (!value || typeof value !== "object") return false;
    if (
      value.protocolVersion !== protocolVersion ||
      value.scope !== scope ||
      typeof value.requestId !== "string" ||
      value.requestId.length === 0 ||
      value.requestId.length > 96
    ) {
      return false;
    }
    if (value.type === "render") {
      return (
        Object.keys(value).length === 5 && typeof value.source === "string"
      );
    }
    if (value.type === "busy") {
      return (
        Object.keys(value).length === 5 &&
        Number.isInteger(value.durationMs) &&
        value.durationMs >= 0 &&
        value.durationMs <= 5_000
      );
    }
    return false;
  }

  addEventListener("message", (event) => {
    if (
      connected ||
      event.source !== parent ||
      !event.data ||
      event.data.type !== "svard-mermaid-connect" ||
      event.data.protocolVersion !== protocolVersion ||
      typeof event.data.scope !== "string" ||
      !/^[0-9a-f]{32}$/u.test(event.data.scope) ||
      event.ports.length !== 1
    ) {
      return;
    }
    connected = true;
    const scope = event.data.scope;
    const port = event.ports[0];
    window.mermaid.initialize({
      startOnLoad: false,
      securityLevel: "strict",
      htmlLabels: false,
      flowchart: { htmlLabels: false },
      theme: "default",
    });
    port.onmessage = async (messageEvent) => {
      const request = messageEvent.data;
      if (!exactRequest(request, scope)) return;
      port.postMessage({
        type: "started",
        protocolVersion,
        requestId: request.requestId,
        scope,
      });
      if (request.type === "busy") {
        const end = performance.now() + request.durationMs;
        while (performance.now() < end) {
          // Deliberately busy for hard-cancellation feasibility only.
        }
        port.postMessage({
          type: "result",
          protocolVersion,
          requestId: request.requestId,
          scope,
          status: "rendered",
          svg: '<svg xmlns="http://www.w3.org/2000/svg"></svg>',
        });
        return;
      }
      if (resourcePattern.test(request.source)) {
        port.postMessage({
          type: "result",
          protocolVersion,
          requestId: request.requestId,
          scope,
          status: "blocked",
        });
        return;
      }
      try {
        const result = await window.mermaid.render(
          request.requestId,
          request.source,
        );
        port.postMessage({
          type: "result",
          protocolVersion,
          requestId: request.requestId,
          scope,
          status: "rendered",
          svg: result.svg,
        });
      } catch {
        port.postMessage({
          type: "result",
          protocolVersion,
          requestId: request.requestId,
          scope,
          status: "error",
        });
      }
    };
    port.start();
    port.postMessage({ type: "ready", protocolVersion, scope });
  });
})();

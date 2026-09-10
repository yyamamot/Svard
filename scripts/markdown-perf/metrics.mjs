export function summarizePerfEvents(events) {
  return events
    .filter((event) => typeof event?.event === "string")
    .map((event) => ({
      event: event.event,
      deliveryPrimed: event.deliveryPrimed,
      durationMs: event.durationMs,
      bytes: event.bytes,
      count: event.count,
      skipped: event.skipped,
      status: event.status,
      reason: event.reason,
      trigger: event.trigger,
      label: event.label,
      passes: event.passes,
      queueDepth: event.queueDepth,
      renderCoreMs: event.renderCoreMs,
      renderStartDeltaMs: event.renderStartDeltaMs,
      responsePostDeltaMs: event.responsePostDeltaMs,
      reusedWorker: event.reusedWorker,
      sincePostMessageMs: event.sincePostMessageMs,
      workerReceivedAtMs: event.workerReceivedAtMs,
    }));
}

export function deriveStopGateSummary(phases) {
  const plainByPhase = Object.fromEntries(
    phases.map((phase) => [
      phase.phase,
      phase.documents.find(
        (document) => document.basename === "plain-small.md",
      ),
    ]),
  );
  const bootWarm = plainByPhase.bootWarmBeforeOpen;
  const repeatedWarm = plainByPhase.repeatedWarm;
  return {
    firstOpenPenaltyMs:
      typeof bootWarm?.domReadyMs === "number" &&
      typeof repeatedWarm?.domReadyMs === "number"
        ? Number((bootWarm.domReadyMs - repeatedWarm.domReadyMs).toFixed(2))
        : null,
    workerDeliveryPenaltyMs:
      typeof bootWarm?.workerDeliveryMs === "number" &&
      typeof repeatedWarm?.workerDeliveryMs === "number"
        ? Number(
            (bootWarm.workerDeliveryMs - repeatedWarm.workerDeliveryMs).toFixed(
              2,
            ),
          )
        : null,
  };
}

export function eventDuration(events, eventName) {
  const event = events.find((candidate) => candidate.event === eventName);
  return typeof event?.durationMs === "number" ? event.durationMs : null;
}

function eventSkipped(events, eventName) {
  const event = events.find((candidate) => candidate.event === eventName);
  return typeof event?.skipped === "boolean" ? event.skipped : null;
}

export function lastEvent(events, eventName) {
  return events.filter((event) => event.event === eventName).at(-1) ?? null;
}

export function derivedDocumentSummary(events) {
  const renderDuration = eventDuration(events, "render.renderDocument");
  const markdownDuration = eventDuration(events, "render.markdown.total");
  const firstHtmlSetDuration = eventDuration(
    events,
    "render.firstDocumentHtmlSet",
  );
  const workerResponse = lastEvent(events, "render.workerPool.response");
  const workerMessage = lastEvent(events, "render.workerPool.messageReceived");
  const workerMetrics = lastEvent(events, "render.workerPool.workerMetrics");
  const workerDeliveryMs =
    typeof workerMessage?.sincePostMessageMs === "number" &&
    typeof workerMetrics?.responsePostDeltaMs === "number"
      ? Number(
          (
            workerMessage.sincePostMessageMs - workerMetrics.responsePostDeltaMs
          ).toFixed(2),
        )
      : null;
  return {
    domCommitMs: eventDuration(events, "render.articleInnerHtmlCommit"),
    htmlSetMinusRenderMs:
      firstHtmlSetDuration !== null && renderDuration !== null
        ? Number((firstHtmlSetDuration - renderDuration).toFixed(2))
        : null,
    renderMinusMarkdownMs:
      renderDuration !== null && markdownDuration !== null
        ? Number((renderDuration - markdownDuration).toFixed(2))
        : null,
    workerResponseMs:
      typeof workerResponse?.durationMs === "number"
        ? workerResponse.durationMs
        : null,
    workerCoreMs:
      typeof workerMetrics?.renderCoreMs === "number"
        ? workerMetrics.renderCoreMs
        : null,
    workerDeliveryMs,
    htmlSetToDomReadyMs: null,
    domReadyToFirstFrameMs: null,
    prepareDocumentHtmlMs: eventDuration(events, "render.prepareDocumentHtml"),
    sanitizeMs: eventDuration(events, "render.prepareDocumentHtml.sanitize"),
    sanitizedDomParseMs: eventDuration(
      events,
      "render.prepareDocumentHtml.sanitizedDomParse",
    ),
    sanitizedDomParseSkipped: eventSkipped(
      events,
      "render.prepareDocumentHtml.sanitizedDomParse",
    ),
  };
}

export function addDomBoundarySummary(summary, timings) {
  return {
    ...summary,
    domReadyToFirstFrameMs:
      typeof timings.firstFrameAfterDomMs === "number" &&
      typeof timings.domReadyMs === "number"
        ? Number((timings.firstFrameAfterDomMs - timings.domReadyMs).toFixed(2))
        : null,
    htmlSetToDomReadyMs:
      typeof timings.domReadyMs === "number" &&
      typeof timings.firstHtmlSetDuration === "number"
        ? Number((timings.domReadyMs - timings.firstHtmlSetDuration).toFixed(2))
        : null,
  };
}

export function derivePlaceholderMeasurements(phases) {
  const repeatedWarm = phases.find((phase) => phase.phase === "repeatedWarm");
  return (repeatedWarm?.documents ?? [])
    .filter((document) => Number.isSafeInteger(document.placeholderDepth))
    .map((document) => {
      const event = lastEvent(
        document.events,
        "render.markdown.replaceDetails",
      );
      return {
        stage: "markdown.replaceDetails",
        count: event?.count ?? null,
        inputBytes: document.bytes,
        outputBytes: document.outputBytes,
        durationMs:
          typeof event?.durationMs === "number" ? event.durationMs : null,
      };
    });
}

export function withoutPlaceholderMeasurementDocuments(reportData) {
  return {
    ...reportData,
    phases: reportData.phases.map((phase) => ({
      ...phase,
      documents: phase.documents.filter(
        (document) => !Number.isSafeInteger(document.placeholderDepth),
      ),
    })),
  };
}

export function diagnosticEventSummary(events) {
  return events.map((event) => ({
    durationMs: event.durationMs,
    event: event.event,
    label: event.label,
    queueDepth: event.queueDepth,
    renderCoreMs: event.renderCoreMs,
    renderStartDeltaMs: event.renderStartDeltaMs,
    responsePostDeltaMs: event.responsePostDeltaMs,
    reusedWorker: event.reusedWorker,
    sincePostMessageMs: event.sincePostMessageMs,
    status: event.status,
    workerReceivedAtMs: event.workerReceivedAtMs,
  }));
}

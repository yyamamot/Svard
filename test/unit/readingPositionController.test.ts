import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { bindReadingPosition } from "../../src/ui/lib/bindReadingPosition";
import { createReadingPositionController } from "../../src/ui/lib/readingPositionController";
import { setArticleLayoutState } from "../../src/ui/lib/articleLayoutStability";
import { readingSurface } from "./helpers/readingSurface";

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
  document.body.innerHTML = "";
});

describe("reading position transitions", () => {
  it("transfers an unvisited position without reviving a previous split pane's cache", () => {
    const controller = createReadingPositionController();
    const { surface } = readingSurface();
    const detach = bindReadingPosition(controller, "right", surface);
    surface.viewer.scrollTop = 1900;
    controller.capture("right");
    controller.prepare("left", surface.payload.path);
    controller.transfer("left", "right", surface.payload.path);
    expect(surface.viewer.scrollTop).toBe(0);
    detach();
    controller.dispose();
  });

  it("cancels a queued B when A is reselected before B commits", () => {
    const controller = createReadingPositionController();
    const { surface } = readingSurface();
    const detach = bindReadingPosition(controller, "left", surface);
    surface.viewer.scrollTop = 1377;
    controller.prepare("left", "/workspace/b.md");
    controller.prepare("left", surface.payload.path);
    expect(surface.viewer.scrollTop).toBe(1377);
    expect(controller.isRestoring()).toBe(false);
    detach();
    controller.dispose();
  });

  it("captures at commit time, waits for the matching article, and restores after ready", () => {
    const controller = createReadingPositionController();
    const a = readingSurface().surface;
    const detachA = bindReadingPosition(controller, "left", a);
    a.viewer.scrollTop = 1200;
    controller.beginNavigation();
    a.viewer.scrollTop = 1300; // User continues reading during IO.
    controller.prepare("left", "/workspace/b.md");
    detachA();
    const b = readingSurface("/workspace/b.md").surface;
    b.article.dataset.layoutState = "pending";
    const detachB = bindReadingPosition(controller, "left", b);
    setArticleLayoutState(b.article, "0", "ready");
    expect(b.viewer.scrollTop).toBe(0);
    controller.cancel();
    controller.prepare("left", a.payload.path);
    detachB();
    a.viewer.scrollTop = 0;
    a.article.dataset.layoutState = "pending";
    const detach = bindReadingPosition(controller, "left", a);
    expect(a.viewer.scrollTop).toBe(0);
    setArticleLayoutState(a.article, "0", "ready");
    expect(a.viewer.scrollTop).toBe(1300);
    detach();
    controller.dispose();
  });

  it("retains the original anchor across a clamped placeholder and stops corrections after two seconds", async () => {
    const controller = createReadingPositionController();
    const { surface, geometry } = readingSurface();
    let detach = bindReadingPosition(controller, "left", surface);
    surface.viewer.scrollTop = 1300;
    controller.capture("left");
    controller.prepare("left", "/workspace/b.md");
    detach();
    controller.prepare("left", surface.payload.path);
    geometry.height = 700;
    surface.viewer.scrollTop = 0;
    detach = bindReadingPosition(controller, "left", surface);
    expect(surface.viewer.scrollTop).toBe(200);
    geometry.height = 5000;
    surface.article.dispatchEvent(new Event("load"));
    await vi.advanceTimersByTimeAsync(100);
    expect(surface.viewer.scrollTop).toBe(1300);
    await vi.advanceTimersByTimeAsync(2000);
    surface.viewer.scrollTop = 900;
    surface.article.dispatchEvent(new Event("load"));
    await vi.advanceTimersByTimeAsync(100);
    expect(surface.viewer.scrollTop).toBe(900);
    expect(controller.isRestoring()).toBe(false);
    detach();
    controller.dispose();
  });

  it("drops stale commits, handles layout timeout once, and cancels pending correction", () => {
    const controller = createReadingPositionController();
    const { surface } = readingSurface();
    const detach = bindReadingPosition(controller, "left", surface);
    surface.viewer.scrollTop = 1300;
    controller.preserve("left");
    surface.viewer.scrollTop = 0;
    surface.article.dataset.layoutCommit = "2";
    setArticleLayoutState(surface.article, "0", "ready");
    expect(surface.viewer.scrollTop).toBe(0);
    detach();
    surface.article.dataset.layoutState = "timeout";
    const detachNext = bindReadingPosition(controller, "left", surface);
    expect(surface.viewer.scrollTop).toBe(1300);
    expect(controller.isRestoring()).toBe(false);
    controller.preserve("left");
    controller.cancel("left");
    surface.viewer.scrollTop = 700;
    setArticleLayoutState(surface.article, "0", "ready");
    expect(surface.viewer.scrollTop).toBe(700);
    detachNext();
    controller.dispose();
  });

  it("separates identical paths in split panes, transfers the survivor, and forgets closed tabs", () => {
    const controller = createReadingPositionController();
    const a = readingSurface().surface;
    const b = readingSurface().surface;
    const detachA = bindReadingPosition(controller, "left", a);
    const detachB = bindReadingPosition(controller, "right", b);
    a.viewer.scrollTop = 1000;
    b.viewer.scrollTop = 2000;
    controller.captureAll();
    controller.preserve("left");
    controller.preserve("right");
    expect(a.viewer.scrollTop).toBe(1000);
    expect(b.viewer.scrollTop).toBe(2000);
    controller.transfer("right", "left", b.payload.path);
    expect(a.viewer.scrollTop).toBe(2000);
    controller.forget([a.payload.path]);
    controller.captureAll();
    detachA();
    detachB();
    controller.prepare("left", a.payload.path);
    const detach = bindReadingPosition(controller, "left", a);
    expect(a.viewer.scrollTop).toBe(0);
    detach();
    controller.dispose();
  });

  it("gives explicit destinations priority without a fixed timer or a reading-position overwrite", () => {
    const controller = createReadingPositionController();
    const { surface, heading } = readingSurface();
    heading.element.scrollIntoView = vi.fn();
    surface.article.dataset.layoutState = "pending";
    const detach = bindReadingPosition(controller, "left", surface);
    controller.prepare("left", surface.payload.path, {
      navigation: "explicit",
      target: { headingId: "chapter" },
    });
    vi.advanceTimersByTime(100);
    expect(heading.element.scrollIntoView).not.toHaveBeenCalled();
    setArticleLayoutState(surface.article, "0", "ready");
    expect(heading.element.scrollIntoView).toHaveBeenCalledOnce();
    expect(controller.isRestoring()).toBe(false);
    detach();
    controller.dispose();
  });
});

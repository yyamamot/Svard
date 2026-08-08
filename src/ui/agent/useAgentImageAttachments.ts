import {
  useEffect,
  type Dispatch,
  type SetStateAction,
  type ClipboardEvent as ReactClipboardEvent,
  type DragEvent as ReactDragEvent,
} from "react";
import type {
  AgentImageAttachment,
  AgentProbe,
  HostAdapter,
} from "../../core/types";
import {
  clearFileCompareDragData,
  codexContextPointerDragStartEvent,
  isCodexContextPointerDragActive,
  readCurrentFileCompareDragData,
  readFileCompareDragData,
  type CodexContextPointerDragStartDetail,
} from "../lib/fileCompareDrag";
import { agentErrorMessage } from "./agentChatState";
import {
  fileAsBase64,
  type AgentInternalDragPreview,
  supportedImagePath,
} from "./agentPanelModel";
import type { AgentSessionController } from "./useAgentSessionController";

export function useAgentImageAttachments({
  host,
  open,
  probe,
  session,
  setInternalDragPreview,
  workspaceRoot,
}: {
  host: HostAdapter;
  open: boolean;
  probe: AgentProbe | null;
  session: AgentSessionController;
  setInternalDragPreview: Dispatch<
    SetStateAction<AgentInternalDragPreview | null>
  >;
  workspaceRoot: string | null;
}) {
  const {
    composerDockRef,
    ensureSessionReady,
    sessionIdRef,
    sessionReadyRef,
    sessionStarting,
    setActionNotice,
    setAddMenuOpen,
    setAttachments,
    setDropActive,
    setFocusFiles,
    setImageErrors,
    setImages,
  } = session;
  function addImageError(displayLabel: string, error: unknown) {
    setImageErrors((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        displayLabel,
        message: agentErrorMessage(error, "This image could not be attached."),
      },
    ]);
  }

  async function stageImageFile(file: File) {
    if (sessionStarting) {
      setActionNotice("Wait for AI Chat to finish starting.");
      return;
    }
    if (!sessionReadyRef.current) {
      await ensureSessionReady(() => stageImageFile(file));
      return;
    }
    try {
      const base64 = await fileAsBase64(file);
      const image = await host.stageAgentImage({
        clientSessionId: sessionIdRef.current,
        source: {
          kind: "clipboardBytes",
          displayLabel: file.name || "Pasted image",
          mediaType: file.type,
          base64,
        },
      });
      setImages((current) => [...current, image]);
    } catch (error) {
      addImageError(file.name || "Pasted image", error);
    }
  }

  async function stageImagePath(path: string) {
    if (sessionStarting) {
      setActionNotice("Wait for AI Chat to finish starting.");
      return;
    }
    if (!sessionReadyRef.current) {
      await ensureSessionReady(() => stageImagePath(path));
      return;
    }
    try {
      const image = await host.stageAgentImage({
        clientSessionId: sessionIdRef.current,
        source: { kind: "selectedPath", path },
      });
      setImages((current) => [...current, image]);
    } catch (error) {
      addImageError(path.split(/[\\/]/u).pop() ?? "image", error);
    }
  }

  async function pickImages() {
    setAddMenuOpen(false);
    if (sessionStarting) {
      setActionNotice("Wait for AI Chat to finish starting.");
      return;
    }
    if (!sessionReadyRef.current) {
      await ensureSessionReady(pickImages);
      return;
    }
    try {
      const selected = await host.pickAgentImages(sessionIdRef.current);
      setImages((current) => [...current, ...selected]);
    } catch (error) {
      addImageError("Selected image", error);
    }
  }

  async function removeImage(image: AgentImageAttachment) {
    setImages((current) =>
      current.filter((item) => item.attachmentId !== image.attachmentId),
    );
    try {
      await host.discardAgentImage({
        clientSessionId: sessionIdRef.current,
        attachmentId: image.attachmentId,
      });
    } catch {
      // Session cleanup remains the final image cleanup boundary.
    }
  }

  async function addDroppedPath(path: string) {
    if (supportedImagePath.test(path)) {
      await stageImagePath(path);
      return;
    }
    const normalizedRoot = workspaceRoot
      ?.replaceAll("\\", "/")
      .replace(/\/+$/u, "");
    const normalizedPath = path.replaceAll("\\", "/");
    const inWorkspace = Boolean(
      normalizedRoot &&
      (normalizedPath === normalizedRoot ||
        normalizedPath.startsWith(`${normalizedRoot}/`)),
    );
    try {
      const resolvedPath = inWorkspace
        ? path
        : await host.resolveDroppedCodexContextPath(path);
      const file = await host.loadCodexContextFile({
        path: resolvedPath,
        workspaceRoot: inWorkspace ? workspaceRoot : null,
        contextId: crypto.randomUUID(),
      });
      if (inWorkspace) {
        setFocusFiles((current) =>
          current.some((item) => item.path === file.path)
            ? current
            : [
                ...current,
                { path: file.path, displayLabel: file.displayLabel },
              ],
        );
      } else {
        setAttachments((current) =>
          current.some((item) => item.sourcePath === file.path)
            ? current
            : [
                ...current,
                {
                  attachmentId: crypto.randomUUID(),
                  displayLabel:
                    file.displayLabel.split(/[\\/]/u).pop() ?? "file",
                  sourcePath: file.path,
                  source: file.source,
                },
              ],
        );
      }
    } catch (error) {
      addImageError(
        path.split(/[\\/]/u).pop() ?? "Dropped file",
        error instanceof Error
          ? error
          : new Error("This file could not be added."),
      );
    }
  }

  function handlePaste(event: ReactClipboardEvent<HTMLTextAreaElement>) {
    const files = [...event.clipboardData.items]
      .filter((item) => item.kind === "file" && item.type.startsWith("image/"))
      .map((item) => item.getAsFile())
      .filter((file): file is File => Boolean(file));
    if (files.length === 0) return;
    event.preventDefault();
    if (!probe?.capabilities.imageInput) {
      addImageError(
        files[0]?.name || "Pasted image",
        new Error("This Codex app-server does not support image input."),
      );
      return;
    }
    void Promise.all(files.map(stageImageFile));
  }

  function handleDrop(event: ReactDragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDropActive(false);
    const imageFiles = [...event.dataTransfer.files].filter((file) =>
      file.type.startsWith("image/"),
    );
    if (imageFiles.length > 0) {
      void Promise.all(imageFiles.map(stageImageFile));
      return;
    }
    const path = readFileCompareDragData(event.dataTransfer);
    if (path) {
      void addDroppedPath(path);
      clearFileCompareDragData();
    }
  }

  useEffect(() => {
    if (!open) {
      setDropActive(false);
      return;
    }
    let disposed = false;
    let handle: { dispose(): void } | null = null;
    void host
      .watchNativeFileDrop((event) => {
        if (disposed) return;
        const bounds = composerDockRef.current?.getBoundingClientRect();
        const inside = Boolean(
          bounds &&
          (!event.position ||
            (event.position.x >= bounds.left &&
              event.position.x <= bounds.right &&
              event.position.y >= bounds.top &&
              event.position.y <= bounds.bottom)),
        );
        if (event.type === "leave") {
          setDropActive(false);
          return;
        }
        if (event.type === "enter" || event.type === "over") {
          setDropActive(inside);
          return;
        }
        setDropActive(false);
        if (event.type !== "drop" || !inside) return;
        const internalPath =
          (event.paths?.length ?? 0) === 0
            ? readCurrentFileCompareDragData()
            : null;
        const paths = internalPath ? [internalPath] : (event.paths ?? []);
        void Promise.all(paths.map(addDroppedPath));
        if (internalPath) clearFileCompareDragData();
      })
      .then((nextHandle) => {
        if (disposed) nextHandle.dispose();
        else handle = nextHandle;
      })
      .catch(() => undefined);
    return () => {
      disposed = true;
      handle?.dispose();
    };
  }, [host, open, workspaceRoot]);

  useEffect(() => {
    if (!open) {
      setInternalDragPreview(null);
      return;
    }
    const insideComposer = (clientX: number, clientY: number) => {
      const bounds = composerDockRef.current?.getBoundingClientRect();
      return Boolean(
        bounds &&
        clientX >= bounds.left &&
        clientX <= bounds.right &&
        clientY >= bounds.top &&
        clientY <= bounds.bottom,
      );
    };
    const updateInternalDragPreview = (
      path: string,
      clientX: number,
      clientY: number,
    ) => {
      setInternalDragPreview({
        clientX,
        clientY,
        inside: insideComposer(clientX, clientY),
        path,
      });
    };
    const start = (event: Event) => {
      const detail = (event as CustomEvent<CodexContextPointerDragStartDetail>)
        .detail;
      const inside = insideComposer(detail.clientX, detail.clientY);
      setDropActive(inside);
      setInternalDragPreview({ ...detail, inside });
    };
    const move = (event: PointerEvent) => {
      if (isCodexContextPointerDragActive()) {
        const inside = insideComposer(event.clientX, event.clientY);
        setDropActive(inside);
        const path = readCurrentFileCompareDragData();
        if (path) {
          updateInternalDragPreview(path, event.clientX, event.clientY);
        }
      }
    };
    const finish = (event: PointerEvent) => {
      if (!isCodexContextPointerDragActive()) return;
      const path = readCurrentFileCompareDragData();
      if (path && insideComposer(event.clientX, event.clientY)) {
        void addDroppedPath(path);
      }
      clearFileCompareDragData();
      setDropActive(false);
      setInternalDragPreview(null);
    };
    const cancel = () => {
      clearFileCompareDragData();
      setDropActive(false);
      setInternalDragPreview(null);
    };
    window.addEventListener(codexContextPointerDragStartEvent, start);
    window.addEventListener("pointermove", move, true);
    window.addEventListener("pointerup", finish, true);
    window.addEventListener("pointercancel", cancel, true);
    return () => {
      window.removeEventListener(codexContextPointerDragStartEvent, start);
      window.removeEventListener("pointermove", move, true);
      window.removeEventListener("pointerup", finish, true);
      window.removeEventListener("pointercancel", cancel, true);
    };
  }, [open, workspaceRoot]);

  return { handleDrop, handlePaste, pickImages, removeImage };
}

import { afterEach, describe, expect, it } from "vitest";

import {
  rootDirectory,
  expandedDirectory,
  rootEntries,
  expandedEntries,
  deferred,
  documentPayload,
  createBootHost,
  mountedBootCleanups,
  mountWorkspaceBoot,
  flushAsyncWork,
  resolveDeferred,
  rejectDeferred,
  resetViewerWindowOpenRequestCacheForTest,
  stateFromDispatchCalls,
  firstContentCallCounts,
  treeStateCallCounts,
  expectFirstContentCommitted,
} from "./helpers/workspaceBootHarness";
import type {
  DirectoryEntry,
  WorkspaceBootHost,
} from "./helpers/workspaceBootHarness";

describe("workspace boot path semantics", () => {
  afterEach(() => {
    for (const cleanup of [...mountedBootCleanups]) {
      cleanup();
    }
    resetViewerWindowOpenRequestCacheForTest();
  });

  it("commits first content before deferred root and expanded hydration settle", async () => {
    const rootList = deferred<DirectoryEntry[]>();
    const expandedList = deferred<DirectoryEntry[]>();
    const payload = documentPayload();
    const host = createBootHost({
      documents: { [payload.path]: payload },
      expandedList: expandedList.promise,
      rootList: rootList.promise,
    });
    const { setters } = mountWorkspaceBoot(host);

    await flushAsyncWork();

    expect(host.listDirectory).toHaveBeenCalledWith(rootDirectory);
    expectFirstContentCommitted(setters, payload);
    const earlyCommitCounts = firstContentCallCounts(setters);

    await resolveDeferred(rootList, rootEntries);

    expect(host.listDirectory).toHaveBeenCalledWith(expandedDirectory);
    expect(setters.setWorkspaceBootComplete).not.toHaveBeenCalledWith(true);
    expect(firstContentCallCounts(setters)).toEqual(earlyCommitCounts);

    await resolveDeferred(expandedList, expandedEntries);

    expect(
      stateFromDispatchCalls<Record<string, DirectoryEntry[]>>(
        setters.setChildrenByDirectory,
        {},
      ),
    ).toEqual({
      [expandedDirectory]: expandedEntries,
      [rootDirectory]: rootEntries,
    });
    expect(
      stateFromDispatchCalls<Record<string, string>>(
        setters.setDirectoryErrors,
        {},
      ),
    ).toEqual({});
    expect(setters.setExpandedDirectories).toHaveBeenLastCalledWith(
      new Set([expandedDirectory]),
    );
    expect(setters.setRootDirectory).toHaveBeenLastCalledWith(rootDirectory);
    expect(setters.setWorkspaceEnvironment).toHaveBeenLastCalledWith({
      locationKind: "local",
      performanceMode: "normal",
    });
    expect(setters.setWorkspaceBootComplete).toHaveBeenLastCalledWith(true);
    expect(firstContentCallCounts(setters)).toEqual(earlyCommitCounts);
  });

  it("drops stale tree hydration when the directory generation advances", async () => {
    const rootList = deferred<DirectoryEntry[]>();
    const expandedList = deferred<DirectoryEntry[]>();
    const generationRef = { current: 7 };
    const payload = documentPayload();
    const host = createBootHost({
      documents: { [payload.path]: payload },
      expandedList: expandedList.promise,
      rootList: rootList.promise,
    });
    const { setters } = mountWorkspaceBoot(host, {
      workspaceTreeGenerationRef: generationRef,
    });

    await flushAsyncWork();
    expectFirstContentCommitted(setters, payload);
    const earlyContentCalls = firstContentCallCounts(setters);
    const treeCallsBeforeCompetingDirectory = treeStateCallCounts(setters);

    generationRef.current += 1;
    await resolveDeferred(rootList, rootEntries);
    expect(host.listDirectory).toHaveBeenCalledWith(expandedDirectory);
    await resolveDeferred(expandedList, expandedEntries);

    expect(treeStateCallCounts(setters)).toEqual(
      treeCallsBeforeCompetingDirectory,
    );
    expect(firstContentCallCounts(setters)).toEqual(earlyContentCalls);
    expect(setters.setWorkspaceBootComplete).toHaveBeenLastCalledWith(true);
    expect(setters.setError).not.toHaveBeenCalled();
  });

  it("commits an empty document state when the initial open fails", async () => {
    const rootList = deferred<DirectoryEntry[]>();
    const host = createBootHost({
      openDocument: async () => {
        throw new Error("Initial document unavailable");
      },
      rootList: rootList.promise,
    });
    const { setters } = mountWorkspaceBoot(host);

    await flushAsyncWork();

    expect(host.openDocument).toHaveBeenCalledTimes(1);
    expect(setters.setConfig).toHaveBeenCalledTimes(1);
    expect(setters.setDocumentPayload).toHaveBeenCalledWith(null);
    expect(setters.setTabs).toHaveBeenCalledTimes(1);
    expect(stateFromDispatchCalls(setters.setTabs, [])).toEqual([]);
    expect(setters.setSplitEnabled).toHaveBeenCalledWith(false);
    expect(setters.setPaneSnapshots).toHaveBeenCalledWith({
      left: expect.objectContaining({ documentPayload: null, id: "left" }),
      right: expect.objectContaining({ documentPayload: null, id: "right" }),
    });
    expect(setters.setIsLoading).not.toHaveBeenCalled();
    expect(setters.setWorkspaceBootComplete).not.toHaveBeenCalledWith(true);
    expect(setters.setError).not.toHaveBeenCalled();

    await resolveDeferred(rootList, rootEntries);

    expect(setters.setIsLoading).toHaveBeenCalledWith(false);
    expect(setters.setWorkspaceBootComplete).toHaveBeenLastCalledWith(true);
    expect(setters.setDocumentPayload).toHaveBeenCalledTimes(1);
    expect(setters.setSplitEnabled).toHaveBeenCalledTimes(1);
    expect(setters.setError).not.toHaveBeenCalled();
  });

  it("keeps booting when applying the window theme rejects", async () => {
    const rootList = deferred<DirectoryEntry[]>();
    const payload = documentPayload();
    const host = createBootHost({
      documents: { [payload.path]: payload },
      rootList: rootList.promise,
      setWindowTheme: async () => {
        throw new Error("Theme unavailable");
      },
    });
    const { setters } = mountWorkspaceBoot(host);

    await flushAsyncWork();

    expect(host.setWindowTheme).toHaveBeenCalledWith("light");
    expectFirstContentCommitted(setters, payload);
    expect(setters.setError).not.toHaveBeenCalled();

    await resolveDeferred(rootList, rootEntries);

    expect(setters.setWorkspaceBootComplete).toHaveBeenLastCalledWith(true);
    expect(setters.setError).not.toHaveBeenCalled();
  });

  it("finishes loading with a global error when canonical path resolution fails", async () => {
    const payload = documentPayload();
    const host = createBootHost({
      documents: { [payload.path]: payload },
      resolveWorkspacePaths: async (input) => {
        if (input.expandedDirectories.length === 0) {
          return {
            expandedDirectories: [],
            initialDirectory: rootDirectory,
          };
        }
        throw new Error("Workspace path resolution failed");
      },
    });
    const { setters } = mountWorkspaceBoot(host);

    await flushAsyncWork();

    expect(host.resolveWorkspacePaths).toHaveBeenCalledTimes(2);
    expect(host.listDirectory).not.toHaveBeenCalled();
    expect(setters.setConfig).toHaveBeenCalledTimes(1);
    expect(setters.setDocumentPayload).toHaveBeenCalledWith(payload);
    expect(stateFromDispatchCalls(setters.setTabs, [])).toEqual([payload]);
    expect(setters.setError).toHaveBeenCalledWith(
      "Workspace path resolution failed",
    );
    expect(setters.setIsLoading).toHaveBeenLastCalledWith(false);
    expect(setters.setWorkspaceBootComplete).toHaveBeenLastCalledWith(true);
    expect(treeStateCallCounts(setters)).toEqual({
      childrenByDirectory: 0,
      directoryErrors: 0,
      expandedDirectories: 0,
      rootDirectory: 0,
      workspaceEnvironment: 0,
    });
  });

  it("ignores a stale canonical path resolution rejection after the directory generation advances", async () => {
    const canonicalResolution =
      deferred<
        Awaited<ReturnType<WorkspaceBootHost["resolveWorkspacePaths"]>>
      >();
    const generationRef = { current: 11 };
    const payload = documentPayload();
    const host = createBootHost({
      documents: { [payload.path]: payload },
      resolveWorkspacePaths: async (input) => {
        if (input.expandedDirectories.length === 0) {
          return {
            expandedDirectories: [],
            initialDirectory: rootDirectory,
          };
        }
        return canonicalResolution.promise;
      },
    });
    const { setters } = mountWorkspaceBoot(host, {
      workspaceTreeGenerationRef: generationRef,
    });

    await flushAsyncWork();

    expect(host.resolveWorkspacePaths).toHaveBeenCalledTimes(2);
    expectFirstContentCommitted(setters, payload);
    const earlyContentCalls = firstContentCallCounts(setters);
    const treeCallsBeforeCompetingDirectory = treeStateCallCounts(setters);

    generationRef.current += 1;
    await rejectDeferred(
      canonicalResolution,
      new Error("Stale workspace path resolution failed"),
    );

    expect(setters.setError).not.toHaveBeenCalled();
    expect(treeStateCallCounts(setters)).toEqual(
      treeCallsBeforeCompetingDirectory,
    );
    expect(firstContentCallCounts(setters)).toEqual(earlyContentCalls);
    expect(setters.setIsLoading).toHaveBeenLastCalledWith(false);
    expect(setters.setWorkspaceBootComplete).toHaveBeenLastCalledWith(true);
  });

  it("converges to child entries when deferred root hydration fails", async () => {
    const rootList = deferred<DirectoryEntry[]>();
    const host = createBootHost({
      rootList: rootList.promise,
    });
    const { setters } = mountWorkspaceBoot(host);

    await flushAsyncWork();
    await rejectDeferred(rootList, new Error("Root directory unavailable"));

    expect(
      stateFromDispatchCalls<Record<string, DirectoryEntry[]>>(
        setters.setChildrenByDirectory,
        {},
      ),
    ).toEqual({
      [expandedDirectory]: expandedEntries,
      [rootDirectory]: [],
    });
    expect(
      stateFromDispatchCalls<Record<string, string>>(
        setters.setDirectoryErrors,
        {},
      ),
    ).toEqual({
      [rootDirectory]: "Root directory unavailable",
    });
    expect(setters.setError).not.toHaveBeenCalled();
    expect(setters.setWorkspaceBootComplete).toHaveBeenLastCalledWith(true);
  });

  it("keeps root entries when deferred expanded child hydration fails", async () => {
    const expandedList = deferred<DirectoryEntry[]>();
    const host = createBootHost({
      expandedList: expandedList.promise,
    });
    const { setters } = mountWorkspaceBoot(host);

    await flushAsyncWork();
    expect(host.listDirectory).toHaveBeenCalledWith(expandedDirectory);
    await rejectDeferred(
      expandedList,
      new Error("Expanded directory unavailable"),
    );

    expect(
      stateFromDispatchCalls<Record<string, DirectoryEntry[]>>(
        setters.setChildrenByDirectory,
        {},
      ),
    ).toEqual({
      [expandedDirectory]: [],
      [rootDirectory]: rootEntries,
    });
    expect(
      stateFromDispatchCalls<Record<string, string>>(
        setters.setDirectoryErrors,
        {},
      ),
    ).toEqual({
      [expandedDirectory]: "Expanded directory unavailable",
    });
    expect(setters.setError).not.toHaveBeenCalled();
    expect(setters.setWorkspaceBootComplete).toHaveBeenLastCalledWith(true);
  });

  it("does not commit deferred tree state after unmount", async () => {
    const expandedList = deferred<DirectoryEntry[]>();
    const payload = documentPayload();
    const host = createBootHost({
      documents: { [payload.path]: payload },
      expandedList: expandedList.promise,
    });
    const { cleanup, setters } = mountWorkspaceBoot(host);

    await flushAsyncWork();
    expect(host.listDirectory).toHaveBeenCalledWith(expandedDirectory);
    expectFirstContentCommitted(setters, payload);
    const callsBeforeUnmount = Object.fromEntries(
      Object.entries(setters).map(([name, setter]) => [
        name,
        setter.mock.calls.length,
      ]),
    );

    cleanup();
    await rejectDeferred(expandedList, new Error("Cancelled tree request"));

    expect(
      Object.fromEntries(
        Object.entries(setters).map(([name, setter]) => [
          name,
          setter.mock.calls.length,
        ]),
      ),
    ).toEqual(callsBeforeUnmount);
    expect(setters.setError).not.toHaveBeenCalled();
    expect(setters.setWorkspaceBootComplete).not.toHaveBeenCalledWith(true);
  });
});

import { act } from "react";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { defaultConfig } from "../../src/core/defaultConfig";
import { useNativeAppMenu } from "../../src/ui/hooks/useNativeAppMenu";
import { createReactRootHarness } from "./helpers/reactHarness";

const native = vi.hoisted(() => ({
  submenu: vi.fn(),
  menu: vi.fn(),
  install: vi.fn(),
  unlisten: vi.fn(),
  focus: vi.fn(),
}));
vi.mock("@tauri-apps/api/menu", () => ({
  Submenu: { new: native.submenu },
  Menu: { new: native.menu },
}));
vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: () => ({ onFocusChanged: native.focus }),
}));

describe("native app menu integration", () => {
  let harness: ReturnType<typeof createReactRootHarness>;
  const dispatch = vi.fn();
  function Harness() {
    useNativeAppMenu({
      config: defaultConfig,
      lastClosedTabs: [],
      recentlyVisitedLocations: [],
      workspaceTabs: [],
      menuStateKey: "test",
      dispatchCommand: dispatch,
      isCommandEnabled: () => true,
      openDocument: vi.fn(),
      openDirectory: vi.fn(),
      openRecentlyVisitedLocation: vi.fn(),
      restoreClosedTabAt: vi.fn(),
    });
    return null;
  }
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(navigator, "platform", "get").mockReturnValue("MacIntel");
    Object.defineProperty(window, "__TAURI_INTERNALS__", {
      configurable: true,
      value: {},
    });
    native.submenu.mockImplementation(async (options) => options);
    native.menu.mockResolvedValue({ setAsAppMenu: native.install });
    native.focus.mockResolvedValue(native.unlisten);
    harness = createReactRootHarness();
  });
  afterEach(() => {
    harness.cleanup();
    Reflect.deleteProperty(window, "__TAURI_INTERNALS__");
    delete window.__SVARD_COMMANDS__;
    vi.restoreAllMocks();
  });
  async function render() {
    harness.render(<Harness />);
    await vi.waitFor(() => expect(native.install).toHaveBeenCalledTimes(1));
  }
  function menu(label: string) {
    return native.submenu.mock.calls.find(
      ([options]) => options.text === label,
    )![0];
  }
  it("maps OS actions to predefined items and keeps quit custom", async () => {
    await render();
    expect(menu("Svard").items).toEqual([
      { item: { About: { name: "Svard" } }, text: "About Svard" },
      { item: "Separator" },
      expect.objectContaining({
        id: "app-menu:preferences.open",
        text: "Settings…",
        accelerator: "CmdOrCtrl+,",
        action: expect.any(Function),
      }),
      { item: "Separator" },
      { item: "Services", text: "Services" },
      { item: "Separator" },
      { item: "Hide", text: "Hide Svard" },
      { item: "HideOthers", text: "Hide Others" },
      { item: "ShowAll", text: "Show All" },
      { item: "Separator" },
      expect.objectContaining({
        id: "app-menu:app.quit",
        accelerator: "CmdOrCtrl+Q",
        action: expect.any(Function),
      }),
    ]);
    expect(
      menu("Help").items.some((item: { item?: unknown }) => item.item),
    ).toBe(false);
  });
  it.each([false, true])(
    "dispatches Settings, New Window and Quit (registry: %s)",
    async (useRegistry) => {
      await render();
      const registryDispatch = vi.fn();
      if (useRegistry)
        window.__SVARD_COMMANDS__ = {
          dispatch: registryDispatch,
        } as unknown as NonNullable<Window["__SVARD_COMMANDS__"]>;
      for (const [label, command] of [
        ["Svard", "preferences.open"],
        ["File", "window.new"],
        ["Svard", "app.quit"],
      ]) {
        await act(async () => {
          menu(label)
            .items.find(
              (item: { id?: string }) => item.id === `app-menu:${command}`,
            )
            .action();
        });
      }
      expect(
        (useRegistry ? registryDispatch : dispatch).mock.calls.map(
          ([id]) => id,
        ),
      ).toEqual(["preferences.open", "window.new", "app.quit"]);
      expect(useRegistry ? dispatch : registryDispatch).not.toHaveBeenCalled();
    },
  );
});

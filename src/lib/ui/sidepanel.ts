import { browser } from 'wxt/browser';

export const SIDEPANEL_FLAG = 'ui:sidePanelOnClick';
const POPUP_PATH = 'popup.html';

interface SidePanelApi {
  setPanelBehavior?(opts: { openPanelOnActionClick: boolean }): Promise<void>;
  open?(opts: { windowId?: number; tabId?: number }): Promise<void>;
}
interface ActionApi {
  setPopup?(opts: { popup: string }): Promise<void> | void;
}

function sidePanel(): SidePanelApi | undefined {
  return (browser as unknown as { sidePanel?: SidePanelApi }).sidePanel;
}
function action(): ActionApi | undefined {
  return (browser as unknown as { action?: ActionApi }).action;
}

export function sidePanelSupported(): boolean {
  return typeof sidePanel()?.open === 'function';
}

// must run inside a user gesture
export async function openSidePanel(): Promise<boolean> {
  const sp = sidePanel();
  if (!sp?.open) return false;
  try {
    const win = await browser.windows.getCurrent();
    if (win.id == null) return false;
    await sp.open({ windowId: win.id });
    return true;
  } catch {
    return false;
  }
}

// Opens the side panel and closes the popup it replaces — used by the popup/settings UIs.
export function openSidePanelAndClosePopup(): void {
  void openSidePanel().then((ok) => {
    if (ok) window.close();
  });
}

export async function applySidePanelBehavior(on: boolean): Promise<void> {
  try {
    await sidePanel()?.setPanelBehavior?.({ openPanelOnActionClick: on });
    await action()?.setPopup?.({ popup: on ? '' : POPUP_PATH });
  } catch {
    // unsupported — stay on the popup
  }
}

export function initSidePanel(): void {
  void getSidePanelOnClick().then(applySidePanelBehavior);
  browser.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && SIDEPANEL_FLAG in changes) {
      void applySidePanelBehavior(changes[SIDEPANEL_FLAG]?.newValue === true);
    }
  });
}

export async function getSidePanelOnClick(): Promise<boolean> {
  const r = await browser.storage.local.get(SIDEPANEL_FLAG);
  return r[SIDEPANEL_FLAG] === true;
}

export async function setSidePanelOnClick(on: boolean): Promise<void> {
  await browser.storage.local.set({ [SIDEPANEL_FLAG]: on });
}

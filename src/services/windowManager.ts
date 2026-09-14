

import {
  getCurrentWindow,
  LogicalSize,
  PhysicalPosition,
} from "@tauri-apps/api/window";
import { invoke } from "@tauri-apps/api/core";


async function ensureTaskbarVisible(): Promise<void> {
  try {
    await invoke("ensure_taskbar_visible");
  } catch {

  }
}

export const ORB_SIZE = { width: 80, height: 80 };
export const ORB_MENU_SIZE = { width: 280, height: 80 };
export const APP_SIZE = { width: 460, height: 480 };
export const APP_MIN_SIZE = { width: 360, height: 400 };

let savedOrbPosition: PhysicalPosition | null = null;


export async function switchToOrbMode(): Promise<void> {
  try {
    const win = getCurrentWindow();

    await win.hide();

    await win.setFullscreen(false);
    await win.setResizable(false);
    await win.setDecorations(false);
    await win.setAlwaysOnTop(true);
    await win.setSkipTaskbar(false);
    await win.setShadow(false);
    await win.setSize(new LogicalSize(ORB_SIZE.width, ORB_SIZE.height));

    if (savedOrbPosition) {
      await win.setPosition(savedOrbPosition);
      savedOrbPosition = null;
    }

    await win.show();
    await ensureTaskbarVisible();
    await win.setFocus();
  }  catch{
  }
}

export async function switchToOrbMenuMode(): Promise<void> {
  try {
    const win = getCurrentWindow();
    const pos = await win.outerPosition();
    const factor = await win.scaleFactor();
    const deltaX = Math.round((ORB_MENU_SIZE.width - ORB_SIZE.width) * factor);

    const newX = pos.x >= deltaX ? pos.x - deltaX : 0;
    await win.setPosition(new PhysicalPosition(newX, pos.y));
    await win.setSize(
      new LogicalSize(ORB_MENU_SIZE.width, ORB_MENU_SIZE.height)
    );
  } catch {

  }
}


export async function switchFromOrbMenuToOrbMode(): Promise<void> {
  try {
    const win = getCurrentWindow();
    const pos = await win.outerPosition();
    const factor = await win.scaleFactor();
    const deltaX = Math.round((ORB_MENU_SIZE.width - ORB_SIZE.width) * factor);


    await win.setSize(new LogicalSize(ORB_SIZE.width, ORB_SIZE.height));
    await win.setPosition(new PhysicalPosition(pos.x + deltaX, pos.y));
  } catch {

  }
}

export async function saveCurrentOrbPosition(): Promise<void> {
  try {
    const win = getCurrentWindow();
    const currentSize = await win.innerSize();
    if (currentSize.width <= 300) {
      savedOrbPosition = await win.outerPosition();
    }
  } catch {}
}

export async function switchToCropMode(): Promise<void> {

  try {
    await saveCurrentOrbPosition();
    const win = getCurrentWindow();
    await win.hide();
  } catch {}
}

export async function switchToAppMode(): Promise<void> {
  try {
    const win = getCurrentWindow();

    await win.hide();

    await Promise.all([
      win.setFullscreen(false),
      win.setSize(new LogicalSize(APP_SIZE.width, APP_SIZE.height)),
      win.setMinSize(
        new LogicalSize(APP_MIN_SIZE.width, APP_MIN_SIZE.height)
      ),
      win.setAlwaysOnTop(false),
      win.setResizable(true),
      win.setSkipTaskbar(false),
      win.setShadow(true),
      win.center(),
    ]);

    await win.show();
    await ensureTaskbarVisible();
    await win.setFocus();
  } catch (err) {
    console.error("[CROP_DEBUG] Error in switchToAppMode:", err);
  }
}

export async function startOrbDrag(): Promise<void> {
  try {
    const win = getCurrentWindow();
    await win.startDragging();
  } catch {

  }
}

export async function setupCloseInterceptor(
  onReturnToOrb: () => Promise<void> | void
): Promise<() => void> {
  try {
    const win = getCurrentWindow();
    const unlisten = await win.onCloseRequested(async (event) => {
      event.preventDefault();
      await onReturnToOrb();
    });
    return unlisten;
  } catch {
    return () => {};
  }
}

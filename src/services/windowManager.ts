/**
 * windowManager.ts
 *
 * Manages the single Tauri window's transition between:
 * - ORB MODE (compact 80x80 floating launcher)
 * - ORB MENU MODE (expanded 280x80 transparent floating action menu)
 * - CROP MODE (fullscreen transparent overlay matching monitor size)
 * - APP MODE (full 460x480 LENS application UI)
 */

import {
  getCurrentWindow,
  LogicalSize,
  PhysicalPosition,
} from "@tauri-apps/api/window";
import { invoke } from "@tauri-apps/api/core";

/**
 * Forces the Windows taskbar button to stay present.
 * See `ensure_taskbar_visible` in src-tauri/src/lib.rs for why this is
 * needed in addition to `setSkipTaskbar(false)`. No-op on non-Windows /
 * non-Tauri (browser dev) environments.
 */
async function ensureTaskbarVisible(): Promise<void> {
  try {
    await invoke("ensure_taskbar_visible");
  } catch {
    // Non-Windows or non-Tauri browser dev fallback
  }
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

export const ORB_SIZE = { width: 80, height: 80 };
export const ORB_MENU_SIZE = { width: 280, height: 80 };
export const APP_SIZE = { width: 460, height: 480 };
export const APP_MIN_SIZE = { width: 360, height: 400 };

/* ------------------------------------------------------------------ */
/*  Internal state                                                     */
/* ------------------------------------------------------------------ */

/** Saved orb position before entering crop mode, so we can restore it. */
let savedOrbPosition: PhysicalPosition | null = null;

/* ------------------------------------------------------------------ */
/*  Switch to ORB MODE (Closed launcher)                               */
/* ------------------------------------------------------------------ */

/**
 * Transitions the native Tauri window into orb mode:
 * small, frameless, transparent, always-on-top, visible in the taskbar.
 */
export async function switchToOrbMode(): Promise<void> {
  try {
    const win = getCurrentWindow();

    // Hide before resize to prevent black flash
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
  } catch {
    // Non-Tauri browser dev fallback
  }
}

/* ------------------------------------------------------------------ */
/*  Switch to ORB MENU MODE (Expanded slide-out action menu)           */
/* ------------------------------------------------------------------ */

/**
 * Expands the transparent native window horizontally to accommodate
 * the slide-out Crop & Open LENS action menu without clipping.
 */
export async function switchToOrbMenuMode(): Promise<void> {
  try {
    const win = getCurrentWindow();
    const pos = await win.outerPosition();
    const factor = await win.scaleFactor();
    const deltaX = Math.round((ORB_MENU_SIZE.width - ORB_SIZE.width) * factor);

    // Shift window left so the orb button remains anchored in place
    const newX = pos.x >= deltaX ? pos.x - deltaX : 0;
    await win.setPosition(new PhysicalPosition(newX, pos.y));
    await win.setSize(
      new LogicalSize(ORB_MENU_SIZE.width, ORB_MENU_SIZE.height)
    );
  } catch {
    // Non-Tauri browser dev fallback
  }
}

/* ------------------------------------------------------------------ */
/*  Collapse ORB MENU back to ORB MODE                                 */
/* ------------------------------------------------------------------ */

/**
 * Collapses the action menu back to the compact 80x80 orb launcher.
 */
export async function switchFromOrbMenuToOrbMode(): Promise<void> {
  try {
    const win = getCurrentWindow();
    const pos = await win.outerPosition();
    const factor = await win.scaleFactor();
    const deltaX = Math.round((ORB_MENU_SIZE.width - ORB_SIZE.width) * factor);

    // Shift window back right so orb returns to original anchor position
    await win.setSize(new LogicalSize(ORB_SIZE.width, ORB_SIZE.height));
    await win.setPosition(new PhysicalPosition(pos.x + deltaX, pos.y));
  } catch {
    // Non-Tauri browser dev fallback
  }
}

/* ------------------------------------------------------------------ */
/*  Switch to CROP MODE (Fullscreen transparent overlay)               */
/* ------------------------------------------------------------------ */

/**
 * Transitions the window to cover the entire current monitor
 * using explicit physical pixel positioning rather than native fullscreen.
 *
 * WHY NOT setFullscreen(true)?
 * On Windows, setFullscreen(true) triggers a mode switch that temporarily
 * paints the window opaque black before the webview finishes repainting.
 * Instead we manually size the window to match the monitor's physical
 * dimensions and position it at the monitor's top-left corner.
 * Since the window already has transparent: true in tauri.conf.json,
 * this produces a seamless fullscreen transparent overlay with no black flash.
 */
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
  // Obsolete for main window in Tauri multi-window mode,
  // but kept for compatibility or inline browser mode.
  try {
    await saveCurrentOrbPosition();
    const win = getCurrentWindow();
    await win.hide();
  } catch {}
}

/* ------------------------------------------------------------------ */
/*  Switch to APP MODE (Full LENS UI)                                  */
/* ------------------------------------------------------------------ */

/**
 * Transitions the native Tauri window into full application mode:
 * normal size, decorated, resizable, on taskbar.
 */
export async function switchToAppMode(): Promise<void> {
  try {
    const win = getCurrentWindow();

    // Hide before resize to prevent visual flash during window size change
    await win.hide();

    // Batch window configuration IPC calls in parallel to eliminate IPC latency
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

/* ------------------------------------------------------------------ */
/*  Orb drag                                                           */
/* ------------------------------------------------------------------ */

/**
 * Initiates native window dragging so the orb can be
 * repositioned anywhere on the desktop.
 */
export async function startOrbDrag(): Promise<void> {
  try {
    const win = getCurrentWindow();
    await win.startDragging();
  } catch {
    // Non-Tauri browser dev fallback
  }
}

/* ------------------------------------------------------------------ */
/*  Window Close Interceptor                                           */
/* ------------------------------------------------------------------ */

/**
 * Registers an interceptor for the window close requested event
 * to return to orb mode instead of destroying the application.
 */
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
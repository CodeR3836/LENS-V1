import { useState, useCallback, useEffect, useRef, type FC, type PointerEvent } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Check, RotateCcw, X } from "lucide-react";
import "./CropOverlay.css";

interface CropOverlayProps {
  onComplete?: (rect: { x: number; y: number; width: number; height: number }) => void;
  onCancel?: () => void;
}

interface SelectionRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

type DragMode = "draw" | "move" | "nw" | "ne" | "se" | "sw" | "n" | "e" | "s" | "w" | null;

export const CropOverlay: FC<CropOverlayProps> = ({ onComplete, onCancel }) => {
  const [selection, setSelection] = useState<SelectionRect | null>(null);
  const [dragMode, setDragMode] = useState<DragMode>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  
  // Drag start state
  const dragStartRef = useRef({ x: 0, y: 0 });
  const initialSelectionRef = useRef<SelectionRect | null>(null);

  // Keyboard controls: Escape to cancel, Enter to capture
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleCancel();
      } else if (e.key === "Enter" && selection && !isCapturing) {
        handleCapture();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selection, isCapturing]);

  const handleCapture = useCallback(async () => {
    if (!selection || selection.width < 5 || selection.height < 5 || isCapturing) return;
    const tStart = performance.now();
    console.log(`[CROP PERF] START t=${tStart.toFixed(2)}ms`);
    console.log(`[CROP PERF] SELECTION_DONE t=${tStart.toFixed(2)}ms`);
    console.log(`[CROP PERF] IMAGE_CAPTURE_START t=${performance.now().toFixed(2)}ms`);
    setIsCapturing(true);
    try {
      await invoke("capture_screen_image", {
        rect: selection,
      });
    } catch (err) {
      console.error("[CROP] capture_screen_image error:", err);
      setIsCapturing(false);
      try {
        await invoke("cancel_crop");
      } catch {}
      if (onComplete) {
        onComplete(selection);
      }
    }
  }, [selection, isCapturing, onComplete]);

  const handleCancel = useCallback(async () => {
    try {
      await invoke("cancel_crop");
    } catch {
      // Fallback for browser / non-Tauri dev mode
      if (onCancel) {
        onCancel();
      }
    }
  }, [onCancel]);

  const handleReset = useCallback(() => {
    setSelection(null);
    setDragMode(null);
  }, []);

  // Pointer Down handler
  const handlePointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || isCapturing) return; // Only left click and when not capturing

    const target = e.target as HTMLElement;
    // Ignore pointer events that land on or inside toolbar buttons
    if (target.closest(".crop-toolbar") || target.closest("button")) {
      return;
    }

    e.currentTarget.setPointerCapture(e.pointerId);

    const clientX = e.clientX;
    const clientY = e.clientY;
    const handleType = target.getAttribute("data-handle") as DragMode;

    if (handleType) {
      // Start resizing or moving
      setDragMode(handleType);
      dragStartRef.current = { x: clientX, y: clientY };
      initialSelectionRef.current = selection ? { ...selection } : null;
    } else {
      // Clicking outside selection / start drawing a new one
      setDragMode("draw");
      dragStartRef.current = { x: clientX, y: clientY };
      initialSelectionRef.current = null;
      setSelection({ x: clientX, y: clientY, width: 0, height: 0 });
    }
  };

  // Pointer Move handler
  const handlePointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!dragMode) return;

    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    const init = initialSelectionRef.current;

    if (dragMode === "draw") {
      const x = Math.min(dragStartRef.current.x, e.clientX);
      const y = Math.min(dragStartRef.current.y, e.clientY);
      const width = Math.abs(e.clientX - dragStartRef.current.x);
      const height = Math.abs(e.clientY - dragStartRef.current.y);
      setSelection({ x, y, width, height });
    } else if (dragMode === "move" && init) {
      const x = Math.max(0, Math.min(window.innerWidth - init.width, init.x + dx));
      const y = Math.max(0, Math.min(window.innerHeight - init.height, init.y + dy));
      setSelection({ ...init, x, y });
    } else if (init) {
      // Resize modes
      let { x, y, width, height } = init;
      const minSize = 20;

      // Vertical resize
      if (dragMode.includes("n")) {
        const newY = Math.min(init.y + dy, init.y + init.height - minSize);
        height = init.height - (newY - init.y);
        y = newY;
      } else if (dragMode.includes("s")) {
        height = Math.max(minSize, init.height + dy);
      }

      // Horizontal resize
      if (dragMode.includes("w")) {
        const newX = Math.min(init.x + dx, init.x + init.width - minSize);
        width = init.width - (newX - init.x);
        x = newX;
      } else if (dragMode.includes("e")) {
        width = Math.max(minSize, init.width + dx);
      }

      setSelection({ x, y, width, height });
    }
  };

  // Pointer Up handler
  const handlePointerUp = (e: PointerEvent<HTMLDivElement>) => {
    if (!dragMode) return;
    e.currentTarget.releasePointerCapture(e.pointerId);
    setDragMode(null);

    // Require a minimum size to validate selection
    if (selection && (selection.width < 10 || selection.height < 10)) {
      setSelection(null);
    }
  };

  // Calculate coordinates for SVG mask and selection box
  const hasSelection = selection && selection.width > 0 && selection.height > 0;
  const { x = 0, y = 0, width = 0, height = 0 } = selection || {};

  // Dynamic toolbar positioning
  const getToolbarStyle = () => {
    if (!selection) return {};
    const toolbarOffset = 12;
    const toolbarHeight = 44;
    
    let top = y + height + toolbarOffset;
    // If it goes off the bottom of the screen, place it above selection
    if (top + toolbarHeight > window.innerHeight) {
      top = y - toolbarHeight - toolbarOffset;
    }
    // Clamp to ensure it doesn't go off-screen top
    top = Math.max(12, top);

    return {
      left: `${x + width / 2}px`,
      top: `${top}px`,
    };
  };

  return (
    <div
      className="crop-overlay"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* SVG dim layer with mask to cut out selection */}
      <svg className="crop-overlay__svg-dim">
        <defs>
          <mask id="crop-mask">
            {/* White fills the screen (masking color: dim on) */}
            <rect width="100%" height="100%" fill="white" />
            {/* Black cuts holes (masking color: clear selection) */}
            {hasSelection && (
              <rect
                x={x}
                y={y}
                width={width}
                height={height}
                rx={10}
                ry={10}
                fill="black"
              />
            )}
          </mask>
        </defs>
        {/* Fill screen with dim color and apply the cutout mask */}
        <rect
          width="100%"
          height="100%"
          fill="rgba(8, 8, 12, 0.65)"
          mask="url(#crop-mask)"
        />
      </svg>

      {/* Render selection rectangle and handles */}
      {hasSelection && (
        <div
          className={`crop-overlay__selection ${dragMode ? "crop-overlay__selection--active" : ""}`}
          style={{
            left: `${x}px`,
            top: `${y}px`,
            width: `${width}px`,
            height: `${height}px`,
          }}
        >
          {/* Centered drag-to-move handle */}
          <div className="crop-handle-move" data-handle="move" />

          {/* Size Info Badge */}
          <div className="crop-size-badge">
            {Math.round(width)} × {Math.round(height)}
          </div>

          {/* Resize Corner Handles */}
          <div className="crop-handle crop-handle-nw" data-handle="nw" />
          <div className="crop-handle crop-handle-ne" data-handle="ne" />
          <div className="crop-handle crop-handle-se" data-handle="se" />
          <div className="crop-handle crop-handle-sw" data-handle="sw" />

          {/* Resize Edge Handles */}
          <div className="crop-handle crop-handle-n" data-handle="n" />
          <div className="crop-handle crop-handle-e" data-handle="e" />
          <div className="crop-handle crop-handle-s" data-handle="s" />
          <div className="crop-handle crop-handle-w" data-handle="w" />
        </div>
      )}

      {/* Floating Action Toolbar */}
      {hasSelection && (
        <div
          className="crop-toolbar"
          style={getToolbarStyle()}
          onPointerDown={(e) => e.stopPropagation()}
          onPointerUp={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            className="crop-toolbar-btn crop-toolbar-btn--confirm"
            onClick={handleCapture}
            title="Capture Region (Enter)"
          >
            <Check size={16} />
            <span>Capture</span>
          </button>
          <div className="crop-toolbar-separator" />
          <button
            type="button"
            className="crop-toolbar-btn crop-toolbar-btn--reset"
            onClick={handleReset}
            title="Reset selection"
          >
            <RotateCcw size={16} />
          </button>
          <button
            type="button"
            className="crop-toolbar-btn crop-toolbar-btn--cancel"
            onClick={handleCancel}
            title="Cancel (Esc)"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Helper guide overlay when there is no selection */}
      {!hasSelection && !dragMode && (
        <div className="crop-hint-container">
          <div className="crop-hint-badge">LENS Crop Mode</div>
          <div className="crop-hint-text">Click and drag to select a region of your screen</div>
          <div className="crop-hint-sub">Press Esc to cancel</div>
        </div>
      )}
    </div>
  );
};

export default CropOverlay;

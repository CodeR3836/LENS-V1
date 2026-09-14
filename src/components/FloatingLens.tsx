import {
  useState,
  useCallback,
  useRef,
  useEffect,
  type PointerEvent,
} from "react";
import { Sparkles, Scissors } from "lucide-react";
import {
  startOrbDrag,
  switchToOrbMenuMode,
  switchFromOrbMenuToOrbMode,
} from "../services/windowManager";

type FloatingLensProps = {
  isOrbMode: boolean;
  onOpenLens: () => void;
  onCrop: () => void;
};

export function FloatingLens({
  isOrbMode,
  onOpenLens,
  onCrop,
}: FloatingLensProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragThreshold = 4;

  const toggleMenu = useCallback(async () => {
    if (!isMenuOpen) {
      await switchToOrbMenuMode();
      setIsMenuOpen(true);
    } else {
      setIsMenuOpen(false);
      await switchFromOrbMenuToOrbMode();
    }
  }, [isMenuOpen]);

  const handleOpenLensClick = useCallback(() => {
    setIsMenuOpen(false);
    onOpenLens();
  }, [onOpenLens]);

  const handleCropClick = useCallback(() => {
    setIsMenuOpen(false);
    onCrop();
  }, [onCrop]);

  useEffect(() => {
    if (!isMenuOpen) return;

    const handlePointerDownOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsMenuOpen(false);
        switchFromOrbMenuToOrbMode().catch(() => {});
      }
    };

    window.addEventListener("mousedown", handlePointerDownOutside);
    return () => {
      window.removeEventListener("mousedown", handlePointerDownOutside);
    };
  }, [isMenuOpen]);

  const handleLauncherPointerDown = useCallback(
    (e: PointerEvent<HTMLButtonElement>) => {
      if (!isOrbMode) return;

      const startX = e.clientX;
      const startY = e.clientY;
      let dragStarted = false;

      const onMove = (moveEvent: globalThis.PointerEvent) => {
        const dx = moveEvent.clientX - startX;
        const dy = moveEvent.clientY - startY;

        if (!dragStarted && Math.sqrt(dx * dx + dy * dy) > dragThreshold) {
          dragStarted = true;
          setIsDragging(true);
          startOrbDrag().catch(() => {});
          cleanup();
        }
      };

      const onUp = () => {
        if (!dragStarted) {
          toggleMenu();
        }

        setIsDragging(false);
        cleanup();
      };

      const cleanup = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
      };

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    [isOrbMode, toggleMenu]
  );

  return (
    <div
      ref={containerRef}
      className={`floating-lens ${isOrbMode ? "floating-lens--orb-mode" : ""} ${
        isMenuOpen ? "is-open" : ""
      }`}
    >
      <div className="floating-lens__menu" role="menu">
        <button
          type="button"
          role="menuitem"
          className="floating-lens__option"
          onClick={handleCropClick}
        >
          <span className="floating-lens__option-icon">
            <Scissors className="icon--sm" />
          </span>
          <span>Crop</span>
        </button>

        <button
          type="button"
          role="menuitem"
          className="floating-lens__option"
          onClick={handleOpenLensClick}
        >
          <span className="floating-lens__option-icon">
            <Sparkles className="icon--sm" />
          </span>
          <span>Open LENS</span>
        </button>
      </div>

      <button
        type="button"
        className="floating-lens__launcher"
        aria-label="Toggle LENS actions"
        aria-expanded={isMenuOpen}
        onPointerDown={handleLauncherPointerDown}
        style={isDragging ? { cursor: "grabbing" } : undefined}
      >
        <Sparkles className="icon" />
      </button>
    </div>
  );
}

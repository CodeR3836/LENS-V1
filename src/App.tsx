

import {
  useState,
  useEffect,
  useRef,
  useCallback,
  type FC,
  type ReactNode,
  type ChangeEvent,
  type KeyboardEvent,
  type RefObject,
} from "react";
import "./App.css";
import { skillRegistry } from "./skills/SkillRegistry";
import type { SkillId, SkillPayload, RewriteMode, AskAIMode } from "./skills/types";
import { SettingsModal } from "./components/SettingsModal";
import { FloatingLens } from "./components/FloatingLens";
import { GrammarResult } from "./components/grammar/GrammarResult";
import {
  switchToAppMode,
  switchToOrbMode,
  setupCloseInterceptor,
  startOrbDrag,
} from "./services/windowManager";
import { cropStore } from "./services/cropStore";
import {
  startScreenCrop,
  executeVisionOCR,
  type CapturedImagePayload,
} from "./services/cropService";
import { listen } from "@tauri-apps/api/event";

/* ============================================================
   TYPES
   ============================================================ */

type ActionId =
  | "rewrite"
  | "summarize"
  | "translate"
  | "ask"
  | "grammar"
  | "simplify"
  | "tone";

type ViewState =
  | "orb"
  | "home"
  | "translate"
  | "rewrite"
  | "ask"
  | "action-selected"
  | "processing"
  | "result"
  | "error";

interface IconProps {
  className?: string;
}

interface ActionDef {
  id: ActionId;
  label: string;
  description: string;
  verb: string;
  gerund: string;
  shortcut?: string;
  tier: "primary" | "secondary";
  icon: FC<IconProps>;
  placeholder: string;
}

interface Exchange {
  id: string;
  actionId: ActionId;
  actionLabel: string;
  query: string;
  response: string;
}

interface ToastState {
  id: number;
  message: string;
  tone: "default" | "success";
}

/* ============================================================
   ICONS — single consistent stroke-based system
   ============================================================ */

const strokeProps = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

const IconPencil: FC<IconProps> = ({ className }) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
    <path
      {...strokeProps}
      d="M4 20.5 4.9 16.6 15.1 6.4a2 2 0 0 1 2.8 0l1.7 1.7a2 2 0 0 1 0 2.8L9.4 21.1 4 20.5Z"
    />
    <path {...strokeProps} d="m13.5 8 2.5 2.5" />
  </svg>
);

const IconLines: FC<IconProps> = ({ className }) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
    <path {...strokeProps} d="M4.5 6.5h15" />
    <path {...strokeProps} d="M4.5 12h11" />
    <path {...strokeProps} d="M4.5 17.5h7" />
  </svg>
);

const IconGlobe: FC<IconProps> = ({ className }) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
    <circle cx="12" cy="12" r="8" {...strokeProps} />
    <path {...strokeProps} d="M4 12h16" />
    <path
      {...strokeProps}
      d="M12 4c2.2 2.2 3.3 5 3.3 8s-1.1 5.8-3.3 8c-2.2-2.2-3.3-5-3.3-8S9.8 6.2 12 4Z"
    />
  </svg>
);

const IconBolt: FC<IconProps> = ({ className }) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
    <path
      {...strokeProps}
      d="M12.5 3 5 13.2h5.2L10.8 21 19 10.4h-5.4L12.5 3Z"
    />
  </svg>
);

const IconArrowUpRight: FC<IconProps> = ({ className }) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
    <path {...strokeProps} d="M7 17 17 7" />
    <path {...strokeProps} d="M9 7h8v8" />
  </svg>
);

const IconArrowLeft: FC<IconProps> = ({ className }) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
    <path {...strokeProps} d="M19 12H5" />
    <path {...strokeProps} d="m11 6-6 6 6 6" />
  </svg>
);

const IconCopy: FC<IconProps> = ({ className }) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
    <rect
      x="8.5"
      y="8.5"
      width="11"
      height="11"
      rx="2.2"
      {...strokeProps}
    />
    <path
      {...strokeProps}
      d="M15.5 8.5V6.7A2.2 2.2 0 0 0 13.3 4.5H6.7A2.2 2.2 0 0 0 4.5 6.7v6.6a2.2 2.2 0 0 0 2.2 2.2H8.5"
    />
  </svg>
);

const IconCheck: FC<IconProps> = ({ className }) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
    <path {...strokeProps} d="m5 12.5 4.5 4.5L19 7" />
  </svg>
);

const IconInsert: FC<IconProps> = ({ className }) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
    <path {...strokeProps} d="M12 4v11" />
    <path {...strokeProps} d="m7.5 11 4.5 4.5L16.5 11" />
    <path {...strokeProps} d="M5 19.5h14" />
  </svg>
);

const IconRetry: FC<IconProps> = ({ className }) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
    <path {...strokeProps} d="M4.5 12a7.5 7.5 0 1 1 2.4 5.5" />
    <path {...strokeProps} d="M4.5 17.5v-4h4" />
  </svg>
);

const IconX: FC<IconProps> = ({ className }) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
    <path {...strokeProps} d="m6 6 12 12" />
    <path {...strokeProps} d="m18 6-12 12" />
  </svg>
);

const IconMinus: FC<IconProps> = ({ className }) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
    <path {...strokeProps} d="M5 12h14" />
  </svg>
);

const IconDots: FC<IconProps> = ({ className }) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
    <circle
      cx="6"
      cy="12"
      r="1.15"
      fill="currentColor"
      stroke="none"
    />
    <circle
      cx="12"
      cy="12"
      r="1.15"
      fill="currentColor"
      stroke="none"
    />
    <circle
      cx="18"
      cy="12"
      r="1.15"
      fill="currentColor"
      stroke="none"
    />
  </svg>
);

const IconClipboard: FC<IconProps> = ({ className }) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
    <rect x="6" y="5.5" width="12" height="15" rx="2" {...strokeProps} />
    <path
      {...strokeProps}
      d="M9.5 5.5V5a2 2 0 0 1 2-2h1a2 2 0 0 1 2 2v.5"
    />
  </svg>
);

const IconSend: FC<IconProps> = ({ className }) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
    <path {...strokeProps} d="M4.5 12 19 5l-4.5 15-3-6-7-2Z" />
  </svg>
);

const IconChevronDown: FC<IconProps> = ({ className }) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
    <path {...strokeProps} d="m6 9 6 6 6-6" />
  </svg>
);

const IconAlert: FC<IconProps> = ({ className }) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
    <path {...strokeProps} d="M12 4.5 21 19.5H3L12 4.5Z" />
    <path {...strokeProps} d="M12 10v4" />
    <path {...strokeProps} d="M12 16.7v.01" />
  </svg>
);

const IconScissors: FC<IconProps> = ({ className }) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
    <circle cx="6" cy="6" r="3" {...strokeProps} />
    <circle cx="6" cy="18" r="3" {...strokeProps} />
    <path {...strokeProps} d="M20 4 8.12 15.88" />
    <path {...strokeProps} d="M14.47 14.47 20 20" />
    <path {...strokeProps} d="M8.12 8.12 12 12" />
  </svg>
);

/* ============================================================
   LOGO
   ============================================================ */

const Logo: FC<{ pulsing?: boolean }> = ({ pulsing }) => (
  <span
    className={`logo-mark${pulsing ? " logo-mark--active" : ""}`}
    aria-hidden="true"
  >
    <svg viewBox="0 0 32 32" className="logo-mark__svg">
      <defs>
        <linearGradient
          id="lensGradient"
          x1="0"
          y1="0"
          x2="32"
          y2="32"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="#C084FC" />
          <stop offset="1" stopColor="#8B5CF6" />
        </linearGradient>
      </defs>

      <circle
        cx="16"
        cy="16"
        r="10.5"
        stroke="url(#lensGradient)"
        strokeWidth="1.6"
        fill="none"
      />

      <path
        d="M16 8.4 20 14 16 23.6 12 14 16 8.4Z"
        stroke="url(#lensGradient)"
        strokeWidth="1.4"
        strokeLinejoin="round"
        fill="rgba(139,92,246,0.14)"
      />

      <circle cx="16" cy="16" r="1.6" fill="#E9D5FF" />
    </svg>
  </span>
);

/* ============================================================
   ACTION DATA
   ============================================================ */

const ACTIONS: ActionDef[] = [
  {
    id: "translate",
    label: "Translate",
    description: "Switch languages",
    verb: "Translate",
    gerund: "Translating",
    shortcut: "1",
    tier: "primary",
    icon: IconGlobe,
    placeholder: "Paste the text you'd like translated…",
  },
  {
    id: "rewrite",
    label: "Rewrite",
    description: "Improve the phrasing",
    verb: "Rewrite",
    gerund: "Rewriting",
    shortcut: "2",
    tier: "primary",
    icon: IconPencil,
    placeholder: "Paste the text you'd like rewritten…",
  },
  {
    id: "summarize",
    label: "Summarize",
    description: "Get the key points",
    verb: "Summarize",
    gerund: "Summarizing",
    shortcut: "3",
    tier: "primary",
    icon: IconLines,
    placeholder: "Paste the text you'd like summarized…",
  },
  {
    id: "ask",
    label: "Ask AI",
    description: "Ask anything about it",
    verb: "Ask",
    gerund: "Thinking",
    shortcut: "4",
    tier: "primary",
    icon: IconBolt,
    placeholder: "Paste text or type a question…",
  },
];

const PRIMARY_ACTIONS = ACTIONS.filter(
  (action) => action.tier === "primary"
);

const DEFAULT_ACTION =
  ACTIONS.find((action) => action.id === "ask")!;

/* ============================================================
   STATUS
   ============================================================ */

const StatusIndicator: FC<{ view: ViewState }> = ({ view }) => {
  const label =
    view === "processing"
      ? "Working"
      : view === "error"
        ? "Attention"
        : "Ready";

  return (
    <span className={`status status--${label.toLowerCase()}`}>
      <span className="status__dot" aria-hidden="true" />
      {label}
    </span>
  );
};

/* ============================================================
   HEADER MENU
   ============================================================ */

const HeaderMenu: FC<{
  onClose: () => void;
  onAction: (label: string) => void;
}> = ({ onClose, onAction }) => {
  const items = ["Settings", "About LENS", "Floating mode"];

  return (
    <div className="menu" role="menu">
      {items.map((item) => (
        <button
          key={item}
          type="button"
          role="menuitem"
          className="menu__item"
          onClick={() => {
            onAction(item);
            onClose();
          }}
        >
          {item}
        </button>
      ))}
    </div>
  );
};

/* ============================================================
   HEADER
   ============================================================ */

const Header: FC<{
  view: ViewState;
  onBack?: () => void;
  onOpenSettings: () => void;
  onReturnToOrb?: () => void;
  onToast: (message: string) => void;
}> = ({ view, onBack, onOpenSettings, onReturnToOrb, onToast }) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;

    const handleClick = (e: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node)
      ) {
        setMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClick);

    return () => {
      document.removeEventListener("mousedown", handleClick);
    };
  }, [menuOpen]);

  const handleMenuAction = (label: string) => {
    if (label === "Settings") {
      onOpenSettings();
    } else if (label === "Floating mode" && onReturnToOrb) {
      onReturnToOrb();
    } else {
      onToast(`${label} — coming soon`);
    }
  };

  const handleHeaderMouseDown = (e: React.MouseEvent<HTMLElement>) => {
    if (
      e.button === 0 &&
      !(e.target as HTMLElement).closest("button, input, select, textarea, [role='button'], [role='menu']")
    ) {
      void startOrbDrag();
    }
  };

  if (
    (view === "translate" ||
      view === "rewrite" ||
      view === "ask") &&
    onBack
  ) {
    return (
      <header className="header" data-tauri-drag-region onMouseDown={handleHeaderMouseDown}>
        <div className="header__row" data-tauri-drag-region>
          <button
            type="button"
            className="action-back"
            onClick={onBack}
            aria-label="Back to tools"
          >
            <IconArrowLeft className="icon icon--sm" />
            <span>Back to tools</span>
          </button>

          <div className="header__brand" data-tauri-drag-region>
            <Logo pulsing={false} />
            <span className="header__name" data-tauri-drag-region>LENS</span>
          </div>

          {onReturnToOrb && (
            <button
              type="button"
              className="icon-button icon-button--ghost"
              aria-label="Return to floating orb"
              title="Return to floating orb"
              onClick={onReturnToOrb}
            >
              <IconMinus className="icon icon--sm" />
            </button>
          )}
        </div>
      </header>
    );
  }

  return (
    <header className="header" data-tauri-drag-region onMouseDown={handleHeaderMouseDown}>
      <div className="header__row" data-tauri-drag-region>
        <div className="header__brand" data-tauri-drag-region>
          <Logo pulsing={view === "processing"} />

          <div className="header__titles" data-tauri-drag-region>
            <span className="header__name" data-tauri-drag-region>LENS</span>
            <span className="header__subtitle" data-tauri-drag-region>
              Text Intelligence
            </span>
          </div>
        </div>

        <div className="header__meta">
          <StatusIndicator view={view} />

          {onReturnToOrb && (
            <button
              type="button"
              className="icon-button icon-button--ghost"
              aria-label="Return to floating orb"
              title="Return to floating orb"
              onClick={onReturnToOrb}
            >
              <IconMinus className="icon icon--sm" />
            </button>
          )}

          <div className="header__menu" ref={menuRef}>
            <button
              type="button"
              className="icon-button icon-button--ghost"
              aria-label="Open menu"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((value) => !value)}
            >
              <IconDots className="icon icon--sm" />
            </button>

            {menuOpen && (
              <HeaderMenu
                onClose={() => setMenuOpen(false)}
                onAction={handleMenuAction}
              />
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

/* ============================================================
   HERO
   ============================================================ */

const Hero: FC = () => (
  <div className="hero">
    <h1 className="hero__title">
      YOUR TEXT, UNDERSTOOD
    </h1>
  </div>
);

/* ============================================================
   ACTION CARD
   ============================================================ */

const ActionCard: FC<{
  action: ActionDef;
  active: boolean;
  onSelect: (action: ActionDef) => void;
}> = ({ action, active, onSelect }) => {
  const Icon = action.icon;

  return (
    <button
      type="button"
      className={`action-card${
        active ? " action-card--active" : ""
      }`}
      onClick={() => onSelect(action)}
      aria-pressed={active}
    >
      <span className="action-card__icon">
        <Icon className="icon" />
      </span>

      <span className="action-card__text">
        <span className="action-card__title">
          {action.label}
        </span>

        <span className="action-card__desc">
          {action.description}
        </span>
      </span>

      {action.shortcut && (
        <span className="action-card__shortcut">
          {action.shortcut}
        </span>
      )}
    </button>
  );
};

/* ============================================================
   HOME TOOLS
   ============================================================ */

const HomeTools: FC<{
  onSelect: (action: ActionDef) => void;
}> = ({ onSelect }) => {
  const translateAction =
    ACTIONS.find((action) => action.id === "translate")!;

  const rewriteAction =
    ACTIONS.find((action) => action.id === "rewrite")!;

  const summarizeAction =
    ACTIONS.find((action) => action.id === "summarize")!;

  const askAction =
    ACTIONS.find((action) => action.id === "ask")!;

  return (
    <div className="home-tools">
      <div className="home-tools-grid">
        <ActionCard
          action={translateAction}
          active={false}
          onSelect={onSelect}
        />

        <ActionCard
          action={rewriteAction}
          active={false}
          onSelect={onSelect}
        />
      </div>

      <div className="home-tool-centered">
        <ActionCard
          action={summarizeAction}
          active={false}
          onSelect={onSelect}
        />
      </div>

      <div className="home-tool-ask">
        <button
          type="button"
          className="action-card action-card--prominent"
          onClick={() => onSelect(askAction)}
        >
          <span className="action-card__icon action-card__icon--prominent">
            <IconBolt className="icon" />
          </span>

          <span className="action-card__text">
            <span className="action-card__title">
              Ask AI
            </span>

            <span className="action-card__desc">
              Ask about selected text
            </span>
          </span>
        </button>
      </div>

      <div className="made-by">
        <span>Made by</span>
        <strong>CodeR</strong>
      </div>
    </div>
  );
};

/* ============================================================
   LANGUAGES
   ============================================================ */

export interface LanguageOption {
  code: string;
  label: string;
}

export const SUPPORTED_LANGUAGES: LanguageOption[] = [
  { code: "en", label: "English" },
  { code: "bn", label: "বাংলা" },
  { code: "hi", label: "Hindi" },
  { code: "ur", label: "Urdu" },
  { code: "ar", label: "Arabic" },
  { code: "es", label: "Spanish" },
  { code: "fr", label: "French" },
  { code: "de", label: "German" },
  { code: "pt", label: "Portuguese" },
  { code: "ru", label: "Russian" },
  { code: "zh-CN", label: "Chinese (Simplified)" },
  { code: "zh-TW", label: "Chinese (Traditional)" },
  { code: "ja", label: "Japanese" },
  { code: "ko", label: "Korean" },
  { code: "it", label: "Italian" },
  { code: "nl", label: "Dutch" },
  { code: "tr", label: "Turkish" },
  { code: "vi", label: "Vietnamese" },
  { code: "th", label: "Thai" },
  { code: "id", label: "Indonesian" },
  { code: "ms", label: "Malay" },
  { code: "ta", label: "Tamil" },
  { code: "te", label: "Telugu" },
  { code: "mr", label: "Marathi" },
  { code: "gu", label: "Gujarati" },
  { code: "pa", label: "Punjabi" },
  { code: "kn", label: "Kannada" },
  { code: "ml", label: "Malayalam" },
  { code: "ne", label: "Nepali" },
  { code: "si", label: "Sinhala" },
  { code: "fa", label: "Persian" },
  { code: "he", label: "Hebrew" },
  { code: "el", label: "Greek" },
  { code: "pl", label: "Polish" },
  { code: "uk", label: "Ukrainian" },
  { code: "hu", label: "Hungarian" },
  { code: "cs", label: "Czech" },
  { code: "sk", label: "Slovak" },
  { code: "bg", label: "Bulgarian" },
  { code: "sr", label: "Serbian" },
  { code: "hr", label: "Croatian" },
  { code: "sv", label: "Swedish" },
  { code: "da", label: "Danish" },
  { code: "no", label: "Norwegian" },
  { code: "fi", label: "Finnish" },
  { code: "sw", label: "Swahili" },
  { code: "tl", label: "Filipino" },
];

export const SOURCE_LANGUAGES: LanguageOption[] = [
  { code: "auto", label: "Auto Detect" },
  ...SUPPORTED_LANGUAGES,
];

export const TARGET_LANGUAGES: LanguageOption[] =
  SUPPORTED_LANGUAGES;

/* ============================================================
   TRANSLATE VIEW
   ============================================================ */

const TranslateView: FC<{
  text: string;
  onChangeText: (value: string) => void;
  onSubmit: (
    fromLang: LanguageOption,
    toLang: LanguageOption
  ) => void;
  onToast: (message: string) => void;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  onCropSelect?: () => void;
}> = ({
  text,
  onChangeText,
  onSubmit,
  onToast,
  textareaRef,
  onCropSelect,
}) => {
  const [fromCode, setFromCode] = useState("auto");
  const [toCode, setToCode] = useState("bn");

  const handlePaste = useCallback(async () => {
    try {
      const clip = await navigator.clipboard.readText();

      if (clip) {
        onChangeText(clip.slice(0, 8000));
        textareaRef.current?.focus();
      } else {
        onToast("Clipboard is empty");
      }
    } catch {
      onToast("Couldn't read clipboard");
    }
  }, [onChangeText, onToast, textareaRef]);

  const handleCropSelect = useCallback(() => {
    if (onCropSelect) {
      onCropSelect();
    }
  }, [onCropSelect]);

  const handleTranslateClick = () => {
    const fromObj =
      SOURCE_LANGUAGES.find(
        (language) => language.code === fromCode
      ) ?? SOURCE_LANGUAGES[0];

    const toObj =
      TARGET_LANGUAGES.find(
        (language) => language.code === toCode
      ) ?? TARGET_LANGUAGES[1];

    onSubmit(fromObj, toObj);
  };

  return (
    <div className="translate-view">
      <h2 className="translate-view__title">
        TRANSLATE
      </h2>

      <div className="translate-view__input-card">
        <textarea
          ref={textareaRef}
          className="composer__textarea translate-view__textarea"
          placeholder="Paste your text here..."
          value={text}
          maxLength={8000}
          onChange={(
            e: ChangeEvent<HTMLTextAreaElement>
          ) => onChangeText(e.target.value)}
          aria-label="Text to translate"
        />

        <div className="translate-view__actions">
          <button
            type="button"
            className="chip-button"
            onClick={handlePaste}
          >
            <IconClipboard className="icon icon--xs" />
            <span>Paste</span>
          </button>

          <button
            type="button"
            className="chip-button"
            onClick={handleCropSelect}
          >
            <IconScissors className="icon icon--xs" />
            <span>Crop-Paste</span>
          </button>
        </div>

        <div className="translate-view__languages">
          <div className="lang-group">
            <span className="lang-label">From:</span>

            <select
              className="lang-select"
              value={fromCode}
              onChange={(e) =>
                setFromCode(e.target.value)
              }
            >
              {SOURCE_LANGUAGES.map((language) => (
                <option
                  key={language.code}
                  value={language.code}
                >
                  {language.label}
                </option>
              ))}
            </select>
          </div>

          <div className="lang-group">
            <span className="lang-label">To:</span>

            <select
              className="lang-select"
              value={toCode}
              onChange={(e) =>
                setToCode(e.target.value)
              }
            >
              {TARGET_LANGUAGES.map((language) => (
                <option
                  key={language.code}
                  value={language.code}
                >
                  {language.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="translate-view__submit-wrap">
          <button
            type="button"
            className="primary-button primary-button--lg"
            onClick={handleTranslateClick}
            disabled={text.trim().length === 0}
          >
            <span>Translate</span>
            <IconArrowUpRight className="icon icon--xs" />
          </button>
        </div>
      </div>
    </div>
  );
};

/* ============================================================
   REWRITE
   ============================================================ */

export interface RewriteOption {
  id: string;
  label: string;
  actionId: ActionId;
}

const REWRITE_TYPES: RewriteOption[] = [
  {
    id: "grammar",
    label: "Fix Grammar",
    actionId: "grammar",
  },
  {
    id: "professional_touch",
    label: "Professional Touch",
    actionId: "rewrite",
  },
  {
    id: "academic",
    label: "Academic",
    actionId: "rewrite",
  },
  {
    id: "short",
    label: "Short",
    actionId: "simplify",
  },
  {
    id: "casual",
    label: "Casual",
    actionId: "tone",
  },
];

/* ============================================================
   REWRITE TYPE SELECTOR
   ============================================================ */

const RewriteTypeSelector: FC<{
  selected: RewriteOption;
  onSelect: (option: RewriteOption) => void;
}> = ({ selected, onSelect }) => {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };

    document.addEventListener(
      "mousedown",
      handleClickOutside
    );

    return () => {
      document.removeEventListener(
        "mousedown",
        handleClickOutside
      );
    };
  }, [open]);

  return (
    <div
      className="rewrite-selector"
      ref={dropdownRef}
    >
      <button
        type="button"
        className="rewrite-selector__trigger"
        onClick={() => setOpen((previous) => !previous)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span>{selected.label}</span>

        <IconChevronDown
          className={`icon icon--xs rewrite-selector__chevron${
            open ? " is-open" : ""
          }`}
        />
      </button>

      {open && (
        <ul
          className="rewrite-selector__menu"
          role="listbox"
        >
          {REWRITE_TYPES.map((option) => {
            const isSelected =
              option.id === selected.id;

            return (
              <li
                key={option.id}
                role="option"
                aria-selected={isSelected}
                className={`rewrite-selector__item${
                  isSelected ? " is-selected" : ""
                }`}
                onClick={() => {
                  onSelect(option);
                  setOpen(false);
                }}
              >
                <span className="rewrite-selector__check">
                  {isSelected ? "✓" : ""}
                </span>

                <span className="rewrite-selector__label">
                  {option.label}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

/* ============================================================
   REWRITE VIEW
   ============================================================ */

const RewriteView: FC<{
  text: string;
  onChangeText: (value: string) => void;
  onSubmit: (option: RewriteOption) => void;
  onToast: (message: string) => void;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  onCropSelect?: () => void;
}> = ({
  text,
  onChangeText,
  onSubmit,
  onToast,
  textareaRef,
  onCropSelect,
}) => {
  const [selectedOption, setSelectedOption] =
    useState<RewriteOption>(REWRITE_TYPES[0]);

  const handlePaste = useCallback(async () => {
    try {
      const clip = await navigator.clipboard.readText();

      if (clip) {
        onChangeText(clip.slice(0, 8000));
        textareaRef.current?.focus();
      } else {
        onToast("Clipboard is empty");
      }
    } catch {
      onToast("Couldn't read clipboard");
    }
  }, [onChangeText, onToast, textareaRef]);

  const handleCropSelect = useCallback(() => {
    if (onCropSelect) {
      onCropSelect();
    }
  }, [onCropSelect]);

  return (
    <div className="rewrite-view">
      <h2 className="rewrite-view__title">
        REWRITE
      </h2>

      <RewriteTypeSelector
        selected={selectedOption}
        onSelect={setSelectedOption}
      />

      <div className="rewrite-view__input-card">
        <textarea
          ref={textareaRef}
          className="composer__textarea rewrite-view__textarea"
          placeholder="Paste your text here..."
          value={text}
          maxLength={8000}
          onChange={(
            e: ChangeEvent<HTMLTextAreaElement>
          ) => onChangeText(e.target.value)}
          aria-label="Text to rewrite"
        />

        <div className="rewrite-view__actions">
          <button
            type="button"
            className="chip-button"
            onClick={handlePaste}
          >
            <IconClipboard className="icon icon--xs" />
            <span>Paste</span>
          </button>

          <button
            type="button"
            className="chip-button"
            onClick={handleCropSelect}
          >
            <IconScissors className="icon icon--xs" />
            <span>Crop-Paste</span>
          </button>
        </div>

        <div className="rewrite-view__submit-wrap">
          <button
            type="button"
            className="primary-button primary-button--lg"
            onClick={() => onSubmit(selectedOption)}
            disabled={text.trim().length === 0}
          >
            <span>Rewrite</span>
            <IconArrowUpRight className="icon icon--xs" />
          </button>
        </div>
      </div>
    </div>
  );
};

/* ============================================================
   ASK AI VIEW
   ============================================================ */

const AskAIView: FC<{
  text: string;
  onChangeText: (value: string) => void;
  onSubmit: (mode: "make_questions" | "ask_text") => void;
  onToast: (message: string) => void;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  onCropSelect?: () => void;
}> = ({
  text,
  onChangeText,
  onSubmit,
  onToast,
  textareaRef,
  onCropSelect,
}) => {
  const [mode, setMode] = useState<
    "make_questions" | "ask_text"
  >("make_questions");

  const handlePaste = useCallback(async () => {
    try {
      const clip = await navigator.clipboard.readText();

      if (clip) {
        onChangeText(clip.slice(0, 8000));
        textareaRef.current?.focus();
      } else {
        onToast("Clipboard is empty");
      }
    } catch {
      onToast("Couldn't read clipboard");
    }
  }, [onChangeText, onToast, textareaRef]);

  const handleCropSelect = useCallback(() => {
    if (onCropSelect) {
      onCropSelect();
    }
  }, [onCropSelect]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();

        if (text.trim().length > 0) {
          onSubmit(mode);
        }
      }
    },
    [text, mode, onSubmit]
  );

  return (
    <div className="ask-ai-view">
      <h2 className="ask-ai-view__title">
        ASK AI
      </h2>

      <div className="ask-ai-view__modes">
        <button
          type="button"
          className={`ask-ai-view__mode${
            mode === "make_questions"
              ? " is-active"
              : ""
          }`}
          onClick={() =>
            setMode("make_questions")
          }
        >
          Make Questions
        </button>

        <button
          type="button"
          className={`ask-ai-view__mode${
            mode === "ask_text"
              ? " is-active"
              : ""
          }`}
          onClick={() =>
            setMode("ask_text")
          }
        >
          Ask Text
        </button>
      </div>

      <div className="ask-ai-view__input-card">
        <textarea
          ref={textareaRef}
          className="composer__textarea ask-ai-view__textarea"
          placeholder="Paste your text here..."
          value={text}
          maxLength={8000}
          onChange={(
            e: ChangeEvent<HTMLTextAreaElement>
          ) => onChangeText(e.target.value)}
          onKeyDown={handleKeyDown}
          aria-label="Text for Ask AI"
        />

        <div className="ask-ai-view__actions">
          <button
            type="button"
            className="chip-button"
            onClick={handlePaste}
          >
            <IconClipboard className="icon icon--xs" />
            <span>Paste</span>
          </button>

          <button
            type="button"
            className="chip-button"
            onClick={handleCropSelect}
          >
            <IconScissors className="icon icon--xs" />
            <span>Crop-Paste</span>
          </button>
        </div>

        <div className="ask-ai-view__submit-wrap">
          <button
            type="button"
            className="primary-button primary-button--lg"
            onClick={() => onSubmit(mode)}
            disabled={text.trim().length === 0}
          >
            <span>Continue</span>
            <IconArrowUpRight className="icon icon--xs" />
          </button>
        </div>
      </div>
    </div>
  );
};

/* ============================================================
   COMPOSER
   ============================================================ */

const Composer: FC<{
  text: string;
  action: ActionDef;
  actionLocked: boolean;
  onChange: (value: string) => void;
  onClear: () => void;
  onDeselectAction: () => void;
  onSubmit: () => void;
  onToast: (message: string) => void;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  onCropSelect?: () => void;
}> = ({
  text,
  action,
  actionLocked,
  onChange,
  onClear,
  onDeselectAction,
  onSubmit,
  onToast,
  textareaRef,
  onCropSelect,
}) => {
  const MAX = 8000;
  const nearLimit = text.length > MAX * 0.85;

  const handlePaste = useCallback(async () => {
    try {
      const clip = await navigator.clipboard.readText();

      if (clip) {
        onChange(clip.slice(0, MAX));
        textareaRef.current?.focus();
      } else {
        onToast("Clipboard is empty");
      }
    } catch {
      onToast("Couldn't read clipboard");
    }
  }, [onChange, onToast, textareaRef]);

  const handleCropSelect = useCallback(() => {
    if (onCropSelect) {
      onCropSelect();
    }
  }, [onCropSelect]);

  return (
    <div className="composer">
      {actionLocked && (
        <div className="composer__badge">
          <action.icon className="icon icon--xs" />

          <span>{action.label}</span>

          <button
            type="button"
            className="composer__badge-close"
            aria-label="Clear selected action"
            onClick={onDeselectAction}
          >
            <IconX className="icon icon--xs" />
          </button>
        </div>
      )}

      <div className="composer__field">
        <textarea
          ref={textareaRef}
          className="composer__textarea"
          placeholder={action.placeholder}
          value={text}
          maxLength={MAX}
          onChange={(
            e: ChangeEvent<HTMLTextAreaElement>
          ) => onChange(e.target.value)}
          aria-label="Text to process"
        />

        <span
          className={`composer__count${
            nearLimit
              ? " composer__count--warn"
              : ""
          }`}
        >
          {text.length.toLocaleString()} chars
        </span>
      </div>

      <div className="composer__toolbar">
        <div className="composer__toolbar-left">
          <button
            type="button"
            className="chip-button"
            onClick={handlePaste}
          >
            <IconClipboard className="icon icon--xs" />
            Paste
          </button>

          <button
            type="button"
            className="chip-button"
            onClick={handleCropSelect}
          >
            <IconScissors className="icon icon--xs" />
            Crop-Paste
          </button>

          <button
            type="button"
            className="chip-button"
            onClick={onClear}
            disabled={text.length === 0}
          >
            <IconX className="icon icon--xs" />
            Clear
          </button>
        </div>

        <button
          type="button"
          className="primary-button"
          onClick={onSubmit}
          disabled={text.trim().length === 0}
        >
          <span>
            {actionLocked
              ? action.verb
              : "Ask LENS"}
          </span>

          <IconArrowUpRight className="icon icon--xs" />
        </button>
      </div>

      <div className="composer__hint">
        <kbd>Ctrl</kbd>
        <span>+</span>
        <kbd>Enter</kbd>
        <span>to send</span>
      </div>
    </div>
  );
};

/* ============================================================
   PROCESSING VIEW
   ============================================================ */

const ProcessingView: FC<{
  actionLabel: string;
  onCancel: () => void;
}> = ({ actionLabel, onCancel }) => (
  <div
    className="processing"
    role="status"
    aria-live="polite"
  >
    <div
      className="processing__ring"
      aria-hidden="true"
    >
      <span />
      <span />
      <span />
    </div>

    <p className="processing__title">
      {actionLabel}

      <span
        className="processing__dots"
        aria-hidden="true"
      >
        <i />
        <i />
        <i />
      </span>
    </p>

    <p className="processing__subtitle">
      Preparing your answer...
    </p>

    <button
      type="button"
      className="ghost-button"
      onClick={onCancel}
    >
      Cancel
    </button>
  </div>
);

/* ============================================================
   RESULT BLOCK
   ============================================================ */

const ResultBlock: FC<{
  exchange: Exchange;
  isLast: boolean;
  copiedId: string | null;
  onCopy: (
    id: string,
    content: string
  ) => void;
  onInsert: (content: string) => void;
  onRetry: (exchange: Exchange) => void;
}> = ({
  exchange,
  isLast,
  copiedId,
  onCopy,
  onInsert,
  onRetry,
}) => (
  <article className="result-block">
    <p className="result-block__query">
      {exchange.query}
    </p>

    <div className="result-block__answer">
      <span className="result-block__eyebrow">
        LENS
      </span>

      <div className="result-block__text">
        {exchange.actionId === "grammar" ? (
          <GrammarResult
            original={exchange.query}
            corrected={exchange.response}
          />
        ) : (
          exchange.response
        )}
      </div>
    </div>

    {isLast && (
      <div className="result-block__actions">
        <button
          type="button"
          className="chip-button"
          onClick={() =>
            onCopy(
              exchange.id,
              exchange.response
            )
          }
        >
          {copiedId === exchange.id ? (
            <>
              <IconCheck className="icon icon--xs" />
              Copied
            </>
          ) : (
            <>
              <IconCopy className="icon icon--xs" />
              Copy
            </>
          )}
        </button>

        <button
          type="button"
          className="chip-button"
          onClick={() =>
            onInsert(exchange.response)
          }
        >
          <IconInsert className="icon icon--xs" />
          Insert
        </button>

        <button
          type="button"
          className="chip-button"
          onClick={() => onRetry(exchange)}
        >
          <IconRetry className="icon icon--xs" />
          Retry
        </button>
      </div>
    )}
  </article>
);

/* ============================================================
   RESULT VIEW
   ============================================================ */

const ResultView: FC<{
  exchanges: Exchange[];
  copiedId: string | null;
  onBack: () => void;
  onCopy: (
    id: string,
    content: string
  ) => void;
  onInsert: (content: string) => void;
  onRetry: (exchange: Exchange) => void;
  onFollowUp: (query: string) => void;
}> = ({
  exchanges,
  copiedId,
  onBack,
  onCopy,
  onInsert,
  onRetry,
  onFollowUp,
}) => {
  const [followUp, setFollowUp] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const last = exchanges[exchanges.length - 1];

  useEffect(() => {
    listRef.current?.scrollTo({
      top: listRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [exchanges.length]);

  const submitFollowUp = () => {
    if (followUp.trim().length === 0) {
      return;
    }

    onFollowUp(followUp.trim());
    setFollowUp("");
  };

  return (
    <div className="result-view">
      <div className="result-view__header">
        <button
          type="button"
          className="icon-button"
          onClick={onBack}
          aria-label="Back"
        >
          <IconArrowLeft className="icon" />
        </button>

        <span className="result-view__title">
          {last?.actionLabel ?? "Result"}
        </span>
      </div>

      <div
        className="result-view__list"
        ref={listRef}
      >
        {exchanges.map((exchange, index) => (
          <ResultBlock
            key={exchange.id}
            exchange={exchange}
            isLast={
              index === exchanges.length - 1
            }
            copiedId={copiedId}
            onCopy={onCopy}
            onInsert={onInsert}
            onRetry={onRetry}
          />
        ))}
      </div>

      <div className="follow-up">
        <input
          type="text"
          className="follow-up__input"
          placeholder="Ask a follow-up…"
          value={followUp}
          onChange={(
            e: ChangeEvent<HTMLInputElement>
          ) => setFollowUp(e.target.value)}
          onKeyDown={(
            e: KeyboardEvent<HTMLInputElement>
          ) => {
            if (e.key === "Enter") {
              submitFollowUp();
            }
          }}
          aria-label="Follow-up question"
        />

        <button
          type="button"
          className="icon-button icon-button--accent"
          aria-label="Send follow-up"
          onClick={submitFollowUp}
          disabled={followUp.trim().length === 0}
        >
          <IconSend className="icon icon--sm" />
        </button>
      </div>
    </div>
  );
};

/* ============================================================
   ERROR VIEW
   ============================================================ */

const ErrorView: FC<{
  message: string;
  onRetry: () => void;
  onBack: () => void;
}> = ({
  message,
  onRetry,
  onBack,
}) => (
  <div
    className="error-view"
    role="alert"
  >
    <span className="error-view__icon">
      <IconAlert className="icon" />
    </span>

    <p className="error-view__title">
      Something went wrong.
    </p>

    <p className="error-view__message">
      {message}
    </p>

    <div className="error-view__actions">
      <button
        type="button"
        className="ghost-button"
        onClick={onBack}
      >
        Start over
      </button>

      <button
        type="button"
        className="primary-button"
        onClick={onRetry}
      >
        <IconRetry className="icon icon--xs" />
        <span>Try again</span>
      </button>
    </div>
  </div>
);

/* ============================================================
   TOAST
   ============================================================ */

const Toast: FC<{
  toast: ToastState | null;
}> = ({ toast }) => (
  <div
    className="toast-host"
    aria-live="polite"
  >
    {toast && (
      <div
        className={`toast toast--${toast.tone}`}
        key={toast.id}
      >
        {toast.tone === "success" && (
          <IconCheck className="icon icon--xs" />
        )}

        {toast.message}
      </div>
    )}
  </div>
);

/* ============================================================
   ROOT APP
   ============================================================ */

let idCounter = 0;

const nextId = () =>
  `x${Date.now()}-${idCounter++}`;

function App(): ReactNode {

  const [view, setView] =
    useState<ViewState>("orb");

  const [selectedAction, setSelectedAction] =
    useState<ActionDef | null>(null);

  const [text, setText] = useState("");

  const [exchanges, setExchanges] =
    useState<Exchange[]>([]);

  const [errorMessage, setErrorMessage] =
    useState("");

  const [copiedId, setCopiedId] =
    useState<string | null>(null);

  const [toast, setToast] =
    useState<ToastState | null>(null);

  const [isSettingsOpen, setIsSettingsOpen] =
    useState(false);


  const [
    lastRequestPayload,
    setLastRequestPayload,
  ] = useState<{
    skillId: SkillId;
    payload: SkillPayload;
    displayAction: ActionDef;
  } | null>(null);

  const textareaRef =
    useRef<HTMLTextAreaElement>(null);

  const processingTimeout =
    useRef<ReturnType<typeof setTimeout> | null>(
      null
    );

  const toastTimeout =
    useRef<ReturnType<typeof setTimeout> | null>(
      null
    );

  const copyTimeout =
    useRef<ReturnType<typeof setTimeout> | null>(
      null
    );

  const abortControllerRef =
    useRef<AbortController | null>(null);

  const latestCropSessionRef = useRef<number>(0);

  const isCropWorkflowActiveRef = useRef<boolean>(false);

  const activeAction =
    selectedAction ?? DEFAULT_ACTION;

  /* ==========================================================
     TOAST
     ========================================================== */

  const showToast = useCallback(
    (
      message: string,
      tone: ToastState["tone"] = "default"
    ) => {
      if (toastTimeout.current) {
        clearTimeout(toastTimeout.current);
      }

      setToast({
        id: Date.now(),
        message,
        tone,
      });

      toastTimeout.current =
        setTimeout(() => {
          setToast(null);
        }, 2200);
    },
    []
  );

  /* ==========================================================
     EXECUTE LENS SKILL
     ========================================================== */

  const executeLensSkill = useCallback(
    async (
      skillId: SkillId,
      payload: SkillPayload,
      displayAction: ActionDef
    ) => {
      abortControllerRef.current?.abort();

      const controller =
        new AbortController();

      abortControllerRef.current =
        controller;

      setLastRequestPayload({
        skillId,
        payload,
        displayAction,
      });

      setErrorMessage("");
      setView("processing");

      const exchangeId = nextId();

      const query =
        (payload as { text?: string }).text ?? "";

      setExchanges((previous) => [
        ...previous,
        {
          id: exchangeId,
          actionId: displayAction.id,
          actionLabel: displayAction.label,
          query,
          response: "",
        },
      ]);

      let hasReceivedFirstChunk = false;

      try {
        const result =
          await skillRegistry.executeSkill(
            skillId,
            payload,
            (chunk) => {
              if (controller.signal.aborted) {
                return;
              }

              if (!chunk) {
                return;
              }

              if (!hasReceivedFirstChunk) {
                hasReceivedFirstChunk = true;
                setView("result");
              }

              setExchanges((previous) =>
                previous.map((exchange) =>
                  exchange.id === exchangeId
                    ? {
                        ...exchange,
                        response:
                          exchange.response +
                          chunk,
                      }
                    : exchange
                )
              );
            },
            controller.signal
          );

        if (controller.signal.aborted) {
          return;
        }

        if (!result.success) {
          setExchanges((previous) =>
            previous.filter(
              (exchange) =>
                exchange.id !== exchangeId
            )
          );

          setErrorMessage(
            result.error ||
              "LENS couldn't process this request."
          );

          setView("error");

          return;
        }

        if (!hasReceivedFirstChunk) {
          setExchanges((previous) =>
            previous.map((exchange) =>
              exchange.id === exchangeId
                ? {
                    ...exchange,
                    response:
                      result.resultText,
                  }
                : exchange
            )
          );

          setView("result");
        }
      } catch (err: unknown) {
        if (controller.signal.aborted) {
          return;
        }

        setExchanges((previous) =>
          previous.filter(
            (exchange) =>
              exchange.id !== exchangeId
          )
        );

        const message =
          err instanceof Error
            ? err.message
            : "An unknown error occurred.";

        setErrorMessage(message);
        setView("error");
      } finally {
        if (
          abortControllerRef.current ===
          controller
        ) {
          abortControllerRef.current = null;
        }
      }
    },
    []
  );


  /* ==========================================================
   FLOATING LENS & WINDOW MODE
   ========================================================== */

  const handleFloatingOpenLens = useCallback(async () => {
    try {
      await switchToAppMode();
    } catch {
      // Fallback if not running in Tauri
    }

    setView("home");

    requestAnimationFrame(() => {
      textareaRef.current?.focus();
    });
  }, []);

  const cropLaunchSourceRef = useRef<"orb" | "tool">("orb");

  const handleFloatingCrop = useCallback(async () => {
    cropLaunchSourceRef.current = "orb";
    showToast("Select an area to capture");
    try {
      await startScreenCrop();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : String(err);
      showToast(`Couldn't start crop: ${message}`);
    }
  }, [showToast]);

  const handleToolCropPaste = useCallback(() => {
    console.log("[CROP PASTE] requested");
    const validated = cropStore.getValidatedCrop();
    if (validated) {
      console.log(`[CROP PASTE] session=${validated.sessionId}`);
      console.log(`[CROP PASTE] text="${validated.text.slice(0, 60)}"`);
      setText(validated.text);
      console.log(`[CROP PASTE] inserted session=${validated.sessionId}`);
      requestAnimationFrame(() => {
        textareaRef.current?.focus();
      });
    } else {
      const current = cropStore.getRecentCropData();
      console.log(`[CROP PASTE] REJECTED_STALE session=${current?.sessionId ?? 0}`);
      showToast("No current cropped text available. Use Crop first.");
    }
  }, [showToast]);

  useEffect(() => {
    let effectActive = true;
    let unlistenCaptured: (() => void) | undefined;
    let unlistenCancelled: (() => void) | undefined;

    listen<CapturedImagePayload>(
      "crop-image-captured",
      (event) => {
        const payload = event.payload;
        const incomingSession = payload.session_id;

        const tImgCaptured = performance.now();
        console.log(`[CROP PERF] IMAGE_CAPTURED session=${incomingSession} t=${tImgCaptured.toFixed(2)}ms`);
        console.log(`[CROP FLOW] IMAGE_CAPTURED session=${incomingSession}`);

        if (incomingSession < latestCropSessionRef.current) {
          console.log(`[CROP FLOW] STALE_DISCARD session=${incomingSession}`);
          return;
        }

        latestCropSessionRef.current = incomingSession;
        const isToolLaunch = cropLaunchSourceRef.current === "tool";

        void (async () => {
          isCropWorkflowActiveRef.current = true;

          if (!isToolLaunch) {
            const tAppStart = performance.now();
            console.log(`[CROP PERF] APP_MODE_START session=${incomingSession} t=${tAppStart.toFixed(2)}ms`);
            console.log(`[CROP FLOW] APP_MODE_START session=${incomingSession}`);
            try {
              await switchToAppMode();
              const tAppDone = performance.now();
              console.log(`[CROP PERF] APP_MODE_DONE session=${incomingSession} t=${tAppDone.toFixed(2)}ms (took ${(tAppDone - tAppStart).toFixed(2)}ms)`);
              console.log(`[CROP FLOW] APP_MODE_DONE session=${incomingSession}`);
            } catch (err) {
              console.error("[CROP FLOW] Error switching to App mode:", err);
            }
            setView("home");
            console.log(`[CROP FLOW] UI_STATE view=home`);
          }

          showToast("Extracting text with AI…");

          try {
            const extractedText = await executeVisionOCR(payload);

            // Check stale after async OCR
            if (incomingSession < latestCropSessionRef.current) {
              console.log(`[CROP FLOW] STALE_DISCARD session=${incomingSession} after OCR`);
              isCropWorkflowActiveRef.current = false;
              return;
            }

            if (extractedText.length > 0) {
              const tSetTextStart = performance.now();
              console.log(`[CROP PERF] SET_TEXT_START session=${incomingSession} t=${tSetTextStart.toFixed(2)}ms`);

              setText(extractedText);

              const tSetTextDone = performance.now();
              console.log(`[CROP PERF] SET_TEXT_DONE session=${incomingSession} t=${tSetTextDone.toFixed(2)}ms (took ${(tSetTextDone - tSetTextStart).toFixed(2)}ms)`);

              showToast("Text extracted with AI");
            } else {
              cropStore.clearRecentCrop();
              setText("");
              showToast("No text found in that selection");
            }
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            console.error(`[CROP FLOW] OCR_ERROR session=${incomingSession}: ${message}`);
            showToast(message);
            cropStore.clearRecentCrop();
            setText("");
          }

          const tUiReady = performance.now();
          console.log(`[CROP PERF] UI_READY session=${incomingSession} t=${tUiReady.toFixed(2)}ms`);

          requestAnimationFrame(() => {
            const tInputVisible = performance.now();
            console.log(`[CROP PERF] INPUT_TEXT_VISIBLE session=${incomingSession} t=${tInputVisible.toFixed(2)}ms (total elapsed = ${(tInputVisible - tImgCaptured).toFixed(2)}ms)`);
            textareaRef.current?.focus();
          });

          cropLaunchSourceRef.current = "orb";
          isCropWorkflowActiveRef.current = false;
        })();
      }
    ).then((cleanup) => {
      if (effectActive) {
        unlistenCaptured = cleanup;
      } else {
        cleanup();
      }
    });

    listen("crop-cancelled", () => {
      cropLaunchSourceRef.current = "orb";
      isCropWorkflowActiveRef.current = false;
      showToast("Crop cancelled");
    }).then((cleanup) => {
      if (effectActive) {
        unlistenCancelled = cleanup;
      } else {
        cleanup();
      }
    });

    return () => {
      effectActive = false;
      unlistenCaptured?.();
      unlistenCancelled?.();
    };
  }, [showToast]);

  const handleReturnToOrb = useCallback(async () => {

    if (isCropWorkflowActiveRef.current) {
      console.log("[CROP FLOW] handleReturnToOrb SUPPRESSED — crop workflow active");
      return;
    }
    try {
      await switchToOrbMode();
    } catch {

    }

    setView("orb");
  }, []);

  useEffect(() => {
    let unlisten: (() => void) | undefined;

    setupCloseInterceptor(handleReturnToOrb).then((cleanup) => {
      unlisten = cleanup;
    });

    return () => {
      if (unlisten) {
        unlisten();
      }
    };
  }, [handleReturnToOrb]);


  /* ==========================================================
     SELECT ACTION
     ========================================================== */

  const handleSelectAction = useCallback(
    (action: ActionDef) => {
      setSelectedAction(action);

      if (action.id === "translate") {
         setView("translate");
      } else if (action.id === "rewrite") {
         setView("rewrite");
      } else if (action.id === "ask") {
         setView("ask");
      } else {
         setView("action-selected");
       }

      requestAnimationFrame(() => {
        textareaRef.current?.focus();
      });
    },
    []
  );

  /* ==========================================================
     DESELECT ACTION
     ========================================================== */

  const handleDeselectAction =
    useCallback(() => {
      setSelectedAction(null);
      setView("home");
    }, []);

  /* ==========================================================
     GENERIC SUBMIT
     ========================================================== */

  const handleSubmit = useCallback(() => {
    const query = text.trim();

    if (query.length === 0) {
      return;
    }

    let skillId: SkillId = "ask";

    if (activeAction.id === "translate") {
      skillId = "translate";
    } else if (
      activeAction.id === "rewrite" ||
      activeAction.id === "grammar" ||
      activeAction.id === "simplify" ||
      activeAction.id === "tone"
    ) {
      skillId = "rewrite";
    } else if (
      activeAction.id === "summarize"
    ) {
      skillId = "summarize";
    }

    executeLensSkill(
      skillId,
      { text: query } as SkillPayload,
      activeAction
    );
  }, [
    text,
    activeAction,
    executeLensSkill,
  ]);

  /* ==========================================================
     TRANSLATE SUBMIT
     ========================================================== */

  const handleTranslateSubmit =
    useCallback(
      (
        fromLang: LanguageOption,
        toLang: LanguageOption
      ) => {
        const query = text.trim();

        if (query.length === 0) {
          return;
        }

        const baseAction =
          ACTIONS.find(
            (action) =>
              action.id === "translate"
          )!;

        const customAction: ActionDef = {
          ...baseAction,
          label: `Translate (${fromLang.label} → ${toLang.label})`,
          verb: `Translate (${fromLang.label} → ${toLang.label})`,
        };

        setSelectedAction(customAction);

        executeLensSkill(
          "translate",
          {
            text: query,
            fromLang,
            toLang,
          },
          customAction
        );
      },
      [text, executeLensSkill]
    );

  /* ==========================================================
     REWRITE SUBMIT
     ========================================================== */

  const handleRewriteSubmit =
    useCallback(
      (selectedOption: RewriteOption) => {
        const query = text.trim();

        if (query.length === 0) {
          return;
        }

        const baseAction =
          ACTIONS.find(
            (action) =>
              action.id ===
              selectedOption.actionId
          ) ??
          ACTIONS.find(
            (action) =>
              action.id === "rewrite"
          )!;

        const customAction: ActionDef = {
          ...baseAction,
          id: selectedOption.actionId,
          label: `Rewrite (${selectedOption.label})`,
          verb: `Rewrite (${selectedOption.label})`,
        };

        setSelectedAction(customAction);

        executeLensSkill(
          "rewrite",
          {
            text: query,
            mode:
              selectedOption.label as RewriteMode,
          },
          customAction
        );
      },
      [text, executeLensSkill]
    );

  /* ==========================================================
     ASK AI SUBMIT
     ========================================================== */

  const handleAskAISubmit = useCallback(
    (mode: "make_questions" | "ask_text") => {
      const query = text.trim();

      if (query.length === 0) {
        return;
      }

      const baseAction = ACTIONS.find(
        (action) => action.id === "ask"
      )!;

      const modeLabel =
        mode === "make_questions"
          ? "Make Questions"
          : "Ask Text";

      const customAction: ActionDef = {
        ...baseAction,
        label: `Ask AI (${modeLabel})`,
        verb: `Ask AI (${modeLabel})`,
      };

      setSelectedAction(customAction);

      const askMode: AskAIMode =
        mode === "make_questions"
          ? "make-question"
          : "ask-text";

      executeLensSkill(
        "ask",
        {
          text: query,
          mode: askMode,
        },
        customAction
      );
    },
    [text, executeLensSkill]
  );

  /* ==========================================================
     CANCEL PROCESSING
     ========================================================== */

  const handleCancelProcessing =
    useCallback(() => {
      if (processingTimeout.current) {
        clearTimeout(
          processingTimeout.current
        );
      }

      abortControllerRef.current?.abort();
      abortControllerRef.current = null;

      if (
        selectedAction?.id === "translate"
      ) {
        setView("translate");
      } else if (
        selectedAction?.id === "rewrite" ||
        selectedAction?.label.startsWith(
          "Rewrite"
        )
      ) {
        setView("rewrite");
      } else if (
        selectedAction?.id === "ask" ||
        selectedAction?.label.startsWith(
          "Ask AI"
        )
      ) {
        setView("ask");
      } else if (selectedAction) {
        setView("action-selected");
      } else {
        setView("home");
      }
    }, [selectedAction]);

  /* ==========================================================
     RETRY
     ========================================================== */

  const handleRetry = useCallback(
    (exchange?: Exchange) => {
      if (exchange) {
        let skillId: SkillId = "ask";

        if (
          exchange.actionId === "translate"
        ) {
          skillId = "translate";
        } else if (
          exchange.actionId === "rewrite" ||
          exchange.actionId === "grammar" ||
          exchange.actionId === "simplify" ||
          exchange.actionId === "tone"
        ) {
          skillId = "rewrite";
        } else if (
          exchange.actionId === "summarize"
        ) {
          skillId = "summarize";
        }

        const action =
          ACTIONS.find(
            (item) =>
              item.id === exchange.actionId
          ) ?? DEFAULT_ACTION;

        const displayAction: ActionDef = {
          ...action,
          label: exchange.actionLabel,
          verb: exchange.actionLabel,
        };

        executeLensSkill(
          skillId,
          {
            text: exchange.query,
          } as SkillPayload,
          displayAction
        );
      } else if (lastRequestPayload) {
        executeLensSkill(
          lastRequestPayload.skillId,
          lastRequestPayload.payload,
          lastRequestPayload.displayAction
        );
      }
    },
    [
      lastRequestPayload,
      executeLensSkill,
    ]
  );

  /* ==========================================================
     BACK FROM RESULT
     ========================================================== */

  const handleBackFromResult =
    useCallback(() => {
      setExchanges([]);
      setText("");

      if (
        selectedAction?.id === "translate"
      ) {
        setView("translate");
      } else if (
        selectedAction?.id === "rewrite" ||
        selectedAction?.label.startsWith(
          "Rewrite"
        )
      ) {
        setView("rewrite");
      } else if (
        selectedAction?.id === "ask" ||
        selectedAction?.label.startsWith(
          "Ask AI"
        )
      ) {
        setView("ask");
      } else if (selectedAction) {
        setView("action-selected");
      } else {
        setView("home");
      }
    }, [selectedAction]);

  /* ==========================================================
     FOLLOW UP
     ========================================================== */

  const handleFollowUp = useCallback(
    (query: string) => {
      const skillId: SkillId =
        lastRequestPayload?.skillId ??
        "ask";

      const displayAction =
        lastRequestPayload?.displayAction ??
        activeAction;

      executeLensSkill(
        skillId,
        {
          text: query,
        } as SkillPayload,
        displayAction
      );
    },
    [
      lastRequestPayload,
      activeAction,
      executeLensSkill,
    ]
  );

  /* ==========================================================
     COPY
     ========================================================== */

  const handleCopy = useCallback(
    async (
      id: string,
      content: string
    ) => {
      try {
        await navigator.clipboard.writeText(
          content
        );

        setCopiedId(id);

        showToast(
          "Copied to clipboard",
          "success"
        );

        if (copyTimeout.current) {
          clearTimeout(copyTimeout.current);
        }

        copyTimeout.current =
          setTimeout(() => {
            setCopiedId(null);
          }, 1600);
      } catch {
        showToast(
          "Couldn't copy to clipboard"
        );
      }
    },
    [showToast]
  );

  /* ==========================================================
     INSERT
     ========================================================== */

  const handleInsert = useCallback(
    (_content: string) => {
      showToast(
        "Inserted at cursor",
        "success"
      );
    },
    [showToast]
  );

  /* ==========================================================
     CLEAR
     ========================================================== */

  const handleClear = useCallback(() => {
    setText("");
    textareaRef.current?.focus();
  }, []);

  /* ==========================================================
     ERROR BACK
     ========================================================== */

  const handleErrorBack =
    useCallback(() => {
      if (
        selectedAction?.id === "translate"
      ) {
        setView("translate");
      } else if (
        selectedAction?.id === "rewrite" ||
        selectedAction?.label.startsWith(
          "Rewrite"
        )
      ) {
        setView("rewrite");
      } else if (
        selectedAction?.id === "ask" ||
        selectedAction?.label.startsWith(
          "Ask AI"
        )
      ) {
        setView("ask");
      } else if (selectedAction) {
        setView("action-selected");
      } else {
        setView("home");
      }
    }, [selectedAction]);

  /* ==========================================================
     KEYBOARD SHORTCUTS
     ========================================================== */

  useEffect(() => {
    const handleKeyDown = (
      e: globalThis.KeyboardEvent
    ) => {
      const target =
        e.target as HTMLElement | null;

      const isTyping =
        target instanceof
          HTMLTextAreaElement ||
        (target instanceof
          HTMLInputElement &&
          target.type === "text");

      if (
        (e.ctrlKey || e.metaKey) &&
        e.key === "Enter"
      ) {
        if (
          view === "home" ||
          view === "action-selected" ||
          view === "translate" ||
          view === "rewrite"
        ) {
          e.preventDefault();
          handleSubmit();
        }

        return;
      }

      if (e.key === "Escape") {
        if (view === "result") {
          handleBackFromResult();
        } else if (view === "error") {
          handleErrorBack();
        } else if (
          view === "translate" ||
          view === "rewrite" ||
          view === "ask" ||
          view === "action-selected"
        ) {
          handleDeselectAction();
        }

        return;
      }

      if (
        !isTyping &&
        (view === "home" ||
          view === "action-selected")
      ) {
        const action =
          PRIMARY_ACTIONS.find(
            (item) =>
              item.shortcut === e.key
          );

        if (action) {
          e.preventDefault();
          handleSelectAction(action);
        }
      }
    };

    window.addEventListener(
      "keydown",
      handleKeyDown
    );

    return () => {
      window.removeEventListener(
        "keydown",
        handleKeyDown
      );
    };
  }, [
    view,
    handleSubmit,
    handleBackFromResult,
    handleErrorBack,
    handleDeselectAction,
    handleSelectAction,
  ]);

  /* ==========================================================
     CLEANUP
     ========================================================== */

  useEffect(() => {
    return () => {
      if (processingTimeout.current) {
        clearTimeout(
          processingTimeout.current
        );
      }

      if (toastTimeout.current) {
        clearTimeout(
          toastTimeout.current
        );
      }

      if (copyTimeout.current) {
        clearTimeout(
          copyTimeout.current
        );
      }

      abortControllerRef.current?.abort();
    };
  }, []);

  /* ==========================================================
     RENDER
     ========================================================== */

  if (view === "orb") {
    return (
      <div
        className="app app--orb"
        data-view="orb"
      >
        <FloatingLens
          isOrbMode={true}
          onOpenLens={handleFloatingOpenLens}
          onCrop={handleFloatingCrop}
        />
        <Toast toast={toast} />
      </div>
    );
  }

  return (
    <div
      className="app"
      data-view={view}
    >
      <Header
        view={view}
        onBack={handleDeselectAction}
        onOpenSettings={() =>
          setIsSettingsOpen(true)
        }
        onReturnToOrb={handleReturnToOrb}
        onToast={showToast}
      />

      <main className="main">
        {view === "home" && (
          <div className="home-view">
            <Hero />

            <HomeTools
              onSelect={handleSelectAction}
            />
          </div>
        )}

        {view === "translate" && (
          <TranslateView
            text={text}
            onChangeText={setText}
            onSubmit={handleTranslateSubmit}
            onToast={showToast}
            textareaRef={textareaRef}
            onCropSelect={handleToolCropPaste}
          />
        )}

        {view === "rewrite" && (
          <RewriteView
            text={text}
            onChangeText={setText}
            onSubmit={handleRewriteSubmit}
            onToast={showToast}
            textareaRef={textareaRef}
            onCropSelect={handleToolCropPaste}
          />
        )}
        {view === "ask" && (
          <AskAIView
            text={text}
            onChangeText={setText}
            onSubmit={handleAskAISubmit}
            onToast={showToast}
            textareaRef={textareaRef}
            onCropSelect={handleToolCropPaste}
          />
        )}

        {view === "action-selected" && (
          <div className="home-view">
            <button
              type="button"
              className="action-back"
              onClick={
                handleDeselectAction
              }
              aria-label="Back to tools"
            >
              <IconArrowLeft className="icon icon--sm" />
              <span>Back to tools</span>
            </button>

            <Composer
              text={text}
              action={activeAction}
              actionLocked={true}
              onChange={setText}
              onClear={handleClear}
              onDeselectAction={
                handleDeselectAction
              }
              onSubmit={handleSubmit}
              onToast={showToast}
              textareaRef={textareaRef}
              onCropSelect={handleToolCropPaste}
            />
          </div>
        )}

        {view === "processing" && (
          <ProcessingView
            actionLabel={
              activeAction.gerund
            }
            onCancel={
              handleCancelProcessing
            }
          />
        )}

        {view === "result" && (
          <ResultView
            exchanges={exchanges}
            copiedId={copiedId}
            onBack={handleBackFromResult}
            onCopy={handleCopy}
            onInsert={handleInsert}
            onRetry={handleRetry}
            onFollowUp={handleFollowUp}
          />
        )}

        {view === "error" && (
          <ErrorView
            message={errorMessage}
            onRetry={() =>
              handleRetry()
            }
            onBack={handleErrorBack}
          />
        )}
      </main>

       <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() =>
          setIsSettingsOpen(false)
       }
       onToast={showToast}
    />

    <Toast toast={toast} />
  </div>
  );
}

export default App;


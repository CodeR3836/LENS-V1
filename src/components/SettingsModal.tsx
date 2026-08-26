import { useState, useEffect, type FC } from "react";
import type { ProviderType, ProviderConfig } from "../services/ai/types";
import { configStore } from "../services/config/configStore";
import { aiService } from "../services/ai/AIService";
import "./SettingsModal.css";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onToast: (message: string) => void;
}

type ConnectionStatus = "idle" | "testing" | "success" | "error";

export const SettingsModal: FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  onToast,
}) => {
  const [activeType, setActiveType] =
    useState<ProviderType>("mock");

  const [config, setConfig] =
    useState<ProviderConfig>({ type: "mock" });

  const [connectionStatus, setConnectionStatus] =
    useState<ConnectionStatus>("idle");

  const [showApiKey, setShowApiKey] =
    useState(false);

  useEffect(() => {
    if (isOpen) {
      const type = configStore.getActiveProviderType();

      setActiveType(type);
      setConfig(configStore.getProviderConfig(type));
      setConnectionStatus("idle");
      setShowApiKey(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleProviderTypeChange = (type: ProviderType) => {
    setActiveType(type);
    setConfig(configStore.getProviderConfig(type));

    // New provider = no previous test result
    setConnectionStatus("idle");
    setShowApiKey(false);
  };

  const handleTestConnection = async () => {
    // Reset status while testing
    setConnectionStatus("testing");

    if (activeType === "mock") {
      setTimeout(() => {
        setConnectionStatus("success");
        onToast("Mock Provider is available offline.");
      }, 300);

      return;
    }

    try {
      await aiService.testConnection(activeType, config);

      // SUCCESS
      setConnectionStatus("success");

      onToast(
        `${activeType.toUpperCase()} connection successful.`
      );
    } catch (err: unknown) {
      // ERROR
      setConnectionStatus("error");

      const message =
        err instanceof Error
          ? err.message
          : "Connection test failed.";

      onToast(`Connection failed: ${message}`);
    }
  };

  const handleSave = () => {
    configStore.setActiveProviderType(activeType);
    configStore.setProviderConfig(activeType, config);

    onToast(
      `Settings saved. Active Provider: ${activeType.toUpperCase()}`
    );

    onClose();
  };

  const isTesting = connectionStatus === "testing";

  const testButtonClass =
    connectionStatus === "success"
      ? "ghost-button connection-success"
      : connectionStatus === "error"
      ? "ghost-button connection-error"
      : "ghost-button";

  const testButtonText =
    connectionStatus === "testing"
      ? "Testing..."
      : connectionStatus === "success"
      ? "✓ Connection OK"
      : connectionStatus === "error"
      ? "✕ Connection Failed"
      : "Test Connection";

  return (
    <div
      className="settings-overlay"
      onClick={onClose}
    >
      <div
        className="settings-modal"
        onClick={(e) => e.stopPropagation()}
      >
        {/* =====================================================
            HEADER
        ====================================================== */}

        <div className="settings-modal__header">
          <span className="settings-modal__title">
            AI Provider Settings
          </span>

          <button
            type="button"
            className="icon-button icon-button--ghost"
            onClick={onClose}
            aria-label="Close settings"
            disabled={isTesting}
          >
            ✕
          </button>
        </div>

        {/* =====================================================
            BODY
        ====================================================== */}

        <div className="settings-modal__body">

          {/* Provider Selection */}

          <div className="settings-field">
            <label
              className="settings-field__label"
              htmlFor="provider-type-select"
            >
              Active Provider
            </label>

            <select
              id="provider-type-select"
              className="settings-field__select"
              value={activeType}
              onChange={(e) =>
                handleProviderTypeChange(
                  e.target.value as ProviderType
                )
              }
              disabled={isTesting}
            >
              <option value="mock">
                Demo / Mock Provider (Offline)
              </option>

              <option value="ollama">
                Ollama (Local AI)
              </option>

              <option value="claude">
                Anthropic Claude API
              </option>

              <option value="openai_compatible">
                OpenAI-Compatible API
              </option>

              <option value="gemini">
                Google Gemini API
              </option>
            </select>
          </div>



          {/* =================================================
              MOCK
          ================================================= */}

          {activeType === "mock" && (
            <p className="settings-field__hint">
              Mock Provider generates offline responses locally
              without requiring an API key or internet connection.
            </p>
          )}

          {/* =================================================
              OLLAMA
          ================================================= */}

          {activeType === "ollama" && (
            <>
              <div className="settings-field">
                <label
                  className="settings-field__label"
                  htmlFor="ollama-url"
                >
                  Ollama Base URL
                </label>

                <input
                  id="ollama-url"
                  type="text"
                  className="settings-field__input"
                  placeholder="http://localhost:11434"
                  value={config.baseUrl || ""}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      baseUrl: e.target.value,
                    })
                  }
                  disabled={isTesting}
                />
              </div>

              <div className="settings-field">
                <label
                  className="settings-field__label"
                  htmlFor="ollama-model"
                >
                  Model Name
                </label>

                <input
                  id="ollama-model"
                  type="text"
                  className="settings-field__input"
                  placeholder="llama3"
                  value={config.model || ""}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      model: e.target.value,
                    })
                  }
                  disabled={isTesting}
                />
              </div>
            </>
          )}

          {/* =================================================
              CLAUDE
          ================================================= */}

          {activeType === "claude" && (
            <>
              <div className="settings-field">
                <label
                  className="settings-field__label"
                  htmlFor="claude-key"
                >
                  Claude API Key
                </label>

                <div className="settings-key-wrapper">
                  <input
                    id="claude-key"
                    type={
                      showApiKey
                        ? "text"
                        : "password"
                    }
                    className="settings-field__input"
                    placeholder="sk-ant-..."
                    value={config.apiKey || ""}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        apiKey: e.target.value,
                      })
                    }
                    disabled={isTesting}
                  />

                  <button
                    type="button"
                    className="settings-key-toggle"
                    onClick={() =>
                      setShowApiKey(
                        (value) => !value
                      )
                    }
                    disabled={isTesting}
                  >
                    {showApiKey ? "Hide" : "Show"}
                  </button>
                </div>
              </div>

              <div className="settings-field">
                <label
                  className="settings-field__label"
                  htmlFor="claude-model"
                >
                  Model
                </label>

                <input
                  id="claude-model"
                  type="text"
                  className="settings-field__input"
                  placeholder="claude-3-5-sonnet-20241022"
                  value={config.model || ""}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      model: e.target.value,
                    })
                  }
                  disabled={isTesting}
                />
              </div>
            </>
          )}

          {/* =================================================
              OPENAI COMPATIBLE
          ================================================= */}

          {activeType === "openai_compatible" && (
            <>
              <div className="settings-field">
                <label
                  className="settings-field__label"
                  htmlFor="openai-key"
                >
                  API Key
                </label>

                <div className="settings-key-wrapper">
                  <input
                    id="openai-key"
                    type={
                      showApiKey
                        ? "text"
                        : "password"
                    }
                    className="settings-field__input"
                    placeholder="sk-..."
                    value={config.apiKey || ""}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        apiKey: e.target.value,
                      })
                    }
                    disabled={isTesting}
                  />

                  <button
                    type="button"
                    className="settings-key-toggle"
                    onClick={() =>
                      setShowApiKey(
                        (value) => !value
                      )
                    }
                    disabled={isTesting}
                  >
                    {showApiKey ? "Hide" : "Show"}
                  </button>
                </div>
              </div>

              <div className="settings-field">
                <label
                  className="settings-field__label"
                  htmlFor="openai-url"
                >
                  Base Endpoint URL
                </label>

                <input
                  id="openai-url"
                  type="text"
                  className="settings-field__input"
                  placeholder="https://api.openai.com"
                  value={config.baseUrl || ""}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      baseUrl: e.target.value,
                    })
                  }
                  disabled={isTesting}
                />
              </div>

              <div className="settings-field">
                <label
                  className="settings-field__label"
                  htmlFor="openai-model"
                >
                  Model
                </label>

                <input
                  id="openai-model"
                  type="text"
                  className="settings-field__input"
                  placeholder="gpt-4o-mini"
                  value={config.model || ""}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      model: e.target.value,
                    })
                  }
                  disabled={isTesting}
                />
              </div>
            </>
          )}

          {/* =================================================
              GEMINI
          ================================================= */}

          {activeType === "gemini" && (
            <>
              <div className="settings-field">
                <label
                  className="settings-field__label"
                  htmlFor="gemini-key"
                >
                  Gemini API Key
                </label>

                <div className="settings-key-wrapper">
                  <input
                    id="gemini-key"
                    type={
                      showApiKey
                        ? "text"
                        : "password"
                    }
                    className="settings-field__input"
                    placeholder="AIza..."
                    value={config.apiKey || ""}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        apiKey: e.target.value,
                      })
                    }
                    disabled={isTesting}
                  />

                  <button
                    type="button"
                    className="settings-key-toggle"
                    onClick={() =>
                      setShowApiKey(
                        (value) => !value
                      )
                    }
                    disabled={isTesting}
                  >
                    {showApiKey ? "Hide" : "Show"}
                  </button>
                </div>
              </div>

              <div className="settings-field">
                <label
                  className="settings-field__label"
                  htmlFor="gemini-model"
                >
                  Model
                </label>

                <input
                  id="gemini-model"
                  type="text"
                  className="settings-field__input"
                  placeholder="gemini-2.5-flash"
                  value={config.model || ""}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      model: e.target.value,
                    })
                  }
                  disabled={isTesting}
                />
              </div>
            </>
          )}
        </div>

        {/* =====================================================
            FOOTER
        ====================================================== */}

        <div className="settings-modal__footer">

          <button
            type="button"
            className={testButtonClass}
            onClick={handleTestConnection}
            disabled={isTesting}
          >
            {testButtonText}
          </button>

          <button
            type="button"
            className="ghost-button"
            onClick={onClose}
            disabled={isTesting}
          >
            Cancel
          </button>

          <button
            type="button"
            className="primary-button"
            onClick={handleSave}
            disabled={isTesting}
          >
            Save Settings
          </button>

        </div>
      </div>
    </div>
  );
};
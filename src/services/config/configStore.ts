import type { ProviderConfig, ProviderType } from "../ai/types";

const STORAGE_KEY_PREFIX = "lens_config_v1_";
const ACTIVE_PROVIDER_KEY = "lens_active_provider_v1";

const DEFAULT_CONFIGS: Record<ProviderType, ProviderConfig> = {
  mock: {
    type: "mock",
    model: "mock-v1",
  },
  ollama: {
    type: "ollama",
    baseUrl: "http://localhost:11434",
    model: "llama3",
  },
  claude: {
    type: "claude",
    apiKey: "",
    model: "claude-3-5-sonnet-20241022",
  },
  openai_compatible: {
    type: "openai_compatible",
    apiKey: "",
    baseUrl: "https://api.openai.com",
    model: "gpt-4o-mini",
  },
  gemini: {
    type: "gemini",
    apiKey: "",
    model: "gemini-3.6-flash",
  },
};

class ConfigStore {
  private activeProviderType: ProviderType = "mock";
  private configs: Record<ProviderType, ProviderConfig> = { ...DEFAULT_CONFIGS };

  constructor() {
    this.loadFromStorage();
  }

  private loadFromStorage(): void {
    try {
      const savedActive = localStorage.getItem(ACTIVE_PROVIDER_KEY) as ProviderType | null;
      if (savedActive && DEFAULT_CONFIGS[savedActive]) {
        this.activeProviderType = savedActive;
      }

      for (const type of Object.keys(DEFAULT_CONFIGS) as ProviderType[]) {
        const raw = localStorage.getItem(`${STORAGE_KEY_PREFIX}${type}`);
        if (raw) {
          const parsed = JSON.parse(raw);
          this.configs[type] = {
            ...DEFAULT_CONFIGS[type],
            ...parsed,
          };
        }
      }
    } catch {
      // Fallback silently if storage read fails
    }
  }

  getActiveProviderType(): ProviderType {
    return this.activeProviderType;
  }

  setActiveProviderType(type: ProviderType): void {
    if (!DEFAULT_CONFIGS[type]) return;
    this.activeProviderType = type;
    try {
      localStorage.setItem(ACTIVE_PROVIDER_KEY, type);
    } catch {
      // Ignore
    }
  }

  getProviderConfig(type: ProviderType): ProviderConfig {
    return { ...(this.configs[type] || DEFAULT_CONFIGS[type]) };
  }

  getActiveProviderConfig(): ProviderConfig {
    return this.getProviderConfig(this.activeProviderType);
  }

  setProviderConfig(type: ProviderType, configUpdate: Partial<ProviderConfig>): void {
    const current = this.getProviderConfig(type);
    const updated: ProviderConfig = {
      ...current,
      ...configUpdate,
      type,
    };
    this.configs[type] = updated;

    try {
      localStorage.setItem(`${STORAGE_KEY_PREFIX}${type}`, JSON.stringify(updated));
    } catch {
      // Ignore
    }
  }
}

export const configStore = new ConfigStore();

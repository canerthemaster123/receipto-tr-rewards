// ⚠️ QA ONLY – disable before production release
// This configuration file contains feature flags for development and testing

export interface AppConfig {
  ALLOW_DUPLICATE_RECEIPTS: boolean;
}

// Default configuration - all QA flags should be false for production
const defaultConfig: AppConfig = {
  ALLOW_DUPLICATE_RECEIPTS: false,
};

// Get QA configuration from localStorage (for development/testing only)
const getQAConfig = (): Partial<AppConfig> => {
  try {
    const qaConfig = localStorage.getItem('qa-config');
    return qaConfig ? JSON.parse(qaConfig) : {};
  } catch {
    return {};
  }
};

// Save QA configuration to localStorage
export const setQAConfig = (config: Partial<AppConfig>) => {
  try {
    const currentConfig = getQAConfig();
    const newConfig = { ...currentConfig, ...config };
    localStorage.setItem('qa-config', JSON.stringify(newConfig));
  } catch (error) {
    console.warn('Failed to save QA config:', error);
  }
};

// Export the final configuration with QA overrides
export const config: AppConfig = {
  ...defaultConfig,
  ...getQAConfig(),
};
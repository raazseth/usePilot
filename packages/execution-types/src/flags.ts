// Runtime Feature Flags
export interface RuntimeFeatureFlags {
  visionEnabled: boolean
  ocrEnabled: boolean
  desktopEnabled: boolean
  browserEnabled: boolean
  experimental: boolean
}

export const DEFAULT_RUNTIME_FEATURE_FLAGS: RuntimeFeatureFlags = {
  visionEnabled: true,
  ocrEnabled: true,
  desktopEnabled: true,
  browserEnabled: true,
  experimental: false,
}

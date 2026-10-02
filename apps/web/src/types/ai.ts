export type AiCapabilityState = "ready" | "draft" | "paused" | "unavailable";

export interface AiCapability {
  id: string;
  label: string;
  state: AiCapabilityState;
  description: string;
  isDemo: boolean;
  isAvailable: boolean;
}

export interface AiWorkspaceViewModel {
  readinessLabel: string;
  readinessDescription: string;
  isAvailable: false;
  capabilities: AiCapability[];
  auditNote: string;
}

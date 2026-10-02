export type WhatsAppConnectionState = "connected" | "disconnected" | "connecting" | "unknown";

export type WhatsAppBindingState = "bound" | "unbound" | "unknown";

export type GatewayHealth = "healthy" | "degraded" | "unavailable";

export interface WhatsAppCapability {
  available: boolean;
  reason: string | null;
}

export interface WhatsAppViewModel {
  connectionState: WhatsAppConnectionState;
  connectionLabel: string;
  bindingState: WhatsAppBindingState;
  bindingLabel: string;
  phoneNumberMasked: string | null;
  gatewayHealth: GatewayHealth;
  gatewayHealthLabel: string;
  accountIdentifier: string | null;
  lastConnectedAt: string | null;
  lastDisconnectedAt: string | null;
  updatedAt: string | null;
  isOwner: boolean;
  isQrExpected: boolean;
  capabilities: {
    connect: WhatsAppCapability;
    disconnect: WhatsAppCapability;
    refresh: WhatsAppCapability;
  };
}

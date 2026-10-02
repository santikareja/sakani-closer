import type { GatewayStatusResponse } from "./contracts";
import type {
  GatewayHealth,
  WhatsAppBindingState,
  WhatsAppConnectionState,
  WhatsAppViewModel,
} from "../../types/whatsapp";

const unavailableReason = "Kontrol ini hanya tersedia untuk owner workspace.";

function normalizeConnection(
  response: GatewayStatusResponse | null,
): Pick<
  WhatsAppViewModel,
  "connectionState" | "connectionLabel" | "gatewayHealth" | "gatewayHealthLabel" | "isQrExpected"
> {
  const state = response?.connection.state;
  if (!state) {
    return {
      connectionState: "unknown",
      connectionLabel: "Tidak diketahui",
      gatewayHealth: "unavailable",
      gatewayHealthLabel: "Tidak dapat dijangkau",
      isQrExpected: false,
    };
  }

  const health: GatewayHealth =
    state === "transient_error" || state === "auth_error" ? "degraded" : "healthy";
  const healthLabel = health === "degraded" ? "Perlu diperiksa" : "Gateway merespons";

  const map: Record<
    GatewayStatusResponse["connection"]["state"],
    { state: WhatsAppConnectionState; label: string; qr: boolean }
  > = {
    disconnected: { state: "disconnected", label: "Terputus", qr: false },
    connecting: { state: "connecting", label: "Menghubungkan", qr: false },
    qr_ready: { state: "connecting", label: "Menunggu pemindaian QR", qr: true },
    connected: { state: "connected", label: "Terhubung", qr: false },
    logged_out: { state: "disconnected", label: "Sesi WhatsApp keluar", qr: false },
    auth_error: { state: "disconnected", label: "Sesi tidak valid", qr: false },
    transient_error: { state: "unknown", label: "Gangguan koneksi", qr: false },
    stopping: { state: "disconnected", label: "Memutuskan koneksi", qr: false },
  };
  const normalized = map[state];

  return {
    connectionState: normalized.state,
    connectionLabel: normalized.label,
    gatewayHealth: health,
    gatewayHealthLabel: healthLabel,
    isQrExpected: normalized.qr,
  };
}

export function createWhatsAppViewModel(
  response: GatewayStatusResponse | null,
  role: string,
): WhatsAppViewModel {
  const isOwner = role === "owner";
  const connection = normalizeConnection(response);
  const bindingState: WhatsAppBindingState = response?.binding.state ?? "unknown";
  const bindingLabels: Record<WhatsAppBindingState, string> = {
    bound: "Terikat",
    unbound: "Belum terikat",
    unknown: "Tidak diketahui",
  };

  return {
    ...connection,
    bindingState,
    bindingLabel: bindingLabels[bindingState],
    phoneNumberMasked: response?.connection.phoneNumberMasked ?? null,
    accountIdentifier: null,
    lastConnectedAt: null,
    lastDisconnectedAt: null,
    updatedAt: response?.connection.updatedAt ?? null,
    isOwner,
    capabilities: {
      connect: { available: isOwner, reason: isOwner ? null : unavailableReason },
      disconnect: { available: isOwner, reason: isOwner ? null : unavailableReason },
      refresh: { available: isOwner, reason: isOwner ? null : unavailableReason },
    },
  };
}

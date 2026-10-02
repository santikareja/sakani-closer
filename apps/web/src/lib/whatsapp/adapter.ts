import type { WhatsAppStatusResponse } from "./contracts";
import type {
  GatewayHealth,
  WhatsAppBindingState,
  WhatsAppConnectionState,
  WhatsAppViewModel,
} from "../../types/whatsapp";

const unavailableReason = "Kontrol ini hanya tersedia untuk owner workspace.";

function normalizeConnection(
  response: WhatsAppStatusResponse | null,
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
    response.diagnostics.gateway === "unavailable"
      ? "unavailable"
      : response.diagnostics.lifecyclePersistence === "failed"
        ? "degraded"
        : "healthy";
  const healthLabel =
    health === "degraded"
      ? "Perlu diperiksa"
      : health === "unavailable"
        ? "Tidak dapat dijangkau"
        : "Gateway merespons";

  const map: Record<
    WhatsAppStatusResponse["connection"]["state"],
    { state: WhatsAppConnectionState; label: string; qr: boolean }
  > = {
    disconnected: { state: "disconnected", label: "Terputus", qr: false },
    connecting: { state: "connecting", label: "Menghubungkan", qr: false },
    connected: { state: "connected", label: "Terhubung", qr: false },
    unknown: { state: "unknown", label: "Tidak diketahui", qr: false },
  };
  const normalized = map[state];
  const detail = response.connection.detail;

  return {
    connectionState: normalized.state,
    connectionLabel:
      detail === "qr_ready"
        ? "Menunggu pemindaian QR"
        : detail === "logged_out"
          ? "Sesi WhatsApp keluar"
          : detail === "auth_error"
            ? "Sesi tidak valid"
            : detail === "transient_error"
              ? "Gangguan koneksi"
              : normalized.label,
    gatewayHealth: health,
    gatewayHealthLabel: healthLabel,
    isQrExpected: detail === "qr_ready" || normalized.qr,
  };
}

export function createWhatsAppViewModel(
  response: WhatsAppStatusResponse | null,
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
    phoneNumberMasked: response?.account.phoneNumberMasked ?? null,
    accountIdentifier: response?.account.gatewayAccountId ?? null,
    lastConnectedAt: response?.account.lastConnectedAt ?? null,
    lastDisconnectedAt: response?.account.lastDisconnectedAt ?? null,
    updatedAt: response?.account.updatedAt ?? response?.connection.updatedAt ?? null,
    isOwner,
    capabilities: {
      connect: { available: isOwner, reason: isOwner ? null : unavailableReason },
      disconnect: { available: isOwner, reason: isOwner ? null : unavailableReason },
      refresh: { available: isOwner, reason: isOwner ? null : unavailableReason },
    },
  };
}

"use client";

import { ArrowClockwiseIcon } from "@phosphor-icons/react/dist/csr/ArrowClockwise";
import { CheckCircleIcon } from "@phosphor-icons/react/dist/csr/CheckCircle";
import { LinkBreakIcon } from "@phosphor-icons/react/dist/csr/LinkBreak";
import { LockKeyIcon } from "@phosphor-icons/react/dist/csr/LockKey";
import { PlugIcon } from "@phosphor-icons/react/dist/csr/Plug";
import { QrCodeIcon } from "@phosphor-icons/react/dist/csr/QrCode";
import { ShieldCheckIcon } from "@phosphor-icons/react/dist/csr/ShieldCheck";
import { SpinnerGapIcon } from "@phosphor-icons/react/dist/csr/SpinnerGap";
import { WarningCircleIcon } from "@phosphor-icons/react/dist/csr/WarningCircle";
import { WhatsappLogoIcon } from "@phosphor-icons/react/dist/csr/WhatsappLogo";
import QRCode from "qrcode";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { z } from "zod";

import { ConfirmDialog } from "../../../../components/ui/confirm-dialog";
import { StatusBadge } from "../../../../components/ui/status-badge";
import { useToast } from "../../../../components/ui/toast-provider";
import { createWhatsAppViewModel } from "../../../../lib/whatsapp/adapter";
import {
  gatewayErrorResponseSchema,
  gatewayQrResponseSchema,
  whatsappStatusResponseSchema,
  type GatewayQrResponse,
  type WhatsAppStatusResponse,
} from "../../../../lib/whatsapp/contracts";

async function readResponse<T>(response: Response, schema: z.ZodType<T>): Promise<T> {
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const errorPayload = gatewayErrorResponseSchema.safeParse(payload);
    throw new Error(
      errorPayload.success ? errorPayload.data.error.message : "Permintaan WhatsApp gagal.",
    );
  }
  const parsed = schema.safeParse(payload);
  if (!parsed.success) throw new Error("Respons WhatsApp tidak valid.");
  return parsed.data;
}

function formatDateTime(value: string | null): string {
  if (!value) return "Belum tersedia";
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "medium",
    timeZone: "Asia/Jakarta",
  }).format(new Date(value));
}

export function WhatsAppSettingsClient({
  initialStatus,
  role,
}: {
  initialStatus: WhatsAppStatusResponse | null;
  role: string;
}) {
  const { promise: toastPromise } = useToast();
  const [status, setStatus] = useState<WhatsAppStatusResponse | null>(initialStatus);
  const [qr, setQr] = useState<GatewayQrResponse | null>(null);
  const [qrExpired, setQrExpired] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [pendingAction, setPendingAction] = useState<"connect" | "disconnect" | "refresh" | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const statusRequest = useRef<AbortController | null>(null);
  const qrRequest = useRef<AbortController | null>(null);
  const view = useMemo(() => createWhatsAppViewModel(status, role), [role, status]);
  const rawState = status?.connection.detail;

  const loadStatus = useCallback(async (quiet = false) => {
    statusRequest.current?.abort();
    const controller = new AbortController();
    statusRequest.current = controller;
    try {
      const response = await fetch("/api/v1/whatsapp/status", {
        cache: "no-store",
        signal: controller.signal,
      });
      const body = await readResponse(response, whatsappStatusResponseSchema);
      setStatus(body);
      if (!quiet) setError(null);
    } catch (requestError) {
      if (requestError instanceof DOMException && requestError.name === "AbortError") return;
      if (!quiet) setError("Status WhatsApp belum dapat dimuat. Silakan coba lagi.");
    }
  }, []);

  const loadQr = useCallback(async () => {
    qrRequest.current?.abort();
    const controller = new AbortController();
    qrRequest.current = controller;
    try {
      const response = await fetch("/api/v1/whatsapp/qr", {
        cache: "no-store",
        signal: controller.signal,
      });
      const body = await readResponse(response, gatewayQrResponseSchema);
      setQr(body);
      setQrExpired(false);
      setError(null);
    } catch (requestError) {
      if (requestError instanceof DOMException && requestError.name === "AbortError") return;
      setQr(null);
      setError(
        requestError instanceof Error
          ? requestError.message
          : "QR WhatsApp belum dapat ditampilkan.",
      );
    }
  }, []);

  const runMutation = useCallback(
    async (action: "connect" | "disconnect" | "refresh") => {
      setPendingAction(action);
      setError(null);
      if (action !== "disconnect") setQrExpired(false);
      const labels = {
        connect: {
          loading: "Menghubungkan WhatsApp...",
          success: "Permintaan koneksi diterima.",
          error: "Koneksi WhatsApp gagal diproses.",
        },
        disconnect: {
          loading: "Memutuskan koneksi...",
          success: "Koneksi WhatsApp diputus.",
          error: "Koneksi belum dapat diputus.",
        },
        refresh: {
          loading: "Membuat QR baru...",
          success: "Permintaan QR baru diterima.",
          error: "QR baru belum dapat dibuat.",
        },
      } as const;

      const operation = (async () => {
        const response = await fetch(`/api/v1/whatsapp/${action}`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: "{}",
        });
        const body = await readResponse(response, whatsappStatusResponseSchema);
        setStatus(body);
        setQr(null);
        return body;
      })();

      try {
        await toastPromise(operation, labels[action]);
      } catch (requestError) {
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Tindakan WhatsApp gagal diproses.",
        );
      } finally {
        setPendingAction(null);
        setConfirmDisconnect(false);
        void loadStatus(true);
      }
    },
    [loadStatus, toastPromise],
  );

  useEffect(() => {
    if (!initialStatus) void loadStatus();
    const poller = window.setInterval(() => void loadStatus(true), 5_000);
    return () => {
      window.clearInterval(poller);
      statusRequest.current?.abort();
      qrRequest.current?.abort();
    };
  }, [initialStatus, loadStatus]);

  useEffect(() => {
    if (rawState === "qr_ready" && !qr && !qrExpired) void loadQr();
    if (rawState !== "qr_ready") {
      setQr(null);
      setQrExpired(false);
    }
  }, [loadQr, qr, qrExpired, rawState]);

  useEffect(() => {
    if (!qr || !canvasRef.current) return;
    let active = true;
    void QRCode.toCanvas(canvasRef.current, qr.qr, {
      width: 280,
      margin: 2,
      errorCorrectionLevel: "M",
      color: { dark: "#10241c", light: "#fbfcfa" },
    }).catch(() => {
      if (active) setError("QR tidak dapat dirender. Silakan buat QR baru.");
    });
    return () => {
      active = false;
    };
  }, [qr]);

  useEffect(() => {
    if (!qr) {
      setSecondsLeft(0);
      return;
    }
    const updateCountdown = () => {
      const remaining = Math.max(0, Math.ceil((Date.parse(qr.expiresAt) - Date.now()) / 1_000));
      setSecondsLeft(remaining);
      if (remaining === 0) {
        setQr(null);
        setQrExpired(true);
      }
    };
    updateCountdown();
    const timer = window.setInterval(updateCountdown, 1_000);
    return () => window.clearInterval(timer);
  }, [qr]);

  const canConnect =
    view.isOwner &&
    (!rawState ||
      ["disconnected", "logged_out", "auth_error", "transient_error"].includes(rawState));
  const canDisconnect =
    view.isOwner && Boolean(rawState && !["disconnected", "stopping"].includes(rawState));

  return (
    <>
      <section className="whatsapp-status-layout" aria-busy={pendingAction !== null}>
        <article className="whatsapp-primary-card">
          <div className="whatsapp-card-heading">
            <span className="whatsapp-large-icon" aria-hidden="true">
              <WhatsappLogoIcon size={28} weight="fill" />
            </span>
            <div>
              <p>Status koneksi</p>
              <h2>{view.connectionLabel}</h2>
            </div>
            <StatusBadge
              tone={
                view.connectionState === "connected"
                  ? "success"
                  : view.connectionState === "connecting"
                    ? "warning"
                    : view.connectionState === "disconnected"
                      ? "danger"
                      : "neutral"
              }
            >
              {view.connectionLabel}
            </StatusBadge>
          </div>

          <dl className="whatsapp-facts">
            <div>
              <dt>Ikatan akun</dt>
              <dd>{view.bindingLabel}</dd>
            </div>
            <div>
              <dt>Nomor</dt>
              <dd>{view.phoneNumberMasked ?? "Belum tersedia"}</dd>
            </div>
            <div>
              <dt>Kesehatan gateway</dt>
              <dd>{view.gatewayHealthLabel}</dd>
            </div>
            <div>
              <dt>ID akun</dt>
              <dd>{view.accountIdentifier ?? "Belum dikirim backend"}</dd>
            </div>
            <div>
              <dt>Terakhir terhubung</dt>
              <dd>{formatDateTime(view.lastConnectedAt)}</dd>
            </div>
            <div>
              <dt>Terakhir terputus</dt>
              <dd>{formatDateTime(view.lastDisconnectedAt)}</dd>
            </div>
            <div className="whatsapp-fact-wide">
              <dt>Status diperbarui</dt>
              <dd>{formatDateTime(view.updatedAt)}</dd>
            </div>
          </dl>

          {error ? (
            <div className="inline-alert inline-alert-error" role="alert">
              <WarningCircleIcon size={19} aria-hidden="true" />
              <span>{error}</span>
              <button type="button" onClick={() => void loadStatus()}>
                Coba lagi
              </button>
            </div>
          ) : null}

          <div className="whatsapp-actions">
            {canConnect ? (
              <button
                className="button button-primary"
                type="button"
                disabled={pendingAction !== null}
                onClick={() => void runMutation("connect")}
              >
                {pendingAction === "connect" ? (
                  <SpinnerGapIcon className="is-spinning" size={18} aria-hidden="true" />
                ) : (
                  <PlugIcon size={18} aria-hidden="true" />
                )}
                {pendingAction === "connect" ? "Menghubungkan..." : "Hubungkan"}
              </button>
            ) : null}
            <button
              className="button button-secondary"
              type="button"
              disabled={pendingAction !== null || !view.capabilities.refresh.available}
              onClick={() =>
                rawState === "qr_ready" ? void runMutation("refresh") : void loadStatus()
              }
            >
              <ArrowClockwiseIcon
                className={pendingAction === "refresh" ? "is-spinning" : undefined}
                size={18}
                aria-hidden="true"
              />
              {rawState === "qr_ready" ? "Buat QR baru" : "Refresh status"}
            </button>
            {canDisconnect ? (
              <button
                className="button button-danger-subtle"
                type="button"
                disabled={pendingAction !== null}
                onClick={() => setConfirmDisconnect(true)}
              >
                <LinkBreakIcon size={18} aria-hidden="true" />
                Putuskan
              </button>
            ) : null}
          </div>
        </article>

        <aside className="whatsapp-side-stack">
          <article className="settings-note-card">
            <ShieldCheckIcon size={22} aria-hidden="true" />
            <div>
              <h2>Sesi tetap tersimpan</h2>
              <p>
                Memutuskan koneksi tetap mempertahankan sesi terenkripsi. Keluar dari WhatsApp dapat
                meminta QR baru.
              </p>
            </div>
          </article>
          <article className="settings-note-card">
            <LockKeyIcon size={22} aria-hidden="true" />
            <div>
              <h2>Data sensitif terlindungi</h2>
              <p>
                Token, status autentikasi, dan kunci privat tidak pernah ditampilkan di browser.
              </p>
            </div>
          </article>
          {!view.isOwner ? (
            <article className="settings-note-card settings-note-warning">
              <WarningCircleIcon size={22} aria-hidden="true" />
              <div>
                <h2>Akses terbatas</h2>
                <p>Hanya pemilik workspace yang dapat mengubah koneksi WhatsApp.</p>
              </div>
            </article>
          ) : null}
        </aside>
      </section>

      {rawState === "qr_ready" ? (
        <section className="qr-section" aria-live="polite">
          <div className="section-heading-row">
            <div>
              <h2>Pindai QR</h2>
              <p>QR hanya ditampilkan karena gateway secara eksplisit menyediakannya.</p>
            </div>
            <QrCodeIcon size={24} aria-hidden="true" />
          </div>
          <div className="qr-stage">
            {qr ? (
              <>
                <canvas
                  ref={canvasRef}
                  className="qr-canvas"
                  aria-label="QR untuk menghubungkan WhatsApp"
                />
                <div>
                  <p className="qr-countdown">Berlaku selama {secondsLeft} detik</p>
                  <p>
                    Buka Perangkat tertaut di ponsel, lalu pindai QR. Gunakan hanya akun yang
                    disetujui untuk workspace ini.
                  </p>
                </div>
              </>
            ) : (
              <div className="qr-placeholder" aria-busy="true">
                <SpinnerGapIcon className="is-spinning" size={24} aria-hidden="true" />
                <p>
                  {qrExpired
                    ? "QR kedaluwarsa. Buat QR baru untuk melanjutkan."
                    : "Menyiapkan QR aman..."}
                </p>
              </div>
            )}
          </div>
        </section>
      ) : null}

      {view.connectionState === "connected" ? (
        <div className="connection-success" role="status">
          <CheckCircleIcon size={20} weight="fill" aria-hidden="true" />
          <span>Koneksi aktif. Inbox tetap berjalan dalam mode receive-only.</span>
        </div>
      ) : null}

      <ConfirmDialog
        open={confirmDisconnect}
        title="Putuskan koneksi WhatsApp?"
        description="Koneksi aktif akan ditutup. Sesi terenkripsi tetap disimpan kecuali akun keluar dari WhatsApp."
        confirmLabel="Putuskan koneksi"
        pending={pendingAction === "disconnect"}
        onCancel={() => setConfirmDisconnect(false)}
        onConfirm={() => void runMutation("disconnect")}
      />
    </>
  );
}

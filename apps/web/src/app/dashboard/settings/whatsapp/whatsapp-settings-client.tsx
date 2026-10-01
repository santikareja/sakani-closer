"use client";

import QRCode from "qrcode";
import { useCallback, useEffect, useRef, useState } from "react";

import type {
  ConnectionStatus,
  GatewayQrResponse,
  GatewayStatusResponse,
} from "../../../../lib/whatsapp/contracts";

const stateLabels: Record<ConnectionStatus["state"], string> = {
  disconnected: "Terputus",
  connecting: "Menghubungkan",
  qr_ready: "QR siap dipindai",
  connected: "Terhubung",
  logged_out: "Sesi WhatsApp keluar",
  auth_error: "Sesi tidak valid",
  transient_error: "Gangguan jaringan sementara",
  stopping: "Menghentikan koneksi",
};

interface ApiErrorBody {
  error?: { message?: string };
}

async function readResponse<T>(response: Response): Promise<T> {
  const payload = (await response.json()) as T & ApiErrorBody;
  if (!response.ok) {
    throw new Error(payload.error?.message ?? "Permintaan WhatsApp gagal.");
  }
  return payload;
}

export function WhatsAppSettingsClient() {
  const [connection, setConnection] = useState<ConnectionStatus | null>(null);
  const [qr, setQr] = useState<GatewayQrResponse | null>(null);
  const [qrExpired, setQrExpired] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const qrRequestPending = useRef(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const loadStatus = useCallback(async (quiet = false) => {
    try {
      const response = await fetch("/api/v1/whatsapp/status", { cache: "no-store" });
      const body = await readResponse<GatewayStatusResponse>(response);
      setConnection(body.connection);
      if (!quiet) setError(null);
    } catch {
      if (!quiet) setError("Status WhatsApp belum dapat dimuat. Silakan coba lagi.");
    }
  }, []);

  const loadQr = useCallback(async () => {
    if (qrRequestPending.current) return;
    qrRequestPending.current = true;
    try {
      const response = await fetch("/api/v1/whatsapp/qr", { cache: "no-store" });
      const body = await readResponse<GatewayQrResponse>(response);
      setQr(body);
      setQrExpired(false);
      setError(null);
    } catch (requestError) {
      setQr(null);
      setError(
        requestError instanceof Error
          ? requestError.message
          : "QR WhatsApp belum dapat ditampilkan.",
      );
    } finally {
      qrRequestPending.current = false;
    }
  }, []);

  const runMutation = useCallback(
    async (action: "connect" | "disconnect" | "refresh") => {
      setPendingAction(action);
      setError(null);
      if (action !== "disconnect") setQrExpired(false);
      try {
        const response = await fetch(`/api/v1/whatsapp/${action}`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: "{}",
        });
        const body = await readResponse<GatewayStatusResponse>(response);
        setConnection(body.connection);
        setQr(null);
      } catch (requestError) {
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Tindakan WhatsApp gagal diproses.",
        );
      } finally {
        setPendingAction(null);
        void loadStatus(true);
      }
    },
    [loadStatus],
  );

  useEffect(() => {
    void loadStatus();
    const poller = window.setInterval(() => void loadStatus(true), 3_000);
    return () => window.clearInterval(poller);
  }, [loadStatus]);

  useEffect(() => {
    if (connection?.state === "qr_ready" && !qr && !qrExpired) void loadQr();
    if (connection?.state !== "qr_ready") {
      setQr(null);
      setQrExpired(false);
    }
  }, [connection?.state, loadQr, qr, qrExpired]);

  useEffect(() => {
    if (!qr || !canvasRef.current) return;
    let active = true;
    void QRCode.toCanvas(canvasRef.current, qr.qr, {
      width: 280,
      margin: 2,
      errorCorrectionLevel: "M",
      color: { dark: "#18231d", light: "#fffdf8" },
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

  const state = connection?.state;
  const canConnect =
    !state || ["disconnected", "logged_out", "auth_error", "transient_error"].includes(state);
  const canDisconnect = state && !["disconnected", "stopping"].includes(state);

  return (
    <section className="whatsapp-panel" aria-labelledby="whatsapp-status-title">
      <div className="whatsapp-status-heading">
        <div>
          <p className="card-label">Status koneksi</p>
          <h2 id="whatsapp-status-title">
            {connection ? stateLabels[connection.state] : "Memuat status"}
          </h2>
        </div>
        <span
          className={`connection-indicator connection-${state ?? "loading"}`}
          aria-hidden="true"
        />
      </div>

      <dl className="whatsapp-metadata">
        <div>
          <dt>Nomor</dt>
          <dd>{connection?.phoneNumberMasked ?? "Belum tersedia"}</dd>
        </div>
        <div>
          <dt>Diperbarui</dt>
          <dd>
            {connection
              ? new Intl.DateTimeFormat("id-ID", {
                  dateStyle: "medium",
                  timeStyle: "medium",
                }).format(new Date(connection.updatedAt))
              : "—"}
          </dd>
        </div>
      </dl>

      {error ? (
        <p className="notice error-notice" role="alert">
          {error}
        </p>
      ) : null}

      {state === "qr_ready" ? (
        <div className="qr-stage" aria-live="polite">
          {qr ? (
            <>
              <canvas
                ref={canvasRef}
                className="qr-canvas"
                aria-label="QR untuk menghubungkan WhatsApp"
              />
              <p className="qr-countdown">Berlaku selama {secondsLeft} detik</p>
              <p className="qr-instruction">
                Di ponsel test, buka Perangkat tertaut lalu pindai QR ini. Jangan gunakan nomor
                utama.
              </p>
            </>
          ) : (
            <p className="qr-placeholder">
              {qrExpired
                ? "QR sudah kedaluwarsa. Buat QR baru untuk melanjutkan."
                : "Menyiapkan QR aman…"}
            </p>
          )}
        </div>
      ) : null}

      <div className="whatsapp-actions">
        {canConnect ? (
          <button
            className="primary-action"
            type="button"
            disabled={pendingAction !== null}
            onClick={() => void runMutation("connect")}
          >
            {pendingAction === "connect" ? "Menghubungkan…" : "Hubungkan WhatsApp"}
          </button>
        ) : null}
        {state === "qr_ready" ? (
          <button
            className="secondary-action"
            type="button"
            disabled={pendingAction !== null}
            onClick={() => void runMutation("refresh")}
          >
            {pendingAction === "refresh" ? "Membuat QR…" : "Buat QR baru"}
          </button>
        ) : null}
        {canDisconnect ? (
          <button
            className="danger-action"
            type="button"
            disabled={pendingAction !== null}
            onClick={() => void runMutation("disconnect")}
          >
            {pendingAction === "disconnect" ? "Memutuskan…" : "Putuskan koneksi"}
          </button>
        ) : null}
      </div>

      <p className="whatsapp-policy">
        Memutuskan koneksi menutup socket aktif tetapi mempertahankan session terenkripsi. Logout
        dari aplikasi WhatsApp akan membatalkan session dan memerlukan QR baru.
      </p>
    </section>
  );
}

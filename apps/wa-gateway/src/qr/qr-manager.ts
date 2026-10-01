export interface QrSnapshot {
  qr: string;
  expiresAt: string;
}

interface StoredQr {
  value: string;
  expiresAtMs: number;
}

export class QrManager {
  private current: StoredQr | undefined;

  constructor(
    private readonly ttlMs = 60_000,
    private readonly now: () => number = Date.now,
  ) {
    if (!Number.isInteger(ttlMs) || ttlMs < 1_000 || ttlMs > 120_000) {
      throw new RangeError("QR TTL must be between 1000 and 120000 milliseconds");
    }
  }

  publish(value: string): void {
    if (value.length < 1 || value.length > 8_192) {
      throw new TypeError("Invalid QR payload");
    }

    this.current = { value, expiresAtMs: this.now() + this.ttlMs };
  }

  get(): QrSnapshot | undefined {
    if (!this.current) return undefined;

    if (this.current.expiresAtMs <= this.now()) {
      this.clear();
      return undefined;
    }

    return {
      qr: this.current.value,
      expiresAt: new Date(this.current.expiresAtMs).toISOString(),
    };
  }

  clear(): void {
    this.current = undefined;
  }
}

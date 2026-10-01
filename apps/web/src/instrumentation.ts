import { getWebEnv } from "@sakani/config";

export async function register(): Promise<void> {
  if (
    process.env.NEXT_RUNTIME === "nodejs" &&
    process.env.NEXT_PHASE !== "phase-production-build"
  ) {
    getWebEnv();
  }
}

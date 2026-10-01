export function isSameOriginMutation(request: Request, applicationUrl: string): boolean {
  const origin = request.headers.get("origin");
  if (!origin) {
    return false;
  }

  try {
    return new URL(origin).origin === new URL(applicationUrl).origin;
  } catch {
    return false;
  }
}

export function getSafeRedirectPath(value: unknown, fallback = "/dashboard"): string {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) {
    return fallback;
  }

  try {
    const baseUrl = new URL("https://sakani.invalid");
    const destination = new URL(value, baseUrl);
    if (destination.origin !== baseUrl.origin) {
      return fallback;
    }
    return `${destination.pathname}${destination.search}${destination.hash}`;
  } catch {
    return fallback;
  }
}

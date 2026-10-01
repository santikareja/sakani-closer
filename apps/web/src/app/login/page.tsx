import Link from "next/link";
import { redirect } from "next/navigation";

import { getCurrentSession } from "../../lib/auth/dal";
import { getSafeRedirectPath } from "../../lib/auth/http";

export const dynamic = "force-dynamic";

const errorMessages: Record<string, string> = {
  credentials: "Email atau kata sandi tidak valid.",
  "rate-limited": "Terlalu banyak percobaan. Tunggu beberapa menit lalu coba lagi.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (await getCurrentSession()) {
    redirect("/dashboard");
  }

  const params = await searchParams;
  const errorCode = typeof params.error === "string" ? params.error : "";
  const nextPath = getSafeRedirectPath(params.next);
  const loggedOut = params.status === "logged-out";

  return (
    <main className="auth-shell">
      <section className="auth-card" aria-labelledby="login-title">
        <p className="eyebrow">Akses owner</p>
        <h1 id="login-title">Masuk ke Sakani Closer</h1>
        <p className="auth-intro">Gunakan akun owner untuk membuka dashboard workspace Anda.</p>

        {loggedOut ? <p className="notice success-notice">Anda berhasil keluar.</p> : null}
        {errorMessages[errorCode] ? (
          <p className="notice error-notice" role="alert">
            {errorMessages[errorCode]}
          </p>
        ) : null}

        <form className="auth-form" action="/api/auth/login" method="post">
          <input type="hidden" name="next" value={nextPath} />
          <label>
            Email
            <input
              autoComplete="email"
              inputMode="email"
              maxLength={320}
              name="email"
              required
              type="email"
            />
          </label>
          <label>
            Kata sandi
            <input
              autoComplete="current-password"
              maxLength={128}
              minLength={12}
              name="password"
              required
              type="password"
            />
          </label>
          <button className="primary-action" type="submit">
            Masuk
          </button>
        </form>

        <p className="auth-switch">
          Belum punya akun? <Link href="/daftar">Buat akun owner</Link>
        </p>
      </section>
    </main>
  );
}

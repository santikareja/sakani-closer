import Link from "next/link";
import { redirect } from "next/navigation";

import { getCurrentSession } from "../../lib/auth/dal";

export const dynamic = "force-dynamic";

export default async function RegistrationPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (await getCurrentSession()) {
    redirect("/dashboard");
  }

  const params = await searchParams;
  const hasError = typeof params.error === "string";

  return (
    <main className="auth-shell">
      <section className="auth-card" aria-labelledby="registration-title">
        <p className="eyebrow">Workspace baru</p>
        <h1 id="registration-title">Buat akun owner</h1>
        <p className="auth-intro">
          Akun dan workspace dibuat bersama agar data setiap workspace tetap terisolasi.
        </p>

        {hasError ? (
          <p className="notice error-notice" role="alert">
            Akun belum dapat dibuat. Periksa data atau gunakan email lain.
          </p>
        ) : null}

        <form className="auth-form" action="/api/auth/register" method="post">
          <label>
            Nama owner
            <input autoComplete="name" maxLength={120} minLength={2} name="displayName" required />
          </label>
          <label>
            Nama workspace
            <input maxLength={120} minLength={2} name="workspaceName" required />
          </label>
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
              aria-describedby="password-help"
              autoComplete="new-password"
              maxLength={128}
              minLength={12}
              name="password"
              required
              type="password"
            />
          </label>
          <p className="field-help" id="password-help">
            Gunakan minimal 12 karakter. Panjang maksimum 128 karakter.
          </p>
          <button className="primary-action" type="submit">
            Buat akun
          </button>
        </form>

        <p className="auth-switch">
          Sudah punya akun? <Link href="/login">Masuk</Link>
        </p>
      </section>
    </main>
  );
}

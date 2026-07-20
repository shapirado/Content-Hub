"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });
    setLoading(false);
    if (res?.error) {
      setError("פרטי ההתחברות שגויים");
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-xl border border-outline-variant bg-surface-container p-8 shadow-sm"
      >
        <h1 className="mb-1 text-headline-sm font-headline-sm text-on-surface">
          Content Hub
        </h1>
        <p className="mb-6 text-sm text-on-surface-variant">התחברות לצוות</p>

        <label className="mb-1 block text-xs font-bold text-on-surface-variant">
          אימייל
        </label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mb-4 w-full rounded border border-outline-variant bg-surface-container-low px-4 py-2 text-sm text-on-surface focus:border-primary focus:outline-none"
        />

        <label className="mb-1 block text-xs font-bold text-on-surface-variant">
          סיסמה
        </label>
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mb-4 w-full rounded border border-outline-variant bg-surface-container-low px-4 py-2 text-sm text-on-surface focus:border-primary focus:outline-none"
        />

        {error && <p className="mb-4 text-xs font-bold text-error">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded bg-primary px-6 py-2 text-sm font-bold text-on-primary shadow transition-all hover:shadow-lg disabled:opacity-60"
        >
          {loading ? "מתחברת..." : "התחברות"}
        </button>
      </form>
    </div>
  );
}

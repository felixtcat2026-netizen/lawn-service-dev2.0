"use client";

import { useActionState } from "react";
import { signIn } from "@/lib/actions/auth";

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(signIn, { error: null });

  return (
    <main className="flex min-h-screen items-center justify-center bg-(--color-bg) px-4">
      <form
        action={formAction}
        className="w-full max-w-sm rounded-2xl bg-(--color-surface) p-6 shadow-sm"
      >
        <h1 className="mb-1 text-2xl font-semibold">Lawn Service</h1>
        <p className="mb-6 text-sm text-gray-600">Owner sign in</p>

        <label className="mb-1 block text-sm font-medium" htmlFor="email">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="username"
          className="mb-4 w-full rounded-lg border border-(--color-border) px-4 py-3 text-base"
        />

        <label className="mb-1 block text-sm font-medium" htmlFor="password">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="mb-4 w-full rounded-lg border border-(--color-border) px-4 py-3 text-base"
        />

        {state.error && (
          <p role="alert" className="mb-4 text-sm text-(--color-danger)">
            {state.error}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-lg bg-(--color-primary) px-4 py-3 text-base font-semibold text-white disabled:opacity-60"
        >
          {pending ? "Signing in..." : "Sign in"}
        </button>
      </form>
    </main>
  );
}

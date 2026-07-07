"use client";

// Access gate for /control-room. Real auth: Supabase email + password sign-in
// (no magic link, so it never touches Supabase's rate-limited email). Once
// signed in, the whole control room mounts AND every Supabase read carries the
// admin's JWT (see supabase-auth.ts -> setSupabaseAccessToken), so reads work
// under RLS where the publishable/anon key is INSERT-only. Access is whoever
// the project owner creates under Supabase Auth -> Users (with a password);
// public signup is disabled in the dashboard, so there is no self-serve access.
//
// Feature-flagged rollout. Until NEXT_PUBLIC_CONTROL_ROOM_AUTH=1 is set on a
// deployment, the gate stays fully open (renders children, reads use the anon
// key) exactly as before this migration - so the login can ship without risking
// an admin lockout before the Supabase side (authenticated-SELECT RLS + admin
// users) is ready. Flip the env var per environment once ready; the next build
// then enforces the password login.
//
// If Supabase isn't configured (a creds-less demo fork) the gate also opens -
// there's nothing to protect and dashboards just show sample data.

import { useEffect, useState, type FormEvent } from "react";
import type { Session } from "@supabase/supabase-js";
import { authClient } from "@/lib/supabase-auth";
import { setSupabaseAccessToken } from "@/lib/supabase";

const AUTH_ENFORCED = process.env.NEXT_PUBLIC_CONTROL_ROOM_AUTH === "1";

export function ControlRoomGate({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [noAuth, setNoAuth] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    // Rollout flag off (or Supabase unconfigured) -> stay open, no login.
    if (!AUTH_ENFORCED) {
      setNoAuth(true);
      setReady(true);
      return;
    }
    const client = authClient();
    if (!client) {
      setNoAuth(true);
      setReady(true);
      return;
    }
    let active = true;
    client.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setSupabaseAccessToken(data.session?.access_token ?? null);
      setReady(true);
    });
    const { data: sub } = client.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setSupabaseAccessToken(s?.access_token ?? null);
      setReady(true);
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  async function signIn(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    setSubmitting(true);
    const client = authClient();
    if (!client) {
      setErr("Auth is not configured for this environment.");
      setSubmitting(false);
      return;
    }
    const { error } = await client.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setSubmitting(false);
    // On success onAuthStateChange fires, sets the session, and the gate opens.
    if (error) setErr(error.message);
  }

  async function signOut() {
    await authClient()?.auth.signOut();
    setSession(null);
    setSupabaseAccessToken(null);
    setPassword("");
  }

  if (!ready) return null;

  if (noAuth || session) {
    return (
      <>
        {children}
        {session && (
          <button
            type="button"
            onClick={signOut}
            title={`Signed in as ${session.user.email ?? "admin"} - sign out`}
            style={{
              position: "fixed",
              left: 12,
              bottom: 12,
              zIndex: 60,
              padding: "6px 10px",
              borderRadius: 8,
              border: "1px solid #3a3833",
              background: "#1a1917",
              color: "#9a9892",
              fontSize: 11.5,
              fontFamily: "system-ui, sans-serif",
              cursor: "pointer",
            }}
          >
            Sign out
          </button>
        )}
      </>
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        background: "#0f0f0e",
        padding: 24,
      }}
    >
      <form
        onSubmit={signIn}
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 12,
          width: 288,
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <label style={{ color: "#9a9892", fontSize: 13 }}>
          Control Room access
        </label>
        <input
          type="email"
          autoFocus
          required
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@harvest.finance"
          aria-label="Admin email"
          style={{
            padding: "10px 12px",
            borderRadius: 8,
            border: "1px solid #3a3833",
            background: "#1a1917",
            color: "#f4f4f1",
            fontSize: 14,
            outline: "none",
          }}
        />
        <input
          type="password"
          required
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          aria-label="Admin password"
          style={{
            padding: "10px 12px",
            borderRadius: 8,
            border: "1px solid #3a3833",
            background: "#1a1917",
            color: "#f4f4f1",
            fontSize: 14,
            outline: "none",
          }}
        />
        <button
          type="submit"
          disabled={submitting}
          style={{
            padding: "10px 12px",
            borderRadius: 8,
            border: 0,
            background: "#ffb936",
            color: "#191717",
            fontWeight: 600,
            fontSize: 14,
            cursor: submitting ? "progress" : "pointer",
            opacity: submitting ? 0.7 : 1,
          }}
        >
          {submitting ? "Signing in…" : "Sign in"}
        </button>
        {err && (
          <span style={{ color: "#e5484d", fontSize: 12 }}>{err}</span>
        )}
      </form>
    </div>
  );
}

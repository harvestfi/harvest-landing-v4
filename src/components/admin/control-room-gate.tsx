"use client";

// Access gate for /control-room. Real auth now, not a passphrase: a Supabase
// Auth magic-link sign-in. Once signed in, the whole control room mounts AND
// every Supabase read carries the admin's JWT (see supabase-auth.ts ->
// setSupabaseAccessToken), so it works under RLS where the publishable key is
// INSERT-only. Access is whoever exists in the project's Supabase Auth users
// (shouldCreateUser:false - the magic link only works for provisioned admins).
//
// If Supabase isn't configured (a creds-less demo fork), there's nothing to
// protect - reads return empty and the dashboards show sample data - so the
// gate opens rather than locking out an env with no real data.

import { useEffect, useState, type FormEvent } from "react";
import type { Session } from "@supabase/supabase-js";
import { authClient } from "@/lib/supabase-auth";
import { setSupabaseAccessToken } from "@/lib/supabase";

// Feature-flagged rollout. Until NEXT_PUBLIC_CONTROL_ROOM_AUTH=1 is set on a
// deployment, the gate stays fully open (renders children, reads use the anon
// key) exactly as before this migration. This lets the login code ship without
// risking an admin lockout before the Supabase side is configured: an
// authenticated-SELECT RLS policy on the read tables, the redirect URL in the
// Auth allowlist, and the admin's email added to Auth -> Users. Flip the env
// var per-environment (v4-one first, then harvestfi) once all three are in
// place; the very next build then enforces the magic-link login.
const AUTH_ENFORCED = process.env.NEXT_PUBLIC_CONTROL_ROOM_AUTH === "1";

export function ControlRoomGate({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [noAuth, setNoAuth] = useState(false);
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
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

  async function sendLink(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    setSending(true);
    const client = authClient();
    if (!client) {
      setErr("Auth is not configured for this environment.");
      setSending(false);
      return;
    }
    const { error } = await client.auth.signInWithOtp({
      email: email.trim(),
      options: {
        shouldCreateUser: false,
        emailRedirectTo: `${window.location.origin}/control-room`,
      },
    });
    setSending(false);
    if (error) setErr(error.message);
    else setSent(true);
  }

  async function signOut() {
    await authClient()?.auth.signOut();
    setSession(null);
    setSupabaseAccessToken(null);
    setSent(false);
    setEmail("");
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
        onSubmit={sendLink}
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
        {sent ? (
          <p style={{ color: "#c9c7c1", fontSize: 13, lineHeight: 1.5 }}>
            Check <strong style={{ color: "#f4f4f1" }}>{email}</strong> for a
            sign-in link. Open it in this browser to enter.
          </p>
        ) : (
          <>
            <input
              type="email"
              autoFocus
              required
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
            <button
              type="submit"
              disabled={sending}
              style={{
                padding: "10px 12px",
                borderRadius: 8,
                border: 0,
                background: "#ffb936",
                color: "#191717",
                fontWeight: 600,
                fontSize: 14,
                cursor: sending ? "progress" : "pointer",
                opacity: sending ? 0.7 : 1,
              }}
            >
              {sending ? "Sending…" : "Send magic link"}
            </button>
          </>
        )}
        {err && (
          <span style={{ color: "#e5484d", fontSize: 12 }}>{err}</span>
        )}
      </form>
    </div>
  );
}

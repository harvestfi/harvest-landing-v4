"use client";

// Lightweight access gate for the /control-room panel. Renders a passphrase
// prompt and only mounts the dashboards once it matches. The passphrase is
// never stored in source - only its SHA-256 is. This is obscurity for the
// dashboard UI, not real security: the underlying analytics are governed by
// Supabase row-level security, and a static client gate can be bypassed by a
// determined user. For real protection put the route behind edge auth
// (e.g. host-level password protection).

import { useEffect, useState, type FormEvent } from "react";

const SESSION_KEY = "cr_auth";
const EXPECTED =
  "5873102fa0951713a81154785217660a3a116274481a19fb2eea5c56182f4860";
// Remembered logins live in localStorage so the operator isn't asked
// for the passphrase on every visit (sessionStorage died with the
// tab). The stored record carries the passphrase HASH + a timestamp:
// rotating the passphrase invalidates every remembered session, and
// the record self-expires after 30 days.
const REMEMBER_MS = 30 * 24 * 60 * 60 * 1000;

function readRemembered(): boolean {
  try {
    // Legacy per-tab flag from the sessionStorage era.
    if (sessionStorage.getItem(SESSION_KEY) === "1") return true;
  } catch {
    /* ignore */
  }
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return false;
    const rec = JSON.parse(raw) as { h?: string; t?: number };
    return (
      rec.h === EXPECTED &&
      typeof rec.t === "number" &&
      Date.now() - rec.t < REMEMBER_MS
    );
  } catch {
    return false;
  }
}

function writeRemembered(): void {
  try {
    localStorage.setItem(
      SESSION_KEY,
      JSON.stringify({ h: EXPECTED, t: Date.now() }),
    );
  } catch {
    /* ignore - fall back to in-memory auth for this view */
  }
}

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(input),
  );
  return [...new Uint8Array(buf)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function ControlRoomGate({ children }: { children: React.ReactNode }) {
  const [authed, setAuthed] = useState(false);
  const [ready, setReady] = useState(false);
  const [value, setValue] = useState("");
  const [error, setError] = useState(false);

  useEffect(() => {
    if (readRemembered()) setAuthed(true);
    setReady(true);
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(false);
    const hex = await sha256Hex(value);
    if (hex === EXPECTED) {
      writeRemembered();
      setAuthed(true);
    } else {
      setError(true);
      setValue("");
    }
  }

  // Default locked: never render the dashboards until the check resolves.
  if (!ready) return null;
  if (authed) return <>{children}</>;

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
        onSubmit={onSubmit}
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 12,
          width: 264,
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <label style={{ color: "#9a9892", fontSize: 13 }}>Access</label>
        <input
          type="password"
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          aria-label="Passphrase"
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
          style={{
            padding: "10px 12px",
            borderRadius: 8,
            border: 0,
            background: "#ffb936",
            color: "#191717",
            fontWeight: 600,
            fontSize: 14,
            cursor: "pointer",
          }}
        >
          Enter
        </button>
        {error && (
          <span style={{ color: "#e5484d", fontSize: 12 }}>Incorrect.</span>
        )}
      </form>
    </div>
  );
}

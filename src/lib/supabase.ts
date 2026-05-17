// Lightweight Supabase REST client. Uses raw fetch so we don't ship
// the @supabase/supabase-js SDK to every page (saves ~200KB of bundle).
// Both helpers run client-side; the anon key + URL are public-config
// by design (NEXT_PUBLIC_* env vars get inlined into the bundle).

export const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

function configured(): boolean {
  return !!SUPABASE_URL && !!SUPABASE_ANON_KEY;
}

export async function supabaseInsert(
  table: string,
  row: Record<string, unknown>,
): Promise<void> {
  if (!configured()) return;
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify(row),
      // keepalive lets the request finish even if the user navigates
      // away mid-flight (common on first pageview tracking calls).
      keepalive: true,
    });
  } catch {
    // analytics insert is best-effort; never break the page.
  }
}

export async function supabaseSelect<T>(
  table: string,
  params: string = "",
): Promise<T[]> {
  if (!configured()) return [];
  try {
    const url = `${SUPABASE_URL}/rest/v1/${table}${params ? "?" + params : ""}`;
    const r = await fetch(url, {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
    });
    if (!r.ok) return [];
    return (await r.json()) as T[];
  } catch {
    return [];
  }
}

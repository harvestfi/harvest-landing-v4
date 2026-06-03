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

// Delete rows matching a PostgREST filter (e.g. "slug=eq.foo"). Used by
// the admin Hide panel to un-hide a product. Best-effort, like insert.
export async function supabaseDelete(
  table: string,
  filter: string,
): Promise<boolean> {
  if (!configured()) return false;
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${filter}`, {
      method: "DELETE",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        Prefer: "return=minimal",
      },
    });
    return r.ok;
  } catch {
    return false;
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

// Paginated full-table fetch. PostgREST hard-caps a single response
// at 1000 rows, so for tables that have grown past that we need to
// page through with the Range header. Caller passes the same
// query-string they'd pass to supabaseSelect (select / order /
// filters); pagination is handled here.
//
// hardLimit caps total rows pulled so a runaway table can't lock
// the page. Defaults to 100k which is plenty for any analytics
// surface and cheap to filter client-side.
export async function supabaseSelectAll<T>(
  table: string,
  params: string = "",
  chunk = 1000,
  hardLimit = 100_000,
): Promise<T[]> {
  if (!configured()) return [];
  const all: T[] = [];
  for (let from = 0; from < hardLimit; from += chunk) {
    const to = from + chunk - 1;
    try {
      const url = `${SUPABASE_URL}/rest/v1/${table}${params ? "?" + params : ""}`;
      const r = await fetch(url, {
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          Range: `${from}-${to}`,
          "Range-Unit": "items",
        },
      });
      if (!r.ok) break;
      const batch = (await r.json()) as T[];
      if (!Array.isArray(batch) || batch.length === 0) break;
      all.push(...batch);
      if (batch.length < chunk) break;
    } catch {
      break;
    }
  }
  return all;
}

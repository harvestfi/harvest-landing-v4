// Shared visual primitives for the three Master Rules handouts at
// /admin/master-rules/{autocompounder,autopilot,lp-pair}. Each handout
// is meant to be readable as a standalone document (so a fresh AI
// reading just one page can rebuild the corresponding product page
// from scratch); these helpers just keep the layout consistent across
// them without forcing the reader to follow imports.

export function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      className="mb-12 scroll-mt-20 border-t border-gray-200 pt-8 text-sm leading-relaxed text-gray-700"
    >
      <h2 className="mb-4 text-lg font-semibold text-gray-900">{title}</h2>
      {children}
    </section>
  );
}

export function CodeBlock({ children }: { children: string }) {
  return (
    <pre className="mt-3 overflow-x-auto rounded-md border border-gray-200 bg-gray-50 p-4 font-mono text-xs leading-relaxed text-gray-800">
      {children}
    </pre>
  );
}

export function SourceLink({ path, symbol }: { path: string; symbol?: string }) {
  return (
    <p className="mt-3 font-mono text-xs text-gray-500">
      Source: <span className="text-gray-700">{path}</span>
      {symbol ? <span className="text-gray-500"> → {symbol}</span> : null}
    </p>
  );
}

export function TableOfContents({
  items,
}: {
  items: readonly (readonly [string, string])[];
}) {
  return (
    <nav className="mb-10 rounded-lg border border-gray-200 bg-gray-50 p-5">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-600">
        Contents
      </p>
      <ol className="grid grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-2">
        {items.map(([id, label]) => (
          <li key={id}>
            <a
              href={`#${id}`}
              className="text-sm text-gray-700 underline-offset-2 hover:text-gray-900 hover:underline"
            >
              {label}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}

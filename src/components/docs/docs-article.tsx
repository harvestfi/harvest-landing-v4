import Link from "next/link";
import type { DocsNavItem, DocsPage } from "@/lib/docs";
import { getDocsHtml, getDocsNav } from "@/lib/docs";
import { DocsClient } from "@/components/docs/docs-client";

const ICONS: Record<string, React.ReactNode> = {
  start: <path d="M5 12h14M13 6l6 6-6 6" />,
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5M12 8h.01" />
    </>
  ),
  gear: (
    <>
      <path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12" />
      <circle cx="16" cy="6" r="2" />
      <circle cx="10" cy="12" r="2" />
      <circle cx="18" cy="18" r="2" />
    </>
  ),
  book: (
    <>
      <path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z" />
      <path d="M4 19V5" />
    </>
  ),
  scale: (
    <>
      <path d="M12 3v18M7 21h10M5 7h14" />
      <path d="M5 7l-3 7a3 3 0 0 0 6 0zM19 7l-3 7a3 3 0 0 0 6 0z" />
    </>
  ),
};

function NavTree({ items, current, level }: { items: DocsNavItem[]; current: string; level: number }) {
  return (
    <ul className={`docs-nav-l${level}`}>
      {items.map((item) => {
        const isCurrent = item.path === current;
        const open = isCurrent || current.startsWith(item.path + "/");
        const hasChildren = !!item.children?.length;
        return (
          <li key={item.path} className={`${open ? "open" : ""}${isCurrent ? " current" : ""}`}>
            <div className="docs-nav-row">
              <Link href={item.path} aria-current={isCurrent ? "page" : undefined}>
                {item.title}
              </Link>
              {hasChildren && (
                <button className="docs-tw" type="button" aria-label={`Expand: ${item.title}`} aria-expanded={open}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                    <path d="m9 6 6 6-6 6" />
                  </svg>
                </button>
              )}
            </div>
            {hasChildren && <NavTree items={item.children!} current={current} level={level + 1} />}
          </li>
        );
      })}
    </ul>
  );
}

export function DocsArticle({ page }: { page: DocsPage }) {
  const html = getDocsHtml(page);
  const nav = getDocsNav();
  return (
    <div className="docs-shell">
      <button className="docs-menu-btn" type="button" aria-controls="docs-sidebar" aria-expanded="false">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M4 7h16M4 12h16M4 17h16" />
        </svg>
        Docs menu
      </button>
      <aside className="docs-sidebar" id="docs-sidebar" aria-label="Documentation">
        {nav.map((s) => (
          <section className="docs-nav-sec" key={s.section}>
            <div className="docs-nav-sec-h">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                {ICONS[s.icon]}
              </svg>
              {s.section}
            </div>
            <NavTree items={s.items} current={page.path} level={0} />
          </section>
        ))}
      </aside>
      <main className="docs-content">
        {page.breadcrumbs.length > 0 && (
          <nav className="docs-crumbs" aria-label="Breadcrumb">
            {page.breadcrumbs.map((b, i) => (
              <span key={b.path}>
                {i > 0 && <span className="docs-crumbs-sep">/</span>}
                <Link href={b.path}>{b.title}</Link>
              </span>
            ))}
          </nav>
        )}
        <article className="docs-doc" dangerouslySetInnerHTML={{ __html: html }} />
        <nav className="docs-pager" aria-label="Previous and next page">
          {page.prev ? (
            <Link className="docs-pv" href={page.prev.path}>
              <small>Previous</small>
              <b>{page.prev.title}</b>
            </Link>
          ) : (
            <span />
          )}
          {page.next && (
            <Link className="docs-nx" href={page.next.path}>
              <small>Next</small>
              <b>{page.next.title}</b>
            </Link>
          )}
        </nav>
        <p className="docs-md-link">
          <a href={page.markdown_url.replace("https://harvest.finance", "")}>View as Markdown</a>
        </p>
      </main>
      <aside className="docs-toc" aria-label="On this page">
        {page.toc.length > 1 && (
          <>
            <div className="docs-toc-k">On this page</div>
            <ul>
              {page.toc.map((t) => (
                <li key={t.id} className={`d${t.depth}`}>
                  <a href={`#${t.id}`}>{t.text}</a>
                </li>
              ))}
            </ul>
          </>
        )}
      </aside>
      <DocsClient />
    </div>
  );
}

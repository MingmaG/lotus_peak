import Link from 'next/link'
import { JOURNAL_CATEGORIES, type JournalCategory } from '@lotuspeak/api-contracts'

/**
 * The journal's four shelves, as the design's underline tabs.
 *
 * Links rather than the `Tabs` component's buttons: each shelf is a page of
 * its own at `/journal/category/…`, prerendered, with its own title and its
 * own place in the sitemap. A tab that filtered in the browser would be one
 * URL a crawler can see and four lists it cannot.
 */
export function ShelfNav({ current }: { current: JournalCategory | null }) {
  const items = [{ key: null, label: 'Everything', href: '/journal' }, ...JOURNAL_CATEGORIES.map((c) => ({
    key: c.key,
    label: c.label,
    href: `/journal/category/${c.key}`,
  }))]

  return (
    <nav aria-label="Journal shelves">
      <ul
        style={{
          listStyle: 'none',
          margin: 0,
          padding: 0,
          display: 'flex',
          gap: 32,
          flexWrap: 'wrap',
          borderBottom: '1px solid var(--border-hairline)',
        }}
      >
        {items.map((item) => {
          const on = item.key === current
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={on ? 'page' : undefined}
                style={{
                  display: 'block',
                  borderBottom: `1px solid ${on ? 'var(--ink)' : 'transparent'}`,
                  marginBottom: -1,
                  padding: '12px 0',
                  fontSize: 'var(--text-label)',
                  letterSpacing: 'var(--tracking-nav)',
                  textTransform: 'uppercase',
                  textDecoration: 'none',
                  color: on ? 'var(--ink)' : 'var(--text-muted)',
                  transition:
                    'color var(--dur-quick) var(--ease-breath),border-color var(--dur-quick) var(--ease-breath)',
                }}
              >
                {item.label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

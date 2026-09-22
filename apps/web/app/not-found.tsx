import { Button, Eyebrow } from '@/design-system'
import { NotFoundBeacon } from '@/sections/shared/NotFoundBeacon'

/**
 * Not found.
 *
 * **Static, deliberately, and it must stay that way.** The root not-found is
 * part of every route's shell: a `force-dynamic` here marked all eleven
 * prerendered pages as server-rendered on demand, which is the opposite of
 * what this site is for. Redirects are applied in `middleware.ts` and the miss
 * is recorded by a client beacon, so nothing on this page reads the request.
 */
export default function NotFound() {
  return (
    <main
      style={{
        padding: 'var(--space-10) var(--gutter) var(--space-11)',
        maxWidth: 'var(--container-text)',
        margin: '0 auto',
      }}
    >
      <NotFoundBeacon />

      <Eyebrow number="404">Not found</Eyebrow>
      <h1 style={{ fontSize: 'var(--text-h1)', marginTop: 20, maxWidth: '16ch' }}>
        This path does not go anywhere
      </h1>
      <p style={{ marginTop: 20, fontSize: 'var(--text-lead)', color: 'var(--text-muted)' }}>
        The page you were looking for is not here. The journeys are, and so are we.
      </p>
      <div style={{ marginTop: 'var(--space-7)', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <Button href="/trips">Our trips</Button>
        <Button variant="outline" href="/">
          Home
        </Button>
      </div>
    </main>
  )
}

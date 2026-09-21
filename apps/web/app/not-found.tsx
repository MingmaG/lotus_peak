import { Button, Eyebrow } from '@/design-system'

export default function NotFound() {
  return (
    <main
      style={{
        padding: 'var(--space-10) var(--gutter) var(--space-11)',
        maxWidth: 'var(--container-text)',
        margin: '0 auto',
      }}
    >
      <Eyebrow number="404">Not found</Eyebrow>
      <h1 style={{ fontSize: 'var(--text-h1)', marginTop: 20, maxWidth: '16ch' }}>
        This path does not go anywhere
      </h1>
      <p style={{ marginTop: 20, fontSize: 'var(--text-lead)', color: 'var(--text-muted)' }}>
        The page you were looking for is not here. The four journeys are, and so are we.
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

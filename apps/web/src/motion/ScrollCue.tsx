export function ScrollCue() {
  return (
    <div
      aria-hidden="true"
      style={{
        display: 'grid',
        justifyItems: 'center',
        gap: 10,
        color: 'rgba(255,255,255,.7)',
        fontSize: 'var(--text-label)',
        letterSpacing: 'var(--tracking-nav)',
        textTransform: 'uppercase',
      }}
    >
      <span>Scroll</span>
      <span
        style={{
          width: 1,
          height: 48,
          background: 'linear-gradient(rgba(255,255,255,.8),transparent)',
          animation: 'cue var(--dur-breath) var(--ease-inhale) infinite',
        }}
      />
    </div>
  )
}

/** The page-wide radial breath. Rendered once, above everything, inert. */
export function Halo() {
  return (
    <div
      aria-hidden="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 150,
        pointerEvents: 'none',
        background: 'radial-gradient(ellipse 70% 60% at 50% 45%,#fff,transparent 70%)',
        animation: 'halo var(--dur-breath) var(--ease-inhale) infinite',
      }}
    />
  )
}

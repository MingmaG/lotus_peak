import { CoverImage, PageHeader } from '../shared/Cover'

/**
 * The trip's photograph, then its length, name and regions on paper beneath
 * it — the same opening as every other detail page, so the section nav that
 * follows sticks under a heading rather than under a photograph with words
 * on it.
 */
export function TripHero({
  image,
  alt,
  title,
  meta,
  regions,
}: {
  image: string
  alt?: string
  title: string
  meta: string
  regions: string
}) {
  return (
    <>
      <CoverImage image={image} alt={alt} />
      <PageHeader eyebrow={meta} title={title} flush={false}>
        <p
          style={{
            fontSize: 'var(--text-small)',
            letterSpacing: 'var(--tracking-nav)',
            textTransform: 'uppercase',
            color: 'var(--text-muted)',
          }}
        >
          {regions}
        </p>
      </PageHeader>
    </>
  )
}

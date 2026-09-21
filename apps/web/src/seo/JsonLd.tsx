import type { ReactElement } from 'react'

/**
 * One `<script type="application/ld+json">` per page.
 *
 * Nothing else in this application renders one. A second script is a second,
 * unlinked description of the same page, and the whole point of the `@graph`
 * that `@lotuspeak/seo` builds is that its nodes reference each other by
 * `@id` — a journey whose `provider` *is* the organisation the page already
 * described, rather than two organisations a crawler has to guess are the
 * same one.
 *
 * ## Why `dangerouslySetInnerHTML`
 *
 * React escapes text nodes, which inside a `<script>` produces `&quot;` where
 * JSON needs `"` and leaves a document no parser accepts. The content is
 * `JSON.stringify` of an object this application built, so the only injection
 * risk is a `</script>` inside a string — which is neutralised below.
 */
export function JsonLd({ graph }: { graph: unknown }): ReactElement {
  const json = JSON.stringify(graph).replace(/</g, '\\u003c')

  return (
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />
  )
}

import type { ReactNode } from 'react'
import { CoverImage, PageHeader } from '@/sections/shared/Cover'

/**
 * The top of a detail page: a photograph, then the trail back, the title and
 * the standfirst beneath it on paper.
 *
 * Shared so a valley, a place, a culture piece and a journal entry open the
 * same way — they are the same kind of page, a long read under a photograph,
 * and a visitor moving between the sections should not have to relearn the
 * layout. The header lines up with the reading column that follows it.
 */
export function ArticleHero({
  image,
  alt,
  trail,
  eyebrow,
  title,
  standfirst,
}: {
  image: string
  alt?: string
  trail: { label: string; href?: string }[]
  eyebrow: ReactNode
  title: string
  standfirst: string
}) {
  return (
    <>
      <CoverImage image={image} alt={alt} />
      <PageHeader trail={trail} eyebrow={eyebrow} title={title} standfirst={standfirst} width="text" />
    </>
  )
}

'use client'

import type { CSSProperties, ReactNode } from 'react'
import { Button, type ButtonProps } from '@/design-system'
import { useInquiry } from './SiteChrome'

/** A Button that opens the enquiry drawer, optionally pre-selecting a journey. */
export function InquiryButton({
  tripSlug,
  children,
  ...rest
}: Omit<ButtonProps, 'onClick' | 'href'> & {
  tripSlug?: string
  children: ReactNode
  style?: CSSProperties
}) {
  const { open } = useInquiry()
  return (
    <Button {...rest} onClick={() => open(tripSlug)}>
      {children}
    </Button>
  )
}

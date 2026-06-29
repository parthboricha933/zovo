'use client'

import Image from 'next/image'
import { cn } from '@/lib/utils'

interface ZovoLogoProps {
  className?: string
  size?: 'sm' | 'md' | 'lg'
  /** Show just the icon mark without the full wordmark (for compact spaces like sidebar) */
  iconOnly?: boolean
}

export function ZovoLogo({ className, size = 'md', iconOnly = false }: ZovoLogoProps) {
  const heights = {
    sm: 28,
    md: 36,
    lg: 56,
  }
  const h = heights[size]

  if (iconOnly) {
    // For compact spaces (sidebar), show a square crop of the logo's icon area
    return (
      <div className={cn('relative', className)} style={{ height: h, width: h }}>
        <Image
          src="/zovo.png"
          alt="ZOVO"
          fill
          className="object-cover rounded-lg"
          sizes={`${h}px`}
          priority
        />
      </div>
    )
  }

  // Full logo with wordmark + tagline
  // Maintain aspect ratio: source is 1024x1024 (square)
  return (
    <div className={cn('relative', className)} style={{ height: h, width: h * 3.5 }}>
      <Image
        src="/zovo.png"
        alt="ZOVO — Ride. Connect. Explore."
        fill
        className="object-contain"
        sizes={`${h * 3.5}px`}
        priority
      />
    </div>
  )
}

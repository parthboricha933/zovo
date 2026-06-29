'use client'

import { Car } from 'lucide-react'
import { cn } from '@/lib/utils'

export function ZovoLogo({ className, size = 'md' }: { className?: string; size?: 'sm' | 'md' | 'lg' }) {
  const dim = size === 'sm' ? 'h-7 w-7' : size === 'lg' ? 'h-12 w-12' : 'h-9 w-9'
  const text = size === 'sm' ? 'text-lg' : size === 'lg' ? 'text-3xl' : 'text-xl'
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div className={cn('rounded-xl bg-primary text-primary-foreground grid place-items-center shadow-sm', dim)}>
        <Car className="h-1/2 w-1/2" />
      </div>
      <span className={cn('font-bold tracking-tight text-foreground', text)}>
        ZOVO
      </span>
    </div>
  )
}

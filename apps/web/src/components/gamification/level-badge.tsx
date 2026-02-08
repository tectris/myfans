'use client'

import { cn } from '@/lib/utils'
import { FAN_TIERS } from '@fandreams/shared'

interface LevelBadgeProps {
  level: number
  tier: keyof typeof FAN_TIERS
  xp: number
  className?: string
}

export function LevelBadge({ level, tier, xp, className }: LevelBadgeProps) {
  const tierData = FAN_TIERS[tier]
  const tierEntries = Object.entries(FAN_TIERS)
  const currentIndex = tierEntries.findIndex(([key]) => key === tier)
  const nextTier = tierEntries[currentIndex + 1]
  const progress = nextTier ? ((xp - tierData.minXp) / (nextTier[1].minXp - tierData.minXp)) * 100 : 100

  return (
    <div className={cn('flex items-center gap-3', className)}>
      <div
        className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm border-2"
        style={{ borderColor: tierData.color, color: tierData.color }}
      >
        {level}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between text-xs mb-1">
          <span className="font-semibold" style={{ color: tierData.color }}>
            {tierData.name}
          </span>
          <span className="text-muted">{xp.toLocaleString()} XP</span>
        </div>
        <div className="h-1.5 bg-surface-dark rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${Math.min(progress, 100)}%`, backgroundColor: tierData.color }}
          />
        </div>
      </div>
    </div>
  )
}

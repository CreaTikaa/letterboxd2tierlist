import { useMemo } from 'react'
import { countByRating } from '../lib/filter'
import { RATING_VALUES, ratingKey, stars } from '../lib/ratings'
import { autoFill, defaultRatingMap } from '../lib/tiers'
import type { Film, RatingMap, Tier } from '../lib/types'
import { useStore } from '../store/useStore'
import { Button, Dialog, inputClass } from './ui'

interface Props {
  open: boolean
  onClose: () => void
  tiers: Tier[]
  /** Visible films; these are the ones that get placed. */
  films: Film[]
  ratingMap: RatingMap
  onRatingMapChange: (map: RatingMap) => void
  onApply: (tiers: Tier[]) => void
  description?: string
}

export function AutoFillDialog({ open, onClose, tiers, films, ratingMap, onRatingMapChange, onApply, description }: Props) {
  const notify = useStore((s) => s.notify)
  const counts = useMemo(() => countByRating(films), [films])
  const tierIds = new Set(tiers.map((t) => t.id))

  const apply = () => {
    onApply(autoFill(tiers, films, ratingMap))
    onClose()
    notify({ kind: 'success', text: `Placed ${films.filter((f) => f.rating != null && tierIds.has(ratingMap[ratingKey(f.rating)])).length} films by rating.` })
  }

  return (
    <Dialog open={open} onClose={onClose} title="Auto-fill by rating">
      <div className="space-y-4">
        <p className="text-sm text-muted">
          {description ??
            "Choose the tier for each rating. Applying moves every visible film to its tier, including ones you've already placed. Unrated films stay in the pool."}
        </p>
        <table className="w-full text-sm">
          <tbody>
            {RATING_VALUES.map((rating) => {
              const key = ratingKey(rating)
              const value = tierIds.has(ratingMap[key]) ? ratingMap[key] : ''
              return (
                <tr key={key} className="border-b border-line/50 last:border-0">
                  <td className="py-1.5 text-lb-green">{stars(rating)}</td>
                  <td className="py-1.5 text-muted">{counts.get(rating) ?? 0} films</td>
                  <td className="py-1.5 text-right">
                    <select value={value} onChange={(e) => onRatingMapChange({ ...ratingMap, [key]: e.target.value })} className={`${inputClass} w-40`}>
                      {tiers.map((tier) => (
                        <option key={tier.id} value={tier.id}>
                          {tier.label || '(unnamed)'}
                        </option>
                      ))}
                      <option value="">Leave unplaced</option>
                    </select>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        <div className="flex justify-between gap-2">
          <Button variant="ghost" onClick={() => onRatingMapChange(defaultRatingMap(tiers))}>
            Reset mapping
          </Button>
          <Button variant="primary" onClick={apply}>
            Apply to {films.length} visible films
          </Button>
        </div>
      </div>
    </Dialog>
  )
}

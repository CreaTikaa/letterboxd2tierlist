import { useMemo } from 'react'
import { useVisibleFilms } from '../hooks'
import { countByRating } from '../lib/filter'
import { RATING_VALUES, ratingKey, stars } from '../lib/ratings'
import { defaultRatingMap } from '../lib/tiers'
import { useStore } from '../store/useStore'
import { Button, Dialog, inputClass } from './ui'

export function AutoFillDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const tiers = useStore((s) => s.tiers)
  const ratingMap = useStore((s) => s.ratingMap)
  const setRatingMap = useStore((s) => s.setRatingMap)
  const autoFill = useStore((s) => s.autoFill)
  const notify = useStore((s) => s.notify)
  const visible = useVisibleFilms()
  const counts = useMemo(() => countByRating(visible), [visible])
  const tierIds = new Set(tiers.map((t) => t.id))

  const apply = () => {
    autoFill(visible)
    onClose()
    notify({ kind: 'success', text: `Placed ${visible.filter((f) => f.rating != null && tierIds.has(ratingMap[ratingKey(f.rating)])).length} films by rating.` })
  }

  return (
    <Dialog open={open} onClose={onClose} title="Auto-fill by rating">
      <div className="space-y-4">
        <p className="text-sm text-muted">
          Choose the tier for each rating. Applying moves every visible film to its tier, including ones you've already placed. Unrated films stay in the pool.
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
                    <select value={value} onChange={(e) => setRatingMap({ ...ratingMap, [key]: e.target.value })} className={`${inputClass} w-40`}>
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
          <Button variant="ghost" onClick={() => setRatingMap(defaultRatingMap(tiers))}>
            Reset mapping
          </Button>
          <Button variant="primary" onClick={apply}>
            Apply to {visible.length} visible films
          </Button>
        </div>
      </div>
    </Dialog>
  )
}

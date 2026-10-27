import { useMemo } from 'react'
import { countByRating } from '../lib/filter'
import { RATING_VALUES, ratingKey, stars } from '../lib/ratings'
import { autoFill, defaultRatingMap } from '../lib/tiers'
import type { Film, RatingMap, Tier } from '../lib/types'
import { useT } from '../i18n'
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
  const t = useT()
  const counts = useMemo(() => countByRating(films), [films])
  const tierIds = new Set(tiers.map((tier) => tier.id))

  const apply = () => {
    onApply(autoFill(tiers, films, ratingMap))
    onClose()
    notify({ kind: 'success', text: t('autofill.placed', { count: films.filter((f) => f.rating != null && tierIds.has(ratingMap[ratingKey(f.rating)])).length }) })
  }

  return (
    <Dialog open={open} onClose={onClose} title={t('autofill.title')}>
      <div className="space-y-4">
        <p className="text-sm text-muted">
          {description ?? t('autofill.help')}
        </p>
        <table className="w-full text-sm">
          <tbody>
            {RATING_VALUES.map((rating) => {
              const key = ratingKey(rating)
              const value = tierIds.has(ratingMap[key]) ? ratingMap[key] : ''
              return (
                <tr key={key} className="border-b border-line/50 last:border-0">
                  <td className="py-1.5 text-lb-green">{stars(rating)}</td>
                  <td className="py-1.5 text-muted">{t('common.films', { count: counts.get(rating) ?? 0 })}</td>
                  <td className="py-1.5 text-right">
                    <select value={value} onChange={(e) => onRatingMapChange({ ...ratingMap, [key]: e.target.value })} className={`${inputClass} w-40`}>
                      {tiers.map((tier) => (
                        <option key={tier.id} value={tier.id}>
                          {tier.label || t('autofill.unnamed')}
                        </option>
                      ))}
                      <option value="">{t('autofill.leaveUnplaced')}</option>
                    </select>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        <div className="flex justify-between gap-2">
          <Button variant="ghost" onClick={() => onRatingMapChange(defaultRatingMap(tiers))}>
            {t('autofill.reset')}
          </Button>
          <Button variant="primary" onClick={apply}>
            {t('autofill.apply', { count: films.length })}
          </Button>
        </div>
      </div>
    </Dialog>
  )
}

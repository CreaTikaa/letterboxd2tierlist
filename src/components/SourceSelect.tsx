import { useT } from '../i18n'
import { useStore } from '../store/useStore'
import { inputClass } from './ui'

/**
 * All watched films / liked films / one of your lists (and, when `visibleCount` is given, the films
 * shown on the tier list with all its filters). Hidden when there's nothing to choose from.
 */
export function SourceSelect({
  value,
  onChange,
  className = '',
  visibleCount,
}: {
  value: string
  onChange: (source: string) => void
  className?: string
  visibleCount?: number
}) {
  const t = useT()
  const films = useStore((s) => s.films)
  const lists = useStore((s) => s.lists)
  const liked = films.filter((f) => f.liked).length
  if (!liked && lists.length === 0 && visibleCount == null) return null

  return (
    <label className={`flex items-center gap-1.5 text-muted ${className}`}>
      {t('source.label')}
      <select value={value} onChange={(e) => onChange(e.target.value)} className={`${inputClass} max-w-56`}>
        <option value="all">{t('source.all', { count: films.length })}</option>
        {visibleCount != null && <option value="visible">{t('source.visible', { count: visibleCount })}</option>}
        {liked > 0 && <option value="liked">{t('source.liked', { count: liked })}</option>}
        {lists.length > 0 && (
          <optgroup label={t('source.lists')}>
            {lists.map((list) => (
              <option key={list.id} value={`list:${list.id}`}>
                {t('source.list', { name: list.name, count: list.films.length })}
              </option>
            ))}
          </optgroup>
        )}
      </select>
    </label>
  )
}

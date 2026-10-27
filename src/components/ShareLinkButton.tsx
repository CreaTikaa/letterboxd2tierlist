import { useState } from 'react'
import { errorMessage, useT } from '../i18n'
import { LONG_LINK, encodeShared, shareUrl, type SharedItem, type SharedList } from '../lib/share'
import { useStore } from '../store/useStore'
import { Button } from './ui'

/** Copies a read-only link to what `build` returns (a tier list by default, or any shared item). */
export function ShareLinkButton({ build, label, variant = 'ghost' }: { build: () => SharedList | SharedItem; label?: string; variant?: 'ghost' | 'secondary' }) {
  const notify = useStore((s) => s.notify)
  const t = useT()
  const [busy, setBusy] = useState(false)

  const share = async () => {
    setBusy(true)
    try {
      const built = build()
      const item: SharedItem = 'kind' in built ? built : { kind: 'tierlist', list: built }
      if (item.kind === 'tierlist' && item.list.tiers.every((tier) => tier.films.length === 0)) {
        notify({ kind: 'error', text: t('share.empty') })
        return
      }
      const url = shareUrl(await encodeShared(item))
      try {
        await navigator.clipboard.writeText(url)
      } catch {
        prompt(t('share.prompt'), url)
      }
      notify({
        kind: 'success',
        text: url.length > LONG_LINK ? t('share.copiedLong', { length: url.length }) : t('share.copied'),
      })
    } catch (error) {
      notify({ kind: 'error', text: t('share.failed', { message: errorMessage(t, error) }) })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Button variant={variant} disabled={busy} onClick={() => void share()}>
      🔗 {label ?? t('share.copy')}
    </Button>
  )
}

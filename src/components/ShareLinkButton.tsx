import { useState } from 'react'
import { errorMessage, useT } from '../i18n'
import { LONG_LINK, encodeSharedList, shareUrl, type SharedList } from '../lib/share'
import { useStore } from '../store/useStore'
import { Button } from './ui'

/** Copies a read-only link to the list that `build` returns. */
export function ShareLinkButton({ build, label }: { build: () => SharedList; label?: string }) {
  const notify = useStore((s) => s.notify)
  const t = useT()
  const [busy, setBusy] = useState(false)

  const share = async () => {
    setBusy(true)
    try {
      const list = build()
      if (list.tiers.every((tier) => tier.films.length === 0)) {
        notify({ kind: 'error', text: t('share.empty') })
        return
      }
      const url = shareUrl(await encodeSharedList(list))
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
    <Button variant="ghost" disabled={busy} onClick={() => void share()}>
      🔗 {label ?? t('share.copy')}
    </Button>
  )
}

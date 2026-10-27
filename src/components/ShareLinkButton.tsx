import { useState } from 'react'
import { LONG_LINK, encodeSharedList, shareUrl, type SharedList } from '../lib/share'
import { useStore } from '../store/useStore'
import { Button } from './ui'

/** Copies a read-only link to the list that `build` returns. */
export function ShareLinkButton({ build, label = 'Copy share link' }: { build: () => SharedList; label?: string }) {
  const notify = useStore((s) => s.notify)
  const [busy, setBusy] = useState(false)

  const share = async () => {
    setBusy(true)
    try {
      const list = build()
      if (list.tiers.every((t) => t.films.length === 0)) {
        notify({ kind: 'error', text: 'Put some films on the board first.' })
        return
      }
      const url = shareUrl(await encodeSharedList(list))
      try {
        await navigator.clipboard.writeText(url)
      } catch {
        prompt('Copy this link:', url)
      }
      notify({
        kind: 'success',
        text:
          url.length > LONG_LINK
            ? `Link copied (${url.length.toLocaleString()} characters). Some chat apps cut long links; a PNG may travel better.`
            : 'Link copied. Anyone can open it, no account needed.',
      })
    } catch (error) {
      notify({ kind: 'error', text: `Could not create the link: ${error instanceof Error ? error.message : error}` })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Button variant="ghost" disabled={busy} onClick={() => void share()}>
      🔗 {label}
    </Button>
  )
}

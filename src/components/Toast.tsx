import { useEffect } from 'react'
import { useStore } from '../store/useStore'

export function Toast() {
  const notice = useStore((s) => s.notice)
  const notify = useStore((s) => s.notify)

  useEffect(() => {
    if (!notice) return
    const timer = setTimeout(() => notify(null), notice.kind === 'error' ? 8000 : 4000)
    return () => clearTimeout(timer)
  }, [notice, notify])

  if (!notice) return null
  return (
    <div className="fixed inset-x-4 bottom-4 z-50 flex justify-center" role="status">
      <button
        type="button"
        onClick={() => notify(null)}
        className={`max-w-md rounded-lg px-4 py-2.5 text-left text-sm shadow-xl ${
          notice.kind === 'error' ? 'bg-red-800 text-white' : 'bg-raised text-text ring-1 ring-lb-green/40'
        }`}
      >
        {notice.text}
      </button>
    </div>
  )
}

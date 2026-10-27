import { useEffect, useRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { useT } from '../i18n'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-lb-green text-ink hover:brightness-110 font-semibold',
  secondary: 'bg-raised text-text hover:bg-line',
  ghost: 'text-muted hover:text-text hover:bg-raised',
  danger: 'bg-red-700/80 text-white hover:bg-red-700',
}

export function Button({ variant = 'secondary', className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition disabled:cursor-not-allowed disabled:opacity-50 ${VARIANTS[variant]} ${className}`}
      {...props}
    />
  )
}

export function Dialog({
  open,
  onClose,
  title,
  children,
  wide = false,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  wide?: boolean
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const t = useT()
  useEffect(() => {
    const dialog = ref.current!
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      className={`m-auto w-[calc(100%-2rem)] rounded-xl border border-line bg-panel p-0 text-text shadow-2xl ${wide ? 'max-w-3xl' : 'max-w-lg'}`}
    >
      {open && (
        <div className="flex max-h-[85vh] flex-col">
          <div className="flex items-center justify-between border-b border-line px-5 py-3">
            <h2 className="text-lg font-semibold">{title}</h2>
            <button type="button" onClick={onClose} className="rounded p-1 text-muted hover:text-text" aria-label={t('common.close')}>
              ✕
            </button>
          </div>
          <div className="overflow-y-auto px-5 py-4">{children}</div>
        </div>
      )}
    </dialog>
  )
}

export function ProgressBar({ value, max }: { value: number; max: number }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-raised">
      <div className="h-full rounded-full bg-lb-green transition-[width]" style={{ width: `${max ? (value / max) * 100 : 0}%` }} />
    </div>
  )
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3 border-b border-line pb-5 last:border-0 last:pb-0 [&+section]:pt-5">
      <h3 className="font-semibold text-text">{title}</h3>
      {children}
    </section>
  )
}

export const inputClass =
  'rounded-md border border-line bg-ink px-2.5 py-1.5 text-sm text-text placeholder:text-muted/70 focus:border-lb-blue focus:outline-none'

import { useCallback, useEffect, useRef, useState } from 'react'

const LIMIT = 100

export interface History<T> {
  /** Records the current value, then applies `next`. Changes with the same `coalesce` key in a row
   * (e.g. typing a tier name) share one undo step. */
  set: (next: T, coalesce?: string) => void
  undo: () => void
  redo: () => void
  canUndo: boolean
  canRedo: boolean
}

/** Z or Ctrl/Cmd+Z (outside text fields) runs `undo`; for screens with a single undo step at a time. */
export function useUndoKey(undo: () => void, enabled = true) {
  useEffect(() => {
    if (!enabled) return
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e.target) || e.key.toLowerCase() !== 'z' || e.shiftKey) return
      e.preventDefault()
      undo()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [undo, enabled])
}

/** True when the keyboard event should go to a text field instead of a global shortcut. */
export function isTyping(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
}

/**
 * Undo/redo for a value owned elsewhere (a store, a room). Ctrl/Cmd+Z undoes, Ctrl+Shift+Z or
 * Ctrl+Y redoes. If the value changes from outside (another person in a room), history is dropped
 * so undo never overwrites someone else's change.
 */
export function useHistory<T>(value: T, onChange: (value: T) => void, equal: (a: T, b: T) => boolean = Object.is): History<T> {
  const past = useRef<T[]>([])
  const future = useRef<T[]>([])
  const current = useRef(value)
  const lastCoalesce = useRef<string | undefined>(undefined)
  const [counts, setCounts] = useState({ past: 0, future: 0 })
  const sync = () => setCounts({ past: past.current.length, future: future.current.length })

  useEffect(() => {
    if (equal(value, current.current)) return
    // Changed by someone or something else: our history no longer applies.
    current.current = value
    past.current = []
    future.current = []
    lastCoalesce.current = undefined
    setCounts({ past: 0, future: 0 })
  }, [value, equal])

  const set = useCallback(
    (next: T, coalesce?: string) => {
      if (!coalesce || coalesce !== lastCoalesce.current) {
        past.current = [...past.current, current.current].slice(-LIMIT)
      }
      lastCoalesce.current = coalesce
      future.current = []
      current.current = next
      onChange(next)
      sync()
    },
    [onChange],
  )

  const undo = useCallback(() => {
    const previous = past.current.at(-1)
    if (previous === undefined) return
    past.current = past.current.slice(0, -1)
    future.current = [...future.current, current.current]
    current.current = previous
    lastCoalesce.current = undefined
    onChange(previous)
    sync()
  }, [onChange])

  const redo = useCallback(() => {
    const next = future.current.at(-1)
    if (next === undefined) return
    future.current = future.current.slice(0, -1)
    past.current = [...past.current, current.current]
    current.current = next
    lastCoalesce.current = undefined
    onChange(next)
    sync()
  }, [onChange])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || isTyping(e.target)) return
      const key = e.key.toLowerCase()
      if (key === 'z' && !e.shiftKey) {
        e.preventDefault()
        undo()
      } else if ((key === 'z' && e.shiftKey) || key === 'y') {
        e.preventDefault()
        redo()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [undo, redo])

  return { set, undo, redo, canUndo: counts.past > 0, canRedo: counts.future > 0 }
}

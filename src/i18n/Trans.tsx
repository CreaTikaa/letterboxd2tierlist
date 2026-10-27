import { Fragment, type ReactNode } from 'react'
import { useT, type Params, type TKey } from '.'

/**
 * Renders a translation that contains markup like `Go to <link>Settings</link>`: each tag is
 * replaced by the matching function in `tags`, so translators can move links around freely.
 */
export function Trans({ k, params, tags }: { k: TKey; params?: Params; tags: Record<string, (children: ReactNode) => ReactNode> }) {
  const t = useT()
  const text = t(k, params)
  const parts: ReactNode[] = []
  const pattern = /<(\w+)>([\s\S]*?)<\/\1>/g
  let last = 0
  for (let match = pattern.exec(text); match; match = pattern.exec(text)) {
    if (match.index > last) parts.push(text.slice(last, match.index))
    const render = tags[match[1]]
    parts.push(<Fragment key={match.index}>{render ? render(match[2]) : match[2]}</Fragment>)
    last = pattern.lastIndex
  }
  if (last < text.length) parts.push(text.slice(last))
  return <>{parts}</>
}

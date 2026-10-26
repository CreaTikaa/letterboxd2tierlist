import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { groupFilms, memberColor, pickShowdownFilms, showdownResults, type GroupFilm } from '../../lib/room/group'
import type { Showdown as ShowdownState } from '../../lib/room/types'
import { autoFill, clearTiers, defaultRatingMap, placedIds } from '../../lib/tiers'
import type { Film, Match, PoolSort, Tier } from '../../lib/types'
import { useRoom, useShowdownDrafts } from '../../store/useRoom'
import { useStore } from '../../store/useStore'
import { Board } from '../board/Board'
import { PosterCard } from '../board/PosterCard'
import { StaticTierList } from '../StaticTierList'
import { Button, inputClass } from '../ui'

/** Display name for a member id, from whoever we know about. */
function useNameOf() {
  const view = useRoom((s) => s.view)!
  const profile = useStore((s) => s.profile)
  return useCallback(
    (memberId: string) => {
      if (memberId === profile.memberId) return profile.name || 'You'
      const peer = Object.values(view.peers).find((p) => p.memberId === memberId)
      return peer?.name || view.state.members[memberId]?.name || 'Someone'
    },
    [view, profile],
  )
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

function MemberTag({ memberId, suffix }: { memberId: string; suffix?: string }) {
  const nameOf = useNameOf()
  return (
    <span className="inline-flex items-center gap-1.5 font-semibold">
      <span className="size-2.5 rounded-full" style={{ background: memberColor(memberId) }} />
      {nameOf(memberId)}
      {suffix && <span className="font-normal text-muted">{suffix}</span>}
    </span>
  )
}

export function Showdown() {
  const view = useRoom((s) => s.view)!
  const films = useMemo(() => groupFilms(Object.values(view.state.members)), [view.state.members])
  const filmById = useMemo(() => new Map<string, GroupFilm>(films.map((f) => [f.id, f])), [films])
  const { showdown } = view.state

  switch (showdown.phase) {
    case 'idle':
      return <Setup films={films} />
    case 'ranking':
      return <Ranking showdown={showdown} filmById={filmById} />
    case 'reveal':
      return <Reveal showdown={showdown} filmById={filmById} />
    case 'results':
      return <Results showdown={showdown} filmById={filmById} />
  }
}

function Setup({ films }: { films: GroupFilm[] }) {
  const view = useRoom((s) => s.view)!
  const dispatch = useRoom((s) => s.dispatch)
  const nameOf = useNameOf()
  const sharing = Object.keys(view.state.members).length
  const [minWatchers, setMinWatchers] = useState(Math.max(1, sharing))
  const [count, setCount] = useState(20)
  const [mode, setMode] = useState<'popular' | 'random'>('popular')
  const available = useMemo(() => films.filter((f) => f.watchers.length >= minWatchers).length, [films, minWatchers])

  const start = () => {
    const filmIds = pickShowdownFilms(films, { minWatchers, count, mode })
    dispatch({ t: 'sd-start', round: view.state.showdown.round + 1, filmIds, tiers: clearTiers(view.state.board) })
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
      <div className="space-y-3 rounded-xl bg-panel p-5">
        <h2 className="text-lg font-semibold">How a showdown works</h2>
        <ol className="list-inside list-decimal space-y-1.5 text-sm text-muted">
          <li>Everyone gets the same set of films and ranks them on their own board, in secret.</li>
          <li>Once people lock in, the host reveals every list at once.</li>
          <li>Everyone votes for the best and the worst list (not their own).</li>
          <li>See who won, and which films split the room.</li>
        </ol>
      </div>

      <div className="space-y-4 rounded-xl bg-panel p-5">
        {view.isHost ? (
          <>
            <h2 className="text-lg font-semibold">Start a showdown</h2>
            {sharing === 0 ? (
              <p className="text-sm text-muted">Someone needs to share their films first.</p>
            ) : (
              <>
                <div className="grid gap-3 text-sm sm:grid-cols-3">
                  <label className="flex flex-col gap-1 text-muted">
                    Films seen by at least
                    <select value={minWatchers} onChange={(e) => setMinWatchers(Number(e.target.value))} className={inputClass}>
                      {Array.from({ length: sharing }, (_, i) => i + 1).map((n) => (
                        <option key={n} value={n}>
                          {n === sharing && n > 1 ? `${n} (everyone)` : `${n} ${n === 1 ? 'person' : 'people'}`}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1 text-muted">
                    Number of films
                    <select value={count} onChange={(e) => setCount(Number(e.target.value))} className={inputClass}>
                      {[10, 15, 20, 30, 40, 50].map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1 text-muted">
                    Pick
                    <select value={mode} onChange={(e) => setMode(e.target.value as 'popular' | 'random')} className={inputClass}>
                      <option value="popular">Most watched</option>
                      <option value="random">Random</option>
                    </select>
                  </label>
                </div>
                <p className="text-sm text-muted">
                  {available} films qualify; {Math.min(available, count)} will be used. Tiers are copied from the group board.
                </p>
                <Button variant="primary" disabled={available < 2} onClick={start}>
                  Start showdown
                </Button>
              </>
            )}
          </>
        ) : (
          <p className="text-sm text-muted">
            Waiting for the host ({view.hostMemberId ? nameOf(view.hostMemberId) : 'connecting…'}) to start a showdown.
          </p>
        )}
      </div>
    </div>
  )
}

function Ranking({ showdown, filmById }: { showdown: ShowdownState; filmById: Map<string, GroupFilm> }) {
  const view = useRoom((s) => s.view)!
  const dispatch = useRoom((s) => s.dispatch)
  const me = useStore((s) => s.profile.memberId)
  const matches = useStore((s) => s.matches)
  const setEditingFilm = useStore((s) => s.setEditingFilm)
  const draftKey = `${view.state.id}:${showdown.round}`
  const draft = useShowdownDrafts((s) => s.drafts[draftKey])
  const setDraft = useShowdownDrafts((s) => s.setDraft)
  const [poolSort, setPoolSort] = useState<PoolSort>('rating')
  const tiers = draft ?? showdown.tiers
  const locked = showdown.boards[me]

  // Each person sees their own rating on the cards.
  const films = useMemo<Film[]>(
    () => showdown.filmIds.flatMap((id) => (filmById.has(id) ? [{ ...filmById.get(id)!, rating: filmById.get(id)!.ratings[me] ?? null }] : [])),
    [showdown.filmIds, filmById, me],
  )
  const ownFilmById = useMemo(() => new Map(films.map((f) => [f.id, f])), [films])
  const unplaced = films.length - placedIds(tiers).size
  const onTiersChange = useCallback((next: Tier[]) => setDraft(draftKey, next), [setDraft, draftKey])
  const openFilm = useCallback((film: Film) => setEditingFilm(film), [setEditingFilm])

  const online = [me, ...Object.values(view.peers).map((p) => p.memberId)]
  const lockedIds = Object.keys(showdown.boards)

  const lock = () => {
    if (unplaced > 0 && !confirm(`${unplaced} films are still unplaced. Lock in anyway?`)) return
    dispatch({ t: 'sd-lock', memberId: me, tiers })
  }

  const reveal = () => {
    const waiting = online.filter((id) => !showdown.boards[id]).length
    if (waiting > 0 && !confirm(`${waiting} people haven't locked in. Reveal anyway? Their lists won't be included.`)) return
    dispatch({ t: 'sd-phase', phase: 'reveal' })
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-panel p-4 text-sm">
        <div className="space-y-1">
          <p className="font-semibold">Rank these {films.length} films. Your list stays hidden until the reveal.</p>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {[...new Set([...online, ...lockedIds])].map((id) => (
              <MemberTag key={id} memberId={id} suffix={showdown.boards[id] ? '✓ locked in' : 'ranking…'} />
            ))}
          </div>
        </div>
        {view.isHost && (
          <Button variant="primary" disabled={lockedIds.length < 2} onClick={reveal} title={lockedIds.length < 2 ? 'Needs at least two locked-in lists' : undefined}>
            Reveal lists ({lockedIds.length})
          </Button>
        )}
      </div>

      {locked ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <p className="font-semibold text-lb-green">✓ Locked in. Waiting for the reveal.</p>
            <Button variant="ghost" onClick={() => dispatch({ t: 'sd-lock', memberId: me, tiers: null })}>
              Unlock to edit
            </Button>
          </div>
          <StaticTierList tiers={locked} filmById={ownFilmById} matches={matches} cardWidth={56} onFilmClick={openFilm} />
        </div>
      ) : (
        <Board
          tiers={tiers}
          films={films}
          matches={matches}
          onTiersChange={onTiersChange}
          poolSort={poolSort}
          onPoolSortChange={setPoolSort}
          onAutoFill={() => onTiersChange(autoFill(tiers, films, defaultRatingMap(tiers)))}
          onFilmClick={openFilm}
          hint={unplaced ? `${unplaced} left to place` : 'All placed!'}
          toolbar={
            <Button variant="primary" onClick={lock}>
              Lock in my list
            </Button>
          }
        />
      )}
    </div>
  )
}

function BoardCard({
  memberId,
  tiers,
  filmById,
  matches,
  children,
  highlight,
}: {
  memberId: string
  tiers: Tier[]
  filmById: Map<string, GroupFilm>
  matches: Record<string, Match>
  children?: ReactNode
  highlight?: 'best' | 'worst'
}) {
  const setEditingFilm = useStore((s) => s.setEditingFilm)
  const ring = highlight === 'best' ? 'ring-2 ring-lb-green' : highlight === 'worst' ? 'ring-2 ring-red-500' : ''
  return (
    <div className={`space-y-2 rounded-xl bg-panel p-3 ${ring}`}>
      <div className="flex items-center justify-between gap-2">
        <MemberTag memberId={memberId} />
        {children}
      </div>
      <StaticTierList tiers={tiers} filmById={filmById} matches={matches} onFilmClick={setEditingFilm} />
    </div>
  )
}

function Reveal({ showdown, filmById }: { showdown: ShowdownState; filmById: Map<string, GroupFilm> }) {
  const view = useRoom((s) => s.view)!
  const dispatch = useRoom((s) => s.dispatch)
  const me = useStore((s) => s.profile.memberId)
  const matches = useStore((s) => s.matches)
  const vote = showdown.votes[me] ?? { best: null, worst: null }
  const voters = Object.keys(showdown.votes).length
  const online = 1 + Object.keys(view.peers).length

  const castVote = (kind: 'best' | 'worst', memberId: string) => {
    const next = { ...vote, [kind]: vote[kind] === memberId ? null : memberId }
    // One list can't be both best and worst.
    if (kind === 'best' && next.worst === memberId) next.worst = null
    if (kind === 'worst' && next.best === memberId) next.best = null
    dispatch({ t: 'sd-vote', memberId: me, ...next })
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-panel p-4 text-sm">
        <p>
          <span className="font-semibold">The lists are in!</span> Vote for the best 👑 and the worst 💀 list.{' '}
          <span className="text-muted">
            {voters} of {online} voted.
          </span>
        </p>
        {view.isHost && (
          <Button variant="primary" onClick={() => dispatch({ t: 'sd-phase', phase: 'results' })}>
            Show results
          </Button>
        )}
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Object.entries(showdown.boards).map(([memberId, tiers]) => (
          <BoardCard
            key={memberId}
            memberId={memberId}
            tiers={tiers}
            filmById={filmById}
            matches={matches}
            highlight={vote.best === memberId ? 'best' : vote.worst === memberId ? 'worst' : undefined}
          >
            {memberId === me ? (
              <span className="text-xs text-muted">your list</span>
            ) : (
              <div className="flex gap-1">
                <Button variant={vote.best === memberId ? 'primary' : 'secondary'} className="!px-2 !py-1 text-xs" onClick={() => castVote('best', memberId)}>
                  👑 Best
                </Button>
                <Button variant={vote.worst === memberId ? 'danger' : 'secondary'} className="!px-2 !py-1 text-xs" onClick={() => castVote('worst', memberId)}>
                  💀 Worst
                </Button>
              </div>
            )}
          </BoardCard>
        ))}
      </div>
    </div>
  )
}

function Results({ showdown, filmById }: { showdown: ShowdownState; filmById: Map<string, GroupFilm> }) {
  const view = useRoom((s) => s.view)!
  const dispatch = useRoom((s) => s.dispatch)
  const matches = useStore((s) => s.matches)
  const setEditingFilm = useStore((s) => s.setEditingFilm)
  const nameOf = useNameOf()
  const results = useMemo(() => showdownResults(showdown), [showdown])
  const topBest = results.best.filter((b) => b.votes === results.best[0]?.votes)
  const topWorst = results.worst.filter((w) => w.votes === results.worst[0]?.votes)
  const boards = Object.entries(showdown.boards)

  const tierLabel = (tiers: Tier[], filmId: string) => tiers.find((t) => t.filmIds.includes(filmId))?.label ?? '–'

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-lb-green/40 bg-lb-green/10 p-5 text-center">
          <p className="text-sm tracking-wide text-muted uppercase">👑 Best list</p>
          <p className="mt-1 text-2xl font-bold">{topBest.length ? topBest.map((b) => nameOf(b.memberId)).join(' & ') : 'No votes'}</p>
          {topBest[0] && <p className="text-sm text-muted">{plural(topBest[0].votes, 'vote')}</p>}
        </div>
        <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-5 text-center">
          <p className="text-sm tracking-wide text-muted uppercase">💀 Worst list</p>
          <p className="mt-1 text-2xl font-bold">{topWorst.length ? topWorst.map((w) => nameOf(w.memberId)).join(' & ') : 'No votes'}</p>
          {topWorst[0] && <p className="text-sm text-muted">{plural(topWorst[0].votes, 'vote')}</p>}
        </div>
      </div>

      {results.controversial.length > 0 && (
        <div className="space-y-2">
          <h3 className="font-semibold">Most divisive films</h3>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {results.controversial.slice(0, 6).map(({ filmId }) => {
              const film = filmById.get(filmId)
              if (!film) return null
              return (
                <button key={filmId} type="button" onClick={() => setEditingFilm(film)} className="w-28 shrink-0 space-y-1 text-left text-xs">
                  <PosterCard film={film} match={matches[filmId]} width={112} showRating={false} />
                  <p className="line-clamp-1 font-semibold">{film.name}</p>
                  {boards.map(([memberId, tiers]) => (
                    <p key={memberId} className="flex justify-between text-muted">
                      <span className="truncate">{nameOf(memberId)}</span>
                      <span className="text-text">{tierLabel(tiers, filmId)}</span>
                    </p>
                  ))}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {results.unanimous.length > 0 && (
        <p className="text-sm text-muted">
          Everyone agreed on{' '}
          {results.unanimous
            .slice(0, 8)
            .map(({ filmId, tierIndex }) => `${filmById.get(filmId)?.name ?? '?'} (${showdown.tiers[tierIndex]?.label ?? '?'})`)
            .join(', ')}
          {results.unanimous.length > 8 && ` and ${results.unanimous.length - 8} more`}.
        </p>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {boards.map(([memberId, tiers]) => {
          const best = results.best.find((b) => b.memberId === memberId)?.votes ?? 0
          const worst = results.worst.find((w) => w.memberId === memberId)?.votes ?? 0
          return (
            <BoardCard
              key={memberId}
              memberId={memberId}
              tiers={tiers}
              filmById={filmById}
              matches={matches}
              highlight={topBest.some((b) => b.memberId === memberId) ? 'best' : topWorst.some((w) => w.memberId === memberId) ? 'worst' : undefined}
            >
              <span className="text-xs text-muted">
                👑 {best} · 💀 {worst}
              </span>
            </BoardCard>
          )
        })}
      </div>

      {view.isHost && (
        <Button variant="primary" onClick={() => dispatch({ t: 'sd-phase', phase: 'idle' })}>
          New showdown
        </Button>
      )}
    </div>
  )
}

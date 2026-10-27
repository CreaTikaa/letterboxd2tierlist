import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { anonymousOrder, groupFilms, guessResults, listLetter, pickShowdownFilms, showdownResults, type GroupFilm } from '../../lib/room/group'
import { useT } from '../../i18n'
import { Trans } from '../../i18n/Trans'
import type { ShowdownMode, Showdown as ShowdownState } from '../../lib/room/types'
import { autoFill, clearTiers, defaultRatingMap, placedIds } from '../../lib/tiers'
import type { Film, Match, PoolSort, Tier } from '../../lib/types'
import { useRoom, useShowdownDrafts } from '../../store/useRoom'
import { useStore } from '../../store/useStore'
import { Board } from '../board/Board'
import { PosterCard } from '../board/PosterCard'
import { StaticTierList } from '../StaticTierList'
import { Button, inputClass } from '../ui'
import { MemberTag } from './names'
import { useNameOf } from './useNameOf'

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
  const t = useT()
  const view = useRoom((s) => s.view)!
  const dispatch = useRoom((s) => s.dispatch)
  const nameOf = useNameOf()
  const sharing = Object.keys(view.state.members).length
  const [minWatchers, setMinWatchers] = useState(Math.max(1, sharing))
  const [count, setCount] = useState(20)
  const [mode, setMode] = useState<'popular' | 'random'>('popular')
  const [showdownMode, setShowdownMode] = useState<ShowdownMode>('classic')
  const available = useMemo(() => films.filter((f) => f.watchers.length >= minWatchers).length, [films, minWatchers])

  const start = () => {
    const filmIds = pickShowdownFilms(films, { minWatchers, count, mode })
    dispatch({ t: 'sd-start', round: view.state.showdown.round + 1, filmIds, tiers: clearTiers(view.state.board), mode: showdownMode })
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
      <div className="space-y-3 rounded-xl bg-panel p-5">
        <h2 className="text-lg font-semibold">{t('showdown.howTitle')}</h2>
        <ol className="list-inside list-decimal space-y-1.5 text-sm text-muted">
          <li>{t('showdown.how1')}</li>
          <li>{t('showdown.how2')}</li>
          <li>{t('showdown.how3')}</li>
          <li>{t('showdown.how4')}</li>
        </ol>
        <p className="text-sm text-muted">
          <Trans k="showdown.guessExplain" tags={{ b: (text) => <span className="font-semibold text-text">{text}</span> }} />
        </p>
      </div>

      <div className="space-y-4 rounded-xl bg-panel p-5">
        {view.isHost ? (
          <>
            <h2 className="text-lg font-semibold">{t('showdown.startTitle')}</h2>
            {sharing === 0 ? (
              <p className="text-sm text-muted">{t('showdown.needFilms')}</p>
            ) : (
              <>
                <div className="grid gap-3 text-sm sm:grid-cols-2">
                  <label className="flex flex-col gap-1 text-muted">
                    {t('showdown.mode')}
                    <select value={showdownMode} onChange={(e) => setShowdownMode(e.target.value as ShowdownMode)} className={inputClass}>
                      <option value="classic">{t('showdown.modeClassic')}</option>
                      <option value="guess">{t('showdown.modeGuess')}</option>
                    </select>
                  </label>
                  <label className="flex flex-col gap-1 text-muted">
                    {t('showdown.seenBy')}
                    <select value={minWatchers} onChange={(e) => setMinWatchers(Number(e.target.value))} className={inputClass}>
                      {Array.from({ length: sharing }, (_, i) => i + 1).map((n) => (
                        <option key={n} value={n}>
                          {n === sharing && n > 1 ? t('showdown.everyone', { count: n }) : t('showdown.people', { count: n })}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1 text-muted">
                    {t('showdown.filmCount')}
                    <select value={count} onChange={(e) => setCount(Number(e.target.value))} className={inputClass}>
                      {[10, 15, 20, 30, 40, 50].map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1 text-muted">
                    {t('showdown.pick')}
                    <select value={mode} onChange={(e) => setMode(e.target.value as 'popular' | 'random')} className={inputClass}>
                      <option value="popular">{t('showdown.pickPopular')}</option>
                      <option value="random">{t('showdown.pickRandom')}</option>
                    </select>
                  </label>
                </div>
                <p className="text-sm text-muted">
                  {t('showdown.qualify', { available, used: Math.min(available, count) })}
                </p>
                <Button variant="primary" disabled={available < 2} onClick={start}>
                  {t('showdown.start')}
                </Button>
              </>
            )}
          </>
        ) : (
          <p className="text-sm text-muted">
            {t('showdown.waitingHost', { host: view.hostMemberId ? nameOf(view.hostMemberId) : t('showdown.connecting') })}
          </p>
        )}
      </div>
    </div>
  )
}

function Ranking({ showdown, filmById }: { showdown: ShowdownState; filmById: Map<string, GroupFilm> }) {
  const t = useT()
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
    if (unplaced > 0 && !confirm(t('showdown.lockConfirm', { count: unplaced }))) return
    dispatch({ t: 'sd-lock', memberId: me, tiers })
  }

  const reveal = () => {
    const waiting = online.filter((id) => !showdown.boards[id]).length
    if (waiting > 0 && !confirm(t('showdown.revealConfirm', { count: waiting }))) return
    dispatch({ t: 'sd-phase', phase: 'reveal' })
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-panel p-4 text-sm">
        <div className="space-y-1">
          <p className="font-semibold">{t('showdown.rankThese', { count: films.length })}</p>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {[...new Set([...online, ...lockedIds])].map((id) => (
              <MemberTag key={id} memberId={id} suffix={showdown.boards[id] ? t('showdown.lockedIn') : t('showdown.ranking')} />
            ))}
          </div>
        </div>
        {view.isHost && (
          <Button variant="primary" disabled={lockedIds.length < 2} onClick={reveal} title={lockedIds.length < 2 ? t('showdown.revealNeedsTwo') : undefined}>
            {t('showdown.reveal', { count: lockedIds.length })}
          </Button>
        )}
      </div>

      {locked ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <p className="font-semibold text-lb-green">{t('showdown.lockedWaiting')}</p>
            <Button variant="ghost" onClick={() => dispatch({ t: 'sd-lock', memberId: me, tiers: null })}>
              {t('showdown.unlock')}
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
          hint={unplaced ? t('showdown.leftToPlace', { count: unplaced }) : t('showdown.allPlaced')}
          toolbar={
            <Button variant="primary" onClick={lock}>
              {t('showdown.lockIn')}
            </Button>
          }
        />
      )}
    </div>
  )
}

function BoardCard({
  memberId,
  title,
  tiers,
  filmById,
  matches,
  children,
  footer,
  highlight,
}: {
  memberId: string
  /** Replaces the member's name (e.g. "List B" in guess mode). */
  title?: ReactNode
  tiers: Tier[]
  filmById: Map<string, GroupFilm>
  matches: Record<string, Match>
  children?: ReactNode
  footer?: ReactNode
  highlight?: 'best' | 'worst'
}) {
  const setEditingFilm = useStore((s) => s.setEditingFilm)
  const ring = highlight === 'best' ? 'ring-2 ring-lb-green' : highlight === 'worst' ? 'ring-2 ring-red-500' : ''
  return (
    <div className={`space-y-2 rounded-xl bg-panel p-3 ${ring}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        {title ?? <MemberTag memberId={memberId} />}
        {children}
      </div>
      <StaticTierList tiers={tiers} filmById={filmById} matches={matches} onFilmClick={setEditingFilm} />
      {footer}
    </div>
  )
}

function Reveal({ showdown, filmById }: { showdown: ShowdownState; filmById: Map<string, GroupFilm> }) {
  const t = useT()
  const view = useRoom((s) => s.view)!
  const dispatch = useRoom((s) => s.dispatch)
  const me = useStore((s) => s.profile.memberId)
  const matches = useStore((s) => s.matches)
  const nameOf = useNameOf()
  const vote = showdown.votes[me] ?? { best: null, worst: null }
  const voters = Object.keys(showdown.votes).length
  const online = 1 + Object.keys(view.peers).length
  const guessing = showdown.mode === 'guess'
  const owners = guessing ? anonymousOrder(showdown) : Object.keys(showdown.boards)
  const myGuesses = showdown.guesses[me] ?? {}
  const others = owners.filter((id) => id !== me)
  const doneGuessing = Object.entries(showdown.guesses).filter(([guesser, g]) => owners.every((o) => o === guesser || g[o])).length

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
          <span className="font-semibold">{t('showdown.listsIn')}</span> {guessing ? t('showdown.guessAndVote') : t('showdown.vote')}{' '}
          <span className="text-muted">
            {guessing ? t('showdown.votedGuessing', { voters, online, done: doneGuessing }) : t('showdown.voted', { voters, online })}
          </span>
        </p>
        {view.isHost && (
          <Button variant="primary" onClick={() => dispatch({ t: 'sd-phase', phase: 'results' })}>
            {t('showdown.showResults')}
          </Button>
        )}
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {owners.map((memberId, index) => (
          <BoardCard
            key={memberId}
            memberId={memberId}
            title={
              guessing ? (
                <span className="font-semibold">
                  {t('showdown.listLabel', { letter: listLetter(index) })}
                  {memberId === me && <span className="font-normal text-muted"> {t('showdown.yours')}</span>}
                </span>
              ) : undefined
            }
            tiers={showdown.boards[memberId]}
            filmById={filmById}
            matches={matches}
            highlight={vote.best === memberId ? 'best' : vote.worst === memberId ? 'worst' : undefined}
            footer={
              guessing &&
              memberId !== me && (
                <label className="flex items-center gap-2 text-sm text-muted">
                  {t('showdown.whoMade')}
                  <select
                    value={myGuesses[memberId] ?? ''}
                    onChange={(e) => dispatch({ t: 'sd-guess', memberId: me, ownerId: memberId, guessId: e.target.value || null })}
                    className={`${inputClass} flex-1`}
                  >
                    <option value="">{t('showdown.pickSomeone')}</option>
                    {others.map((id) => (
                      <option key={id} value={id}>
                        {nameOf(id)}
                      </option>
                    ))}
                  </select>
                </label>
              )
            }
          >
            {memberId === me ? (
              <span className="text-xs text-muted">{t('showdown.yourList')}</span>
            ) : (
              <div className="flex gap-1">
                <Button variant={vote.best === memberId ? 'primary' : 'secondary'} className="!px-2 !py-1 text-xs" onClick={() => castVote('best', memberId)}>
                  {t('showdown.best')}
                </Button>
                <Button variant={vote.worst === memberId ? 'danger' : 'secondary'} className="!px-2 !py-1 text-xs" onClick={() => castVote('worst', memberId)}>
                  {t('showdown.worst')}
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
  const t = useT()
  const view = useRoom((s) => s.view)!
  const dispatch = useRoom((s) => s.dispatch)
  const matches = useStore((s) => s.matches)
  const setEditingFilm = useStore((s) => s.setEditingFilm)
  const nameOf = useNameOf()
  const results = useMemo(() => showdownResults(showdown), [showdown])
  const guessing = showdown.mode === 'guess'
  const guesses = useMemo(() => (guessing ? guessResults(showdown) : null), [guessing, showdown])
  const order = guessing ? anonymousOrder(showdown) : Object.keys(showdown.boards)
  const topBest = results.best.filter((b) => b.votes === results.best[0]?.votes)
  const topWorst = results.worst.filter((w) => w.votes === results.worst[0]?.votes)
  const boards = Object.entries(showdown.boards)

  const tierLabel = (tiers: Tier[], filmId: string) => tiers.find((tier) => tier.filmIds.includes(filmId))?.label ?? '–'
  const names = (ids: string[]) => ids.map(nameOf).reduce((a, b) => t('showdown.and', { a, b }))

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-lb-green/40 bg-lb-green/10 p-5 text-center">
          <p className="text-sm tracking-wide text-muted uppercase">{t('showdown.bestList')}</p>
          <p className="mt-1 text-2xl font-bold">{topBest.length ? names(topBest.map((b) => b.memberId)) : t('showdown.noVotes')}</p>
          {topBest[0] && <p className="text-sm text-muted">{t('showdown.votes', { count: topBest[0].votes })}</p>}
        </div>
        <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-5 text-center">
          <p className="text-sm tracking-wide text-muted uppercase">{t('showdown.worstList')}</p>
          <p className="mt-1 text-2xl font-bold">{topWorst.length ? names(topWorst.map((w) => w.memberId)) : t('showdown.noVotes')}</p>
          {topWorst[0] && <p className="text-sm text-muted">{t('showdown.votes', { count: topWorst[0].votes })}</p>}
        </div>
      </div>

      {guesses && guesses.detectives.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 rounded-xl bg-panel p-4">
            <h3 className="font-semibold">{t('showdown.detectives')}</h3>
            {guesses.detectives.map(({ memberId, correct, total }) => (
              <p key={memberId} className="flex items-center justify-between text-sm">
                <MemberTag memberId={memberId} suffix={correct > 0 && correct === guesses.detectives[0].correct ? '🏅' : undefined} />
                <span className="text-muted">{t('showdown.right', { correct, total })}</span>
              </p>
            ))}
          </div>
          <div className="space-y-2 rounded-xl bg-panel p-4">
            <h3 className="font-semibold">{t('showdown.recognisable')}</h3>
            {guesses.recognised.map(({ ownerId, correct, guessers }) => (
              <p key={ownerId} className="flex items-center justify-between text-sm">
                <MemberTag memberId={ownerId} />
                <span className="text-muted">{guessers ? t('showdown.guessedIt', { correct, guessers }) : t('showdown.noGuesses')}</span>
              </p>
            ))}
          </div>
        </div>
      )}

      {results.controversial.length > 0 && (
        <div className="space-y-2">
          <h3 className="font-semibold">{t('showdown.divisive')}</h3>
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
          {t(results.unanimous.length > 8 ? 'showdown.agreedMore' : 'showdown.agreed', {
            films: results.unanimous
              .slice(0, 8)
              .map(({ filmId, tierIndex }) => `${filmById.get(filmId)?.name ?? '?'} (${showdown.tiers[tierIndex]?.label ?? '?'})`)
              .join(', '),
            count: results.unanimous.length - 8,
          })}
        </p>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {order.map((memberId, index) => {
          const best = results.best.find((b) => b.memberId === memberId)?.votes ?? 0
          const worst = results.worst.find((w) => w.memberId === memberId)?.votes ?? 0
          const about = Object.entries(showdown.guesses).filter(([guesser, g]) => guesser !== memberId && g[memberId])
          return (
            <BoardCard
              key={memberId}
              memberId={memberId}
              title={
                guessing ? (
                  <span className="inline-flex items-center gap-2">
                    <span className="text-muted">{t('showdown.listWas', { letter: listLetter(index) })}</span> <MemberTag memberId={memberId} />
                  </span>
                ) : undefined
              }
              footer={
                guessing &&
                about.length > 0 && (
                  <p className="text-xs text-muted">
                    {about.map(([guesser, g], i) => (
                      <span key={guesser}>
                        {i > 0 && ' · '}
                        {nameOf(guesser)} {g[memberId] === memberId ? <span className="text-lb-green">✓</span> : <span className="text-red-400">✗ ({nameOf(g[memberId])})</span>}
                      </span>
                    ))}
                  </p>
                )
              }
              tiers={showdown.boards[memberId]}
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
          {t('showdown.newShowdown')}
        </Button>
      )}
    </div>
  )
}

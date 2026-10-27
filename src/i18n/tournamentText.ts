import { useMemo } from 'react'
import type { TournamentImageTexts } from '../lib/export/tournamentPng'
import { placeRange, roundInfo, type Tournament } from '../lib/tournament'
import { ordinal, useLanguage, useT } from '.'

/** Translated round names, places and image labels for tournaments. */
export function useTournamentText() {
  const t = useT()
  const language = useLanguage()
  return useMemo(
    () => ({
      /** "Final", "Semi-finals", "Round of 32"… */
      roundLabel(size: number, round: number): string {
        const { kind, remaining } = roundInfo(size, round)
        if (kind === 'final') return t('round.final')
        if (kind === 'semi') return t('round.semi')
        if (kind === 'quarter') return t('round.quarter')
        // Several languages have a dedicated name for the round of 16 (huitièmes, oitavas…).
        if (remaining === 16) return t('round.sixteen')
        return t('round.of', { n: remaining, half: remaining / 2 })
      },
      /** "Champion", "Runner-up", "3rd–4th"… */
      placeLabel(place: number): string {
        if (place === 1) return t('place.champion')
        if (place === 2) return t('place.runnerUp')
        const [from, to] = placeRange(place)
        return t('place.range', { from: ordinal(language, from), to: ordinal(language, to), fromN: from, toN: to })
      },
      imageTexts(title: string, bracket: Tournament): TournamentImageTexts {
        return {
          title,
          subtitle: t('tournament.imageSubtitle', {
            films: t('common.films', { count: bracket.seeds.length }),
            matches: t('tournament.matches', { count: bracket.history.length }),
          }),
          champion: t('place.champion'),
          runnerUp: t('place.runnerUp'),
          semiFinalists: t('tournament.semiFinalists'),
          quarterFinalists: t('tournament.quarterFinalists'),
          seed: (seed) => t('tournament.seed', { seed }),
          footer: t('common.pngFooter'),
        }
      },
    }),
    [t, language],
  )
}

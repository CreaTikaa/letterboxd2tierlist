import { AppError } from '../errors'
import type { Film, Filters, Match, RatingMap, Tier } from '../types'

export interface SaveFile {
  app: 'letterboxd2tierlist'
  version: 1
  savedAt: string
  films: Film[]
  matches: Record<string, Match>
  tiers: Tier[]
  ratingMap: RatingMap
  filters: Filters
}

export function createSaveFile(data: Omit<SaveFile, 'app' | 'version' | 'savedAt'>): SaveFile {
  return { app: 'letterboxd2tierlist', version: 1, savedAt: new Date().toISOString(), ...data }
}

export function parseSaveFile(text: string): SaveFile {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    throw new AppError('notJson', 'This file is not valid JSON.')
  }
  const save = data as Partial<SaveFile>
  if (save?.app !== 'letterboxd2tierlist' || save.version !== 1) {
    throw new AppError('notSaveFile', 'This is not a letterboxd2tierlist save file.')
  }
  if (!Array.isArray(save.films) || !Array.isArray(save.tiers) || typeof save.matches !== 'object') {
    throw new AppError('corruptSave', 'The save file is incomplete or corrupted.')
  }
  return save as SaveFile
}

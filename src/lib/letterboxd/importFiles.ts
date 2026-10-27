import JSZip from 'jszip'
import { AppError } from '../errors'
import type { Film, LetterboxdList } from '../types'
import { applyLikes, mergeExport, parseList, type ExportCsvs } from './parse'

// The export also has deleted/, orphaned/, lists/ and likes/ folders whose CSVs must not be mixed in.
const IGNORED_FOLDERS = /(^|\/)(deleted|orphaned|lists|likes)\//i
const REMOVED_FOLDERS = /(^|\/)(deleted|orphaned)\//i
const LIKES_FILE = /(^|\/)likes\/films\.csv$/i
const LIST_FILE = /(^|\/)lists\/[^/]+\.csv$/i

export interface LetterboxdLibrary {
  films: Film[]
  lists: LetterboxdList[]
}

function classifyCsv(fileName: string): keyof ExportCsvs | null {
  const base = fileName.split('/').pop()!.toLowerCase()
  if (base === 'watched.csv') return 'watched'
  if (base === 'ratings.csv') return 'ratings'
  return null
}

/** Accepts the Letterboxd export ZIP, or watched.csv / ratings.csv picked directly. */
export async function readLetterboxdFiles(files: File[]): Promise<LetterboxdLibrary> {
  const csvs: ExportCsvs = {}
  let likes = ''
  const lists: LetterboxdList[] = []

  for (const file of files) {
    const lower = file.name.toLowerCase()
    if (lower.endsWith('.zip')) {
      const zip = await JSZip.loadAsync(file)
      for (const entry of Object.values(zip.files)) {
        if (entry.dir || REMOVED_FOLDERS.test(entry.name)) continue
        if (LIKES_FILE.test(entry.name)) likes = await entry.async('string')
        if (LIST_FILE.test(entry.name)) {
          const list = parseList(await entry.async('string'), entry.name)
          if (list) lists.push(list)
        }
        if (IGNORED_FOLDERS.test(entry.name)) continue
        const kind = classifyCsv(entry.name)
        if (kind) csvs[kind] = await entry.async('string')
      }
    } else if (lower.endsWith('.csv')) {
      // Loose name matching so renamed single files ("my-ratings.csv") still work.
      const kind = classifyCsv(lower) ?? (lower.includes('rating') ? 'ratings' : 'watched')
      csvs[kind] = await file.text()
    }
  }

  if (!csvs.watched && !csvs.ratings) {
    throw new AppError('noExportFiles', 'No watched.csv or ratings.csv found.')
  }
  const merged = mergeExport(csvs)
  if (merged.length === 0) throw new AppError('noFilms', 'The export was read, but no films were found in it.')
  const films = likes ? applyLikes(merged, likes) : merged
  return { films, lists: lists.sort((a, b) => a.name.localeCompare(b.name)) }
}

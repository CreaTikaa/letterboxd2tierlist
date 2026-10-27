import JSZip from 'jszip'
import { AppError } from '../errors'
import type { Film } from '../types'
import { mergeExport, type ExportCsvs } from './parse'

// The export also has deleted/, orphaned/, lists/ and likes/ folders whose CSVs must not be mixed in.
const IGNORED_FOLDERS = /(^|\/)(deleted|orphaned|lists|likes)\//i

function classifyCsv(fileName: string): keyof ExportCsvs | null {
  const base = fileName.split('/').pop()!.toLowerCase()
  if (base === 'watched.csv') return 'watched'
  if (base === 'ratings.csv') return 'ratings'
  return null
}

/** Accepts the Letterboxd export ZIP, or watched.csv / ratings.csv picked directly. */
export async function readLetterboxdFiles(files: File[]): Promise<Film[]> {
  const csvs: ExportCsvs = {}

  for (const file of files) {
    const lower = file.name.toLowerCase()
    if (lower.endsWith('.zip')) {
      const zip = await JSZip.loadAsync(file)
      for (const entry of Object.values(zip.files)) {
        if (entry.dir || IGNORED_FOLDERS.test(entry.name)) continue
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
  const films = mergeExport(csvs)
  if (films.length === 0) throw new AppError('noFilms', 'The export was read, but no films were found in it.')
  return films
}

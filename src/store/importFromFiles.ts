import { parseSaveFile } from '../lib/export/saveFile'
import { readLetterboxdFiles } from '../lib/letterboxd/importFiles'
import { useStore } from './useStore'

/** Handles both a Letterboxd export (ZIP/CSV) and a letterboxd2tierlist save file (JSON). */
export async function importFromFiles(files: File[]): Promise<boolean> {
  const { importFilms, loadSave, notify } = useStore.getState()
  try {
    const saveFile = files.find((f) => f.name.toLowerCase().endsWith('.json'))
    if (saveFile) {
      const save = parseSaveFile(await saveFile.text())
      loadSave(save)
      notify({ kind: 'success', text: `Loaded tier list with ${save.films.length} films.` })
    } else {
      const films = await readLetterboxdFiles(files)
      importFilms(films)
      const rated = films.filter((f) => f.rating != null).length
      notify({ kind: 'success', text: `Imported ${films.length} films (${rated} rated).` })
    }
    return true
  } catch (error) {
    notify({ kind: 'error', text: error instanceof Error ? error.message : 'Could not read that file.' })
    return false
  }
}

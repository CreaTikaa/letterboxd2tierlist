import { errorMessage, t } from '../i18n'
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
      notify({ kind: 'success', text: t('import.loadedSave', { count: save.films.length }) })
    } else {
      const { films, lists } = await readLetterboxdFiles(files)
      importFilms(films, lists)
      const rated = films.filter((f) => f.rating != null).length
      const liked = films.filter((f) => f.liked).length
      notify({
        kind: 'success',
        text: lists.length || liked ? t('import.importedExtras', { count: films.length, rated, liked, lists: t('import.lists', { count: lists.length }) }) : t('import.imported', { count: films.length, rated }),
      })
    }
    return true
  } catch (error) {
    notify({ kind: 'error', text: error instanceof Error ? errorMessage(t, error) : t('errors.readFile') })
    return false
  }
}

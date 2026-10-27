/** Errors the UI shows to people; `code` picks the translated message, `message` stays English for logs/tests. */
export type ErrorCode = 'noExportFiles' | 'noFilms' | 'notJson' | 'notSaveFile' | 'corruptSave' | 'brokenLink' | 'newerLink'

export class AppError extends Error {
  readonly code: ErrorCode

  constructor(code: ErrorCode, message: string) {
    super(message)
    this.code = code
  }
}

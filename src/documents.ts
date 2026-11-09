import type { JSONContent } from '@tiptap/react'

export const MAX_TITLE = 120
export const MAX_IMPORT_BYTES = 64 * 1024
export const EMPTY_DOCUMENT: JSONContent = { type: 'doc', content: [{ type: 'paragraph' }] }

export function normalizeTitle(title: string) {
  const trimmed = title.trim()
  if (!trimmed || trimmed.length > MAX_TITLE) {
    throw new Error(`Enter a title between 1 and ${MAX_TITLE} characters.`)
  }
  return trimmed
}

export async function importText(file: File) {
  if (!/\.txt$/i.test(file.name) || file.size > MAX_IMPORT_BYTES) {
    throw new Error('Choose a .txt file up to 64 KiB.')
  }

  const bytes = await file.arrayBuffer()
  let text: string
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    throw new Error('Save the file as UTF-8 and try again.')
  }
  if (!text.trim() || text.includes('\0')) {
    throw new Error('Choose a text file with readable content.')
  }

  const title = file.name.slice(0, -4).trim().slice(0, MAX_TITLE).trim() || 'Untitled document'
  const content: JSONContent = {
    type: 'doc',
    content: text.split(/\r\n?|\n/).map((line) => ({
      type: 'paragraph',
      ...(line ? { content: [{ type: 'text', text: line }] } : {}),
    })),
  }
  return { title, content }
}

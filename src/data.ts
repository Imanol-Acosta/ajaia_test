import { createClient } from '@supabase/supabase-js'
import type { JSONContent } from '@tiptap/react'
import { EMPTY_DOCUMENT, normalizeTitle } from './documents'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
export const supabase = url && key ? createClient(url, key) : null

export type DocumentSummary = {
  id: string
  owner_id: string
  title: string
  updated_at: string
}

export type DocumentRecord = DocumentSummary & {
  content: JSONContent
  revision: number
}

export type Person = { id: string; display_name: string }
export type AccessRole = 'viewer' | 'editor'
export type DocumentShare = { recipient_id: string; access_role: AccessRole }
export type OpenDocument = DocumentRecord & { accessRole: 'owner' | AccessRole }

const summaryFields = 'id, owner_id, title, updated_at'
const documentFields = 'id, owner_id, title, updated_at, content, revision'

function client() {
  if (!supabase) throw new Error('Configure the Supabase URL and publishable key.')
  return supabase
}

export async function listDocuments(): Promise<DocumentSummary[]> {
  const { data, error } = await client()
    .from('documents').select(summaryFields).order('updated_at', { ascending: false })
  if (error) throw new Error('Could not load your documents. Try again.')
  return data
}

export async function readDocument(id: string, userId: string): Promise<OpenDocument | null> {
  const { data, error } = await client()
    .from('documents').select(`${documentFields}, document_shares(access_role)`)
    .eq('id', id).eq('document_shares.recipient_id', userId).maybeSingle()
  if (error?.code === '22P02') return null
  if (error) throw new Error('Could not open this document. Try again.')
  if (!data) return null
  const { document_shares: shares, ...document } = data
  const accessRole = document.owner_id === userId ? 'owner' : shares[0]?.access_role
  return accessRole ? { ...document, accessRole } : null
}

export async function createDocument(title = 'Untitled document', content = EMPTY_DOCUMENT) {
  const { data, error } = await client().from('documents')
    .insert({ title, content }).select('id').single()
  if (error) throw new Error('Could not create the document. Try again.')
  return data.id as string
}

export async function deleteDocument(id: string) {
  const { data, error } = await client().from('documents')
    .delete().eq('id', id).select('id').maybeSingle()
  if (error || !data) throw new Error('Could not delete the document. Refresh and try again.')
}

export async function saveDocument(id: string, revision: number, title: string, content: JSONContent) {
  const { data, error } = await client().from('documents')
    .update({ title: normalizeTitle(title), content }).eq('id', id).eq('revision', revision)
    .select(documentFields).maybeSingle()
  if (error?.code === '23514') throw new Error('This document exceeds the size limit.')
  if (error) throw new Error('Could not save your changes. Try again.')
  return data as DocumentRecord | null
}

export async function listPeople(userId: string): Promise<Person[]> {
  const { data, error } = await client().from('demo_people')
    .select('id, display_name').neq('id', userId).order('display_name')
  if (error) throw new Error('Could not load demo accounts. Try again.')
  return data
}

export async function listDocumentShares(documentId: string): Promise<DocumentShare[]> {
  const { data, error } = await client().from('document_shares')
    .select('recipient_id, access_role').eq('document_id', documentId)
  if (error) throw new Error('Could not load shared access. Reopen the dialog to try again.')
  return data
}

export async function shareDocument(documentId: string, recipientId: string, role: AccessRole) {
  const { error } = await client().rpc('set_document_access', {
    target_document_id: documentId,
    target_recipient_id: recipientId,
    new_access_role: role,
  })
  if (error) throw new Error('Could not save access. Try again.')
}

export function messageFor(error: unknown) {
  return error instanceof Error ? error.message : 'Something went wrong. Try again.'
}

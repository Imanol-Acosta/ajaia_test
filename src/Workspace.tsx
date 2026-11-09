import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useOutletContext } from 'react-router-dom'
import type { Session } from '@supabase/supabase-js'
import { ArrowUpRight, FileText, FileUp, LogOut, Plus, Trash2, TriangleAlert, UsersRound } from 'lucide-react'
import { Brand } from './Brand'
import { createDocument, deleteDocument, listDocuments, messageFor, supabase } from './data'
import type { DocumentSummary } from './data'
import { importText } from './documents'

const dateFormat = new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' })

function DocumentList({ documents, onDelete, busy }: {
  documents: DocumentSummary[]
  onDelete?: (document: DocumentSummary) => void
  busy?: boolean
}) {
  const shared = !onDelete

  return (
    <section className="document-list" aria-labelledby={shared ? 'shared-title' : 'owned-title'}>
      <div className="list-heading">
        <h2 id={shared ? 'shared-title' : 'owned-title'}>{shared ? 'Shared with me' : 'My documents'}</h2>
        <span className="count">{documents.length}</span>
      </div>
      {documents.length ? (
        <ul className="document-rows">
          {documents.map((document) => (
            <li key={document.id}>
              <Link className="document-row" to={`/docs/${document.id}`}>
                <span className="file-icon"><FileText size={21} aria-hidden="true" /></span>
                <span className="row-description">
                  <strong>{document.title}</strong>
                  <span>Updated {dateFormat.format(new Date(document.updated_at))}</span>
                </span>
                <ArrowUpRight size={17} aria-hidden="true" className="row-arrow" />
              </Link>
              {onDelete && (
                <button type="button" className="icon-button delete-document" title="Delete document"
                  aria-label={`Delete ${document.title}`} disabled={busy} onClick={() => onDelete(document)}>
                  <Trash2 size={15} aria-hidden="true" />
                </button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <div className="empty-list">
          {shared ? <UsersRound size={24} aria-hidden="true" /> : <FileText size={24} aria-hidden="true" />}
          <strong>{shared ? 'Nothing shared yet' : 'Start with a blank page'}</strong>
          <p>{shared ? 'Documents shared with your account will appear here.' : 'Create a document or import an existing text file.'}</p>
        </div>
      )}
    </section>
  )
}

export function Workspace() {
  const { user } = useOutletContext<Session>()
  const navigate = useNavigate()
  const filePicker = useRef<HTMLInputElement>(null)
  const deleteDialog = useRef<HTMLDialogElement>(null)
  const [documents, setDocuments] = useState<DocumentSummary[] | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Pick<DocumentSummary, 'id' | 'title'> | null>(null)
  const [deleteError, setDeleteError] = useState('')
  const [loadError, setLoadError] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [retry, setRetry] = useState(0)
  const [busy, setBusy] = useState<'new' | 'import' | 'sign-out' | 'delete' | null>(null)

  useEffect(() => {
    let active = true
    listDocuments().then(
      (items) => { if (active) setDocuments(items) },
      (failure: unknown) => { if (active) setLoadError(messageFor(failure)) },
    )
    return () => { active = false }
  }, [retry, user.id])

  useEffect(() => {
    const dialog = deleteDialog.current
    if (deleteTarget && dialog && !dialog.open) dialog.showModal()
  }, [deleteTarget])

  async function openNew(file?: File) {
    setBusy(file ? 'import' : 'new')
    setError('')
    try {
      const draft = file ? await importText(file) : undefined
      const id = await createDocument(draft?.title, draft?.content)
      navigate(`/docs/${id}`)
    } catch (failure) {
      setError(messageFor(failure))
    } finally {
      setBusy(null)
    }
  }

  async function signOut() {
    if (!supabase) return
    setBusy('sign-out')
    setError('')
    try {
      const { error: signOutError } = await supabase.auth.signOut({ scope: 'local' })
      if (signOutError) throw signOutError
    } catch {
      setError('Could not sign out. Try again.')
    } finally {
      setBusy(null)
    }
  }

  function requestDelete({ id, title }: DocumentSummary) {
    setDeleteError('')
    setDeleteTarget({ id, title })
  }

  async function removeDocument() {
    if (busy || !deleteTarget || !deleteDialog.current?.open) return
    setBusy('delete')
    setError('')
    setNotice('')
    setDeleteError('')
    try {
      await deleteDocument(deleteTarget.id)
      deleteDialog.current?.close()
      setDocuments((items) => items?.filter((item) => item.id !== deleteTarget.id) ?? null)
      setNotice('Document deleted.')
    } catch (failure) {
      setDeleteError(messageFor(failure))
    } finally {
      setBusy(null)
    }
  }

  return (
    <>
      <header className="app-header">
        <Link to="/" aria-label="Folio workspace"><Brand /></Link>
        <div className="account">
          <span className="account-email">{user.email}</span>
          <button type="button" className="button ghost" disabled={busy !== null} onClick={signOut}>
            <LogOut size={16} aria-hidden="true" /> Sign out
          </button>
        </div>
      </header>
      <main className="workspace screen-enter">
        <header className="workspace-intro">
          <div>
            <p className="eyebrow">YOUR WORKSPACE</p>
            <h1>Documents</h1>
            <p className="muted">Pick up a draft, start a new one, or open a document shared with you.</p>
          </div>
          <div className="workspace-actions">
            <div className="actions">
              <button type="button" className="button secondary" disabled={busy !== null} onClick={() => filePicker.current?.click()}>
                <FileUp size={17} aria-hidden="true" /> {busy === 'import' ? 'Importing…' : 'Import .txt'}
              </button>
              <button type="button" className="button primary" disabled={busy !== null} onClick={() => openNew()}>
                <Plus size={19} aria-hidden="true" /> {busy === 'new' ? 'Creating…' : 'New document'}
              </button>
            </div>
            <p className="import-hint">UTF-8 text files up to 64 KiB</p>
            <input ref={filePicker} type="file" hidden accept=".txt" aria-label="Import a text file" onChange={(event) => {
              const file = event.currentTarget.files?.[0]
              event.currentTarget.value = ''
              if (file) void openNew(file)
            }} />
          </div>
        </header>
        {error && <p role="alert" className="error">{error}</p>}
        {notice && <p role="status" className="success">{notice}</p>}
        {loadError ? (
          <div className="feedback"><p role="alert" className="error">{loadError}</p>
            <button className="button secondary" onClick={() => { setLoadError(''); setRetry((value) => value + 1) }}>Retry</button>
          </div>
        ) : documents === null ? <p role="status" className="muted">Loading documents…</p> : (
          <div className="workspace-lists">
            <DocumentList documents={documents.filter((document) => document.owner_id === user.id)} onDelete={requestDelete} busy={busy !== null} />
            <DocumentList documents={documents.filter((document) => document.owner_id !== user.id)} />
          </div>
        )}
      </main>
      <dialog ref={deleteDialog} className="workspace-dialog delete-dialog" role="alertdialog"
        aria-labelledby="delete-title" aria-describedby="delete-description"
        onCancel={(event) => { if (busy === 'delete') event.preventDefault() }}>
        <div className="dialog-top">
          <span className="delete-warning"><TriangleAlert size={19} aria-hidden="true" /></span>
          <h2 id="delete-title">Delete document?</h2>
        </div>
        <p id="delete-description" className="muted">
          <strong>“{deleteTarget?.title}”</strong> will be permanently deleted. Anyone it was shared with will lose access.
        </p>
        {deleteError && <p role="alert" className="error">{deleteError}</p>}
        <div className="dialog-actions">
          <button type="button" className="button secondary" disabled={busy === 'delete'}
            onClick={() => deleteDialog.current?.close()}>Cancel</button>
          <button type="button" className="button danger" disabled={busy === 'delete'} onClick={removeDocument}>
            {busy === 'delete' ? 'Deleting…' : 'Delete document'}
          </button>
        </div>
      </dialog>
    </>
  )
}

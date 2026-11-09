import { useCallback, useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useBeforeUnload, useBlocker, useOutletContext, useParams } from 'react-router-dom'
import type { Session } from '@supabase/supabase-js'
import { EditorContent, useEditor, useEditorState } from '@tiptap/react'
import type { Editor } from '@tiptap/react'
import { Selection, TextSelection } from '@tiptap/pm/state'
import type { Transaction } from '@tiptap/pm/state'
import { canSplit } from '@tiptap/pm/transform'
import StarterKit from '@tiptap/starter-kit'
import { ArrowLeft, Bold, Check, Eye, Heading1, Heading2, Italic, Link2, List, ListOrdered, PencilLine, Underline, UserRoundPlus, X } from 'lucide-react'
import { Brand } from './Brand'
import { listDocumentShares, listPeople, messageFor, readDocument, saveDocument, shareDocument } from './data'
import type { AccessRole, DocumentRecord, DocumentShare, OpenDocument, Person } from './data'
import { MAX_TITLE } from './documents'

const extensions = [
  StarterKit.configure({
    heading: { levels: [1, 2] },
    blockquote: false,
    code: false,
    codeBlock: false,
    horizontalRule: false,
    link: false,
    strike: false,
    trailingNode: false,
  }),
]

const accessOptions = [
  { value: 'viewer', label: 'Viewer', description: 'Read the document.' },
  { value: 'editor', label: 'Editor', description: 'Read, rename, and edit.' },
] as const

function isolateSelectedBlocks(tr: Transaction) {
  const { selection, doc } = tr
  if (!(selection instanceof TextSelection) || selection.empty) return true

  const { $from, $to } = selection
  // A selection ending at the next block's first position contains none of its text.
  const from = $from.depth === 1 && $from.parentOffset === $from.parent.content.size
    ? Selection.findFrom(doc.resolve($from.after()), 1, true)?.from ?? selection.from
    : selection.from
  const to = $to.depth === 1 && $to.parentOffset === 0
    ? Selection.findFrom(doc.resolve($to.before()), -1, true)?.to ?? selection.to
    : selection.to
  if (from >= to) return false

  const firstStep = tr.steps.length
  // Split the end first so the start position stays valid, even within one block.
  for (const position of [to, from]) {
    const $position = tr.doc.resolve(position)
    if ($position.depth !== 1 || !$position.parent.isTextblock
      || $position.parentOffset === 0 || $position.parentOffset === $position.parent.content.size) continue
    if (!canSplit(tr.doc, position)) return false
    tr.split(position)
  }

  if (tr.steps.length === firstStep && from === selection.from && to === selection.to) return true
  const mapping = tr.mapping.slice(firstStep)
  const start = mapping.map(from, 1)
  const end = mapping.map(to, -1)
  const backwards = selection.anchor > selection.head
  tr.setSelection(TextSelection.create(tr.doc, backwards ? end : start, backwards ? start : end))
  return true
}

type FormattingChain = ReturnType<Editor['chain']>

function applyBlockFormat(editor: Editor, format: (chain: FormattingChain) => FormattingChain) {
  editor.commands.command(({ tr, chain }) => {
    const applied = isolateSelectedBlocks(tr) && format(chain().focus()).run()
    // Keep splitting and formatting atomic so an unsupported command leaves the text intact.
    if (!applied) tr.setMeta('preventDispatch', true)
    return applied
  })
}

function FormatBar({ editor }: { editor: Editor }) {
  const formats = useEditorState({
    editor,
    selector: ({ editor }) => ({
      bold: editor.isActive('bold'),
      italic: editor.isActive('italic'),
      underline: editor.isActive('underline'),
      h1: editor.isActive('heading', { level: 1 }),
      h2: editor.isActive('heading', { level: 2 }),
      bullets: editor.isActive('bulletList'),
      numbers: editor.isActive('orderedList'),
    }),
  })
  const buttons = [
    { name: 'Bold', icon: Bold, active: formats.bold, run: () => editor.chain().focus().toggleBold().run() },
    { name: 'Italic', icon: Italic, active: formats.italic, run: () => editor.chain().focus().toggleItalic().run() },
    { name: 'Underline', icon: Underline, active: formats.underline, run: () => editor.chain().focus().toggleUnderline().run() },
    { name: 'Heading 1', icon: Heading1, active: formats.h1, run: () => applyBlockFormat(editor, (chain) => chain.toggleHeading({ level: 1 })) },
    { name: 'Heading 2', icon: Heading2, active: formats.h2, run: () => applyBlockFormat(editor, (chain) => chain.toggleHeading({ level: 2 })) },
    { name: 'Bulleted list', icon: List, active: formats.bullets, run: () => applyBlockFormat(editor, (chain) => chain.toggleBulletList()) },
    { name: 'Numbered list', icon: ListOrdered, active: formats.numbers, run: () => applyBlockFormat(editor, (chain) => chain.toggleOrderedList()) },
  ]
  return (
    <div className="format-bar" role="group" aria-label="Text formatting">
      {buttons.map(({ name, icon: Icon, active, run }) => (
        <button type="button" key={name} title={name} aria-label={name} aria-pressed={active}
          className="icon-button" onMouseDown={(event) => event.preventDefault()} onClick={run}>
          <Icon size={18} aria-hidden="true" />
        </button>
      ))}
    </div>
  )
}

function ShareDialog({ documentId, userId, open, onClose }: {
  documentId: string
  userId: string
  open: boolean
  onClose: () => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [access, setAccess] = useState<{ people: Person[]; grants: DocumentShare[] } | null>(null)
  const [recipient, setRecipient] = useState('')
  const [roleChoice, setRoleChoice] = useState<AccessRole | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const currentRole = access?.grants.find((grant) => grant.recipient_id === recipient)?.access_role
  const role = roleChoice ?? currentRole ?? 'viewer'

  useEffect(() => {
    if (!open) return
    if (dialog.current && !dialog.current.open) dialog.current.showModal()
    setAccess(null)
    setRecipient('')
    setRoleChoice(null)
    setError('')
    setNotice('')
    let active = true
    Promise.all([listPeople(userId), listDocumentShares(documentId)]).then(
      ([people, grants]) => { if (active) setAccess({ people, grants }) },
      (failure: unknown) => { if (active) setError(messageFor(failure)) },
    )
    return () => { active = false }
  }, [documentId, open, userId])

  async function share(event: FormEvent) {
    event.preventDefault()
    if (!access || !recipient || busy) return
    setBusy(true)
    setError('')
    setNotice('')
    try {
      await shareDocument(documentId, recipient, role)
      setAccess({
        people: access.people,
        grants: [...access.grants.filter((grant) => grant.recipient_id !== recipient), { recipient_id: recipient, access_role: role }],
      })
      setRoleChoice(null)
      setNotice(role === 'editor' ? 'Editor access saved.' : 'Viewer access saved.')
    } catch (failure) {
      setError(messageFor(failure))
    } finally {
      setBusy(false)
    }
  }

  async function copyLink() {
    setError('')
    try {
      await navigator.clipboard.writeText(new URL(`/docs/${documentId}`, window.location.origin).href)
      setNotice('Document link copied.')
    } catch {
      setError('Could not copy the link. You can copy the address from your browser.')
    }
  }

  return (
    <dialog ref={dialog} className="workspace-dialog" aria-labelledby="share-title" onClose={onClose}
      onCancel={(event) => { if (busy) event.preventDefault() }}>
      <div className="dialog-top">
        <div><p className="eyebrow">DOCUMENT ACCESS</p><h2 id="share-title">Share document</h2></div>
        <button type="button" aria-label="Close" className="icon-button" disabled={busy} onClick={() => dialog.current?.close()}>
          <X size={21} aria-hidden="true" />
        </button>
      </div>
      <p className="muted">Choose who can open this document and what they can do.</p>
      <form className="share-form" onSubmit={share}>
        <label>Share with
          <select value={recipient} onChange={(event) => {
            setRecipient(event.target.value)
            setRoleChoice(null)
            setNotice('')
            setError('')
          }} required disabled={!access?.people.length || busy}>
            <option value="">{access === null ? (error ? 'Accounts unavailable' : 'Loading accounts…') : access.people.length ? 'Select an account' : 'No other demo accounts'}</option>
            {access?.people.map((person) => <option key={person.id} value={person.id}>{person.display_name}</option>)}
          </select>
        </label>
        <fieldset className="access-options" disabled={!recipient || busy}>
          <legend>Access</legend>
          {accessOptions.map(({ value, label, description }) => (
            <label className="access-option" key={value}>
              <input type="radio" name="access-role" value={value} checked={role === value}
                aria-labelledby={`access-${value}-label`} aria-describedby={`access-${value}-description`}
                onChange={() => { setRoleChoice(value); setNotice('') }} />
              <span>
                <strong id={`access-${value}-label`}>{label}</strong>
                <span className="access-description" id={`access-${value}-description`}>{description}</span>
              </span>
            </label>
          ))}
        </fieldset>
        <div className="dialog-actions">
          <button type="button" className="button secondary" onClick={copyLink}><Link2 size={17} aria-hidden="true" /> Copy link</button>
          <button type="submit" className="button primary" disabled={!access || !recipient || busy}>
            {busy ? 'Saving…' : currentRole ? 'Save access' : 'Grant access'}
          </button>
        </div>
      </form>
      {notice && <p className="success" role="status">{notice}</p>}
      {error && <p className="error" role="alert">{error}</p>}
    </dialog>
  )
}

function DocumentEditor({ initial, userId }: { initial: OpenDocument; userId: string }) {
  const [document, setDocument] = useState<DocumentRecord>(initial)
  const [title, setTitle] = useState(initial.title)
  const [contentDirty, setContentDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [sharing, setSharing] = useState(false)
  const [error, setError] = useState('')
  const [conflict, setConflict] = useState(false)
  const [invalidContent, setInvalidContent] = useState(false)
  const owner = initial.accessRole === 'owner'
  const canEdit = owner || initial.accessRole === 'editor'
  const dirty = canEdit && (title !== document.title || contentDirty)
  const editCount = useRef(0)
  const editor = useEditor({
    extensions,
    editable: canEdit,
    content: initial.content,
    enableContentCheck: true,
    editorProps: {
      attributes: { 'aria-label': 'Document content', role: 'textbox', 'aria-multiline': 'true', 'aria-readonly': String(!canEdit) },
    },
    onUpdate: () => {
      editCount.current += 1
      setContentDirty(true)
    },
    onContentError: () => { setInvalidContent(true) },
  })

  const blocker = useBlocker(dirty || saving)
  useEffect(() => {
    if (blocker.state === 'blocked') {
      if (!saving && window.confirm('Leave this document with unsaved changes?')) blocker.proceed()
      else blocker.reset()
    }
  }, [blocker, saving])
  useBeforeUnload(useCallback((event: BeforeUnloadEvent) => {
    if (dirty || saving) event.preventDefault()
  }, [dirty, saving]))

  async function save(event: FormEvent) {
    event.preventDefault()
    if (!canEdit || !editor || saving || invalidContent || conflict) return
    setError('')
    setSaving(true)
    const change = editCount.current
    try {
      const updated = await saveDocument(document.id, document.revision, title, editor.getJSON())
      if (!updated) {
        setConflict(true)
        setError('The saved version or your edit access changed. Copy any changes you need before reloading.')
        return
      }
      setDocument(updated)
      setTitle((current) => current === title ? updated.title : current)
      setContentDirty(editCount.current !== change)
    } catch (failure) {
      setError(messageFor(failure))
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <header className="app-header">
        <Link to="/" aria-label="Folio workspace"><Brand /></Link>
        <Link className="button ghost" to="/"><ArrowLeft size={16} aria-hidden="true" /> All documents</Link>
      </header>
      <main className="editor-workspace screen-enter">
        <form className="editor-heading" onSubmit={save}>
          <div className="editor-title">
            <p className="eyebrow">{owner ? 'MY DOCUMENT' : 'SHARED WITH ME'}</p>
            {canEdit
              ? <input aria-label="Document title" value={title} maxLength={MAX_TITLE} onChange={(event) => setTitle(event.target.value)} />
              : <h1>{document.title}</h1>}
          </div>
          <div className="editor-actions">
            {canEdit ? (
              <>
                <span role="status" className={dirty ? 'save-status pending' : 'save-status'}>
                  {!dirty && !saving && <Check size={15} aria-hidden="true" />}
                  {saving ? 'Saving…' : dirty ? 'Unsaved changes' : 'Saved'}
                </span>
                {owner ? <button type="button" className="button secondary" onClick={() => setSharing(true)}>
                  <UserRoundPlus size={17} aria-hidden="true" /> Share
                </button> : <span className="read-only"><PencilLine size={16} aria-hidden="true" /> Editor</span>}
                <button type="submit" className="button primary" disabled={!editor || !dirty || saving || conflict || invalidContent}>Save</button>
              </>
            ) : <span className="read-only"><Eye size={17} aria-hidden="true" /> Read only</span>}
          </div>
        </form>
        {error && <p role="alert" className="error editor-feedback">{error}</p>}
        {invalidContent ? <p role="alert" className="error editor-feedback">This document contains an unsupported format.</p> : (
          <section className="paper" aria-label="Document">
            {canEdit && editor && <FormatBar editor={editor} />}
            <EditorContent editor={editor} className="editor-content" />
          </section>
        )}
      </main>
      {owner && <ShareDialog documentId={document.id} userId={userId} open={sharing} onClose={() => setSharing(false)} />}
    </>
  )
}

export function DocumentPage() {
  const { user } = useOutletContext<Session>()
  const { id } = useParams<{ id: string }>()
  const [result, setResult] = useState<{ id: string; document?: OpenDocument | null; error?: string } | null>(null)
  const [retry, setRetry] = useState(0)

  useEffect(() => {
    if (!id) return
    let active = true
    readDocument(id, user.id).then(
      (document) => { if (active) setResult({ id, document }) },
      (failure: unknown) => { if (active) setResult({ id, error: messageFor(failure) }) },
    )
    return () => { active = false }
  }, [id, retry, user.id])

  if (result?.id !== id || !result) return <main className="center-state"><Brand /><p role="status">Opening document…</p></main>
  if (result.document) return <DocumentEditor key={result.document.id} initial={result.document} userId={user.id} />
  return (
    <main className="center-state screen-enter">
      <Brand />
      <h1>Document unavailable</h1>
      <p role={result.error ? 'alert' : undefined}>{result.error || 'This document may be missing or you may need access.'}</p>
      <div className="actions">
        <Link className="button secondary" to="/">All documents</Link>
        <button className="button primary" onClick={() => { setResult(null); setRetry((value) => value + 1) }}>Try again</button>
      </div>
    </main>
  )
}

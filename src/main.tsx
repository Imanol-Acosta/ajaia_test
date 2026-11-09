import { StrictMode, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, Link, Outlet, RouterProvider } from 'react-router-dom'
import type { Session } from '@supabase/supabase-js'
import { ArrowRight } from 'lucide-react'
import { Brand } from './Brand'
import { supabase } from './data'
import { Workspace } from './Workspace'
import './styles.css'

function SignIn() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase || busy) return
    const fields = new FormData(event.currentTarget)
    setError('')
    setBusy(true)
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: String(fields.get('email')).trim(),
        password: String(fields.get('password')),
      })
      if (signInError) {
        setError(signInError.code === 'invalid_credentials'
          ? 'Check your email and password and try again.'
          : 'Could not sign in. Try again in a moment.')
      }
    } catch {
      setError('Could not reach the sign-in service. Try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="login screen-enter">
      <section className="login-cover" aria-labelledby="cover-title">
        <Brand />
        <div className="cover-art" aria-hidden="true">
          <div className="cover-sheet cover-sheet-back" />
          <div className="cover-sheet cover-sheet-front">
            <span>FOLIO / 01</span>
            <strong>Field<br />notes.</strong>
            <i /><i /><i />
          </div>
        </div>
        <div>
          <p className="eyebrow">THE DOCUMENT WORKSPACE</p>
          <h1 id="cover-title">Good work<br />starts on paper.</h1>
          <p className="cover-copy">Write, organize, and share documents in one place.</p>
        </div>
      </section>
      <section className="login-panel" aria-labelledby="sign-in-title">
        <form className="login-form" onSubmit={handleSubmit}>
          <p className="eyebrow">WORKSPACE ACCESS</p>
          <h2 id="sign-in-title">Sign in</h2>
          <p className="muted">Use either demo account from the submission to explore Folio.</p>
          <label>Email<input type="email" name="email" autoComplete="username" required /></label>
          <label>Password<input type="password" name="password" autoComplete="current-password" required /></label>
          {error && <p role="alert" className="error">{error}</p>}
          <button className="button primary" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'} <ArrowRight size={17} aria-hidden="true" />
          </button>
        </form>
      </section>
    </main>
  )
}

function SessionGate() {
  const [session, setSession] = useState<Session | null | undefined>(undefined)

  useEffect(() => {
    if (!supabase) return
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, activeSession) => {
      setSession(activeSession)
    })
    return () => subscription.unsubscribe()
  }, [])

  if (!supabase) {
    return <main className="center-state"><Brand /><p>Set the Supabase URL and publishable key in your environment.</p></main>
  }
  if (session === undefined) return <main className="center-state"><Brand /><p role="status">Opening workspace…</p></main>
  if (!session) return <SignIn />
  return <Outlet key={session.user.id} context={session} />
}

const router = createBrowserRouter([
  {
    element: <SessionGate />,
    hydrateFallbackElement: <main className="center-state"><Brand /><p role="status">Opening workspace…</p></main>,
    children: [
      { index: true, element: <Workspace /> },
      { path: 'docs/:id', lazy: async () => ({ Component: (await import('./DocumentPage')).DocumentPage }) },
      { path: '*', element: <main className="center-state"><h1>Page unavailable</h1><Link to="/">Back to workspace</Link></main> },
    ],
  },
])

createRoot(document.getElementById('root')!).render(<StrictMode><RouterProvider router={router} /></StrictMode>)

import { useState } from 'react'
import type { User } from '../hooks/useAuth'

interface Props {
  onSuccess: (token: string, user: User) => void
  onClose: () => void
}

type Tab = 'login' | 'register'

export default function AuthModal({ onSuccess, onClose }: Props) {
  const [tab, setTab] = useState<Tab>('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const body = tab === 'register'
        ? { email, password, name }
        : { email, password }
      const res = await fetch(`/api/auth/${tab}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Something went wrong')
      onSuccess(data.token, data.user)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)' }}
      onClick={e => e.target === e.currentTarget && onClose()}>

      <div className="card w-full max-w-sm relative animate-slide-up">
        <button onClick={onClose}
          className="absolute top-4 right-4 text-white/30 hover:text-white/70 text-lg transition-colors">✕</button>

        {/* Logo */}
        <div className="flex items-center gap-2 mb-6">
          <div className="w-8 h-8 rounded-lg gradient-bg flex items-center justify-center">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M8 5v14l11-7z" fill="white" />
            </svg>
          </div>
          <span className="font-bold text-white">Reel<span className="text-brand-400">ix</span></span>
        </div>

        {/* Tabs */}
        <div className="flex bg-white/5 rounded-xl p-1 mb-6">
          {(['login', 'register'] as Tab[]).map(t => (
            <button key={t} onClick={() => { setTab(t); setError(null) }}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${
                tab === t ? 'bg-brand-500 text-white shadow' : 'text-white/40 hover:text-white/70'
              }`}>
              {t === 'login' ? 'Sign in' : 'Create account'}
            </button>
          ))}
        </div>

        <form onSubmit={submit} className="space-y-3">
          {tab === 'register' && (
            <input
              type="text"
              placeholder="Your name"
              value={name}
              onChange={e => setName(e.target.value)}
              required
              className="input-field"
            />
          )}
          <input
            type="email"
            placeholder="Email address"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            className="input-field"
          />
          <input
            type="password"
            placeholder="Password (min 8 characters)"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            minLength={8}
            className="input-field"
          />

          {error && <p className="text-red-400 text-xs py-1">{error}</p>}

          <button type="submit" disabled={loading}
            className="btn-primary w-full justify-center py-3 disabled:opacity-50">
            {loading ? 'Please wait…' : tab === 'login' ? 'Sign in' : 'Create account'}
          </button>
        </form>

        <p className="text-white/25 text-xs text-center mt-4">
          {tab === 'login'
            ? <>No account? <button onClick={() => setTab('register')} className="text-brand-400 hover:text-brand-300">Sign up free</button></>
            : <>Already have an account? <button onClick={() => setTab('login')} className="text-brand-400 hover:text-brand-300">Sign in</button></>
          }
        </p>
      </div>
    </div>
  )
}

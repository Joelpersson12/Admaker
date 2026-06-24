import { useState } from 'react'
import LandingPage from './components/LandingPage'
import AdCreator from './components/AdCreator'
import DemoRecorder from './components/DemoRecorder'
import AuthModal from './components/AuthModal'
import { useAuth } from './hooks/useAuth'

export type View = 'landing' | 'creator' | 'demo'

export default function App() {
  const [view, setView] = useState<View>('landing')
  const [showAuth, setShowAuth] = useState(false)
  const { user, loading, login, logout } = useAuth()

  if (loading) return null

  const authProps = {
    user,
    onSignIn: () => setShowAuth(true),
    onSignOut: logout,
  }

  return (
    <>
      {showAuth && (
        <AuthModal
          onSuccess={(token, u) => { login(token, u); setShowAuth(false) }}
          onClose={() => setShowAuth(false)}
        />
      )}

      {view === 'creator' && <AdCreator onBack={() => setView('landing')} {...authProps} />}
      {view === 'demo' && <DemoRecorder onBack={() => setView('landing')} {...authProps} />}
      {view === 'landing' && (
        <LandingPage
          onStart={() => setView('creator')}
          onDemo={() => setView('demo')}
          {...authProps}
        />
      )}
    </>
  )
}

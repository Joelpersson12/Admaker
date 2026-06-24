import { useState } from 'react'
import LandingPage from './components/LandingPage'
import AdCreator from './components/AdCreator'

export type View = 'landing' | 'creator'

export default function App() {
  const [view, setView] = useState<View>('landing')

  if (view === 'creator') {
    return <AdCreator onBack={() => setView('landing')} />
  }

  return <LandingPage onStart={() => setView('creator')} />
}

import { useState, useEffect, useRef } from 'react'
import Header from './Header'
import type { User } from '../hooks/useAuth'

interface Props {
  onBack: () => void
  user?: User | null
  onSignIn?: () => void
  onSignOut?: () => void
}

type Phase = 'form' | 'planning' | 'recording' | 'encoding' | 'done' | 'error'

const PHASE_LABELS: Record<string, string> = {
  queued: 'Starting up…',
  planning: 'AI is planning the recording script…',
  recording: 'Recording the browser session…',
  encoding: 'Encoding video + adding captions…',
  done: 'Done!',
}


const EXAMPLES = [
  {
    label: '🔩 Cadio — CAD models',
    url: 'https://cadio.net',
    description: 'Show the homepage, click the Start Building button, type "headset stand" in the prompt, wait for the 3D model to generate, then scroll to show the result.',
    voiceover: "Tired of doing this the hard way? Our tool lets you do it in seconds — just sign up, follow the steps, and you're done. Try it free today.",
  },
  {
    label: '🐙 GitHub — open source',
    url: 'https://github.com/anthropics/anthropic-sdk-python',
    description: 'Show the repository homepage, scroll down through the README, click on the Code button to show the clone options.',
    voiceover: "Everything you need is right here. Browse the code, read the docs, and get started in minutes — completely open source and free to use.",
  },
  {
    label: '🎨 Tailwind CSS — docs',
    url: 'https://tailwindcss.com',
    description: 'Show the homepage, scroll through the features section, click Get Started, show the installation docs.',
    voiceover: "Stop writing custom CSS. Tailwind gives you utility classes that let you build any design directly in your HTML — faster than ever before.",
  },
]

export default function DemoRecorder({ onBack, user, onSignIn, onSignOut }: Props) {
  const [url, setUrl] = useState('')
  const [description, setDescription] = useState('')
  const [voiceover, setVoiceover] = useState('')
  const [phase, setPhase] = useState<Phase>('form')
  const [jobId, setJobId] = useState<string | null>(null)
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [phaseLabel, setPhaseLabel] = useState('')
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pollStartRef = useRef<number>(0)
  const errorCountRef = useRef<number>(0)

  useEffect(() => () => { if (pollRef.current) clearTimeout(pollRef.current) }, [])

  async function submit() {
    if (!url.trim() || !description.trim() || !voiceover.trim()) return
    setPhase('planning')
    setError(null)
    setVideoUrl(null)
    pollStartRef.current = Date.now()
    errorCountRef.current = 0

    try {
      const res = await fetch('/api/record-demo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim(), description: description.trim(), voiceover: voiceover.trim() }),
      })
      const data = await res.json()
      if (!res.ok || data.status === 'error') throw new Error(data.message || data.error || `Error ${res.status}`)
      setJobId(data.job_id)
      schedulePoll(data.job_id)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Unknown error')
      setPhase('error')
    }
  }

  function schedulePoll(id: string, delay = 4000) {
    pollRef.current = setTimeout(() => poll(id), delay)
  }

  async function poll(id: string) {
    // Hard 8-minute client-side timeout
    if (Date.now() - pollStartRef.current > 10 * 60 * 1000) {
      setError('Timed out waiting for the server. The job may still be running — try refreshing.')
      setPhase('error')
      return
    }

    try {
      const res = await fetch(`/api/demo-status?job_id=${id}`)
      if (!res.ok) throw new Error(`Status ${res.status}`)
      const data = await res.json()
      const s: string = data.status
      errorCountRef.current = 0
      setPhaseLabel(PHASE_LABELS[s] ?? s)

      if (s === 'done') {
        setVideoUrl(`/api/demo-video/${id}`)
        setPhase('done')
      } else if (s === 'error') {
        setError(data.error || 'Recording failed')
        setPhase('error')
      } else {
        const p: Phase = s === 'recording' ? 'recording' : s === 'encoding' ? 'encoding' : 'planning'
        setPhase(p)
        schedulePoll(id, 4000)
      }
    } catch {
      errorCountRef.current += 1
      if (errorCountRef.current > 10) {
        setError('Lost connection to server after multiple retries.')
        setPhase('error')
        return
      }
      // Exponential backoff up to 30s
      schedulePoll(id, Math.min(6000 * errorCountRef.current, 30000))
    }
  }

  const isProcessing = phase === 'planning' || phase === 'recording' || phase === 'encoding'

  return (
    <div className="min-h-screen flex flex-col">
      <Header onStart={onBack} minimal onBack={onBack} user={user} onSignIn={onSignIn} onSignOut={onSignOut} />

      <div className="flex-1 pt-24 pb-12 px-6">
        <div className="max-w-2xl mx-auto">

          <div className="mb-8">
            <span className="text-xs font-bold text-brand-400 uppercase tracking-widest">Demo Video Creator</span>
            <h1 className="text-3xl font-black text-white mt-2 mb-2">Record Any Website</h1>
            <p className="text-white/45 text-sm">
              AI plans the browser actions, records the session, adds your voiceover and captions — fully automatic.
            </p>
          </div>

          {phase === 'form' && (
            <div className="space-y-5">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-white/35 mb-2">Quick examples</p>
                <div className="flex flex-wrap gap-2">
                  {EXAMPLES.map((ex, i) => (
                    <button key={i} onClick={() => { setUrl(ex.url); setDescription(ex.description); setVoiceover(ex.voiceover) }}
                      className="text-xs px-3 py-1.5 rounded-full border border-white/10 bg-white/3 text-white/55 hover:border-brand-400/50 hover:text-white/90 hover:bg-brand-500/10 transition-all">
                      {ex.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="card">
                <label className="block text-xs font-bold uppercase tracking-widest text-white/40 mb-2">
                  Website URL
                </label>
                <input
                  type="url"
                  value={url}
                  onChange={e => setUrl(e.target.value)}
                  placeholder="https://cadio.net"
                  className="input-field"
                />
              </div>

              <div className="card">
                <label className="block text-xs font-bold uppercase tracking-widest text-white/40 mb-2">
                  What should the video show?
                </label>
                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  rows={4}
                  placeholder="Show the homepage, then click 'Get started', type a prompt like 'a simple bracket', wait for the model to generate, rotate it, and download the file."
                  className="input-field resize-none"
                />
                <p className="text-white/25 text-xs mt-2">
                  Describe the steps in plain language — AI converts this to browser actions.
                </p>
              </div>

              <div className="card">
                <label className="block text-xs font-bold uppercase tracking-widest text-white/40 mb-2">
                  Voiceover script
                </label>
                <textarea
                  value={voiceover}
                  onChange={e => setVoiceover(e.target.value)}
                  rows={4}
                  placeholder="Tired of doing this the hard way? Our tool lets you do it in seconds — just sign up, follow the steps, and you're done. Try it free today."
                  className="input-field resize-none"
                />
                <p className="text-white/25 text-xs mt-2">
                  This will be read aloud by an AI voice and synced as captions at the bottom.
                </p>
              </div>

              <div className="bg-white/3 border border-white/8 rounded-xl p-4 text-xs text-white/40 space-y-1">
                <p className="font-semibold text-white/55">What you'll get:</p>
                <p>✓ Full browser screen recording at 1280×720</p>
                <p>✓ AI voice reading your script (Microsoft Neural TTS — free)</p>
                <p>✓ Captions synced at the bottom</p>
                <p>✓ MP4 ready to post on TikTok, Reels, YouTube Shorts</p>
                <p>✓ Works on any public website</p>
              </div>

              <button
                onClick={submit}
                disabled={!url || !description || !voiceover}
                className="btn-primary w-full justify-center py-3.5 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                ▶ Start Recording
              </button>
            </div>
          )}

          {isProcessing && (
            <div className="card text-center py-16">
              <div className="relative w-20 h-20 mx-auto mb-6">
                <div className="absolute inset-0 rounded-full border-2 border-brand-500/15" />
                <div className="absolute inset-0 rounded-full border-2 border-t-brand-400 animate-spin" />
                <div className="absolute inset-2 rounded-full border border-brand-400/20 animate-pulse" />
              </div>
              <p className="text-white font-semibold text-lg mb-2">{phaseLabel || PHASE_LABELS[phase] || 'Processing…'}</p>
              <p className="text-white/35 text-sm">
                {phase === 'recording' && 'Playwright is navigating and capturing frames…'}
                {phase === 'encoding' && 'ffmpeg is combining video, voice and captions…'}
                {phase === 'planning' && 'AI is planning the browser actions…'}
              </p>
              <p className="text-white/20 text-xs mt-4">This takes 2–3 minutes. Don't close the tab.</p>
            </div>
          )}

          {phase === 'done' && videoUrl && (
            <div className="space-y-5">
              <div className="card p-0 overflow-hidden">
                <video
                  src={videoUrl}
                  controls
                  autoPlay
                  loop
                  playsInline
                  className="w-full bg-black"
                />
              </div>
              <div className="flex gap-3 justify-center flex-wrap">
                <a href={videoUrl} download="reelix-demo.mp4" className="btn-primary px-6 py-2.5 text-sm">
                  ↓ Download MP4
                </a>
                <button onClick={() => { setPhase('form'); setJobId(null); setVideoUrl(null) }} className="btn-ghost px-5 py-2.5 text-sm">
                  ↺ Record Another
                </button>
              </div>
            </div>
          )}

          {phase === 'error' && (
            <div className="card text-center py-12">
              <div className="w-12 h-12 rounded-full bg-red-500/15 border border-red-500/30 flex items-center justify-center mx-auto mb-4">
                <span className="text-red-400 text-lg font-bold">!</span>
              </div>
              <p className="text-red-400 font-semibold mb-2">{error}</p>
              <p className="text-white/35 text-sm mb-6">Check that the URL is public and reachable, and that GROQ_API_KEY is set in your deployment secrets.</p>
              <button onClick={() => setPhase('form')} className="btn-primary px-6 py-2.5 text-sm">Try Again</button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

import { useState, useEffect, useRef } from 'react'
import type { ProductInfo, AdSelection, AdDesign } from '../../types'
import AnimatedReel from '../AnimatedReel'

interface Props {
  productInfo: ProductInfo
  adSelection: AdSelection
  adDesign: AdDesign
  onBack: () => void
  onReset: () => void
}

type VideoPhase = 'idle' | 'submitting' | 'queued' | 'generating' | 'done' | 'error' | 'disabled'

interface StatusPayload {
  status: string
  queue_position?: number
  video_url?: string
  error?: string
  request_id?: string
  model?: string
  prompt?: string
}

const STATUS_MESSAGES: Record<string, string> = {
  IN_QUEUE: 'Your video is queued…',
  IN_PROGRESS: 'AI is generating your video…',
  COMPLETED: 'Done!',
}

export default function Step4VideoGenerate({ productInfo, adSelection, adDesign, onBack, onReset }: Props) {
  const [phase, setPhase] = useState<VideoPhase>('idle')
  const [queuePos, setQueuePos] = useState<number | null>(null)
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [requestId, setRequestId] = useState<string | null>(null)
  const [model, setModel] = useState<string | null>(null)
  const [prompt, setPrompt] = useState<string | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const startTimeRef = useRef<number>(0)
  const elapsedRef = useRef<ReturnType<typeof setInterval> | null>(null)

  function clearPoll() {
    if (pollRef.current) { clearTimeout(pollRef.current); pollRef.current = null }
    if (elapsedRef.current) { clearInterval(elapsedRef.current); elapsedRef.current = null }
  }

  useEffect(() => () => clearPoll(), [])

  async function startGeneration() {
    clearPoll()
    setPhase('submitting')
    setError(null)
    setVideoUrl(null)
    setQueuePos(null)
    setElapsed(0)

    try {
      const res = await fetch('/api/generate-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_name: productInfo.name,
          description: productInfo.description,
          target_audience: productInfo.audience,
          tone: productInfo.tone,
          platform: productInfo.platform,
          hook: adSelection.hook,
          headline: adSelection.headline,
          aspect_ratio: adDesign.format === 'landscape' ? '16:9' : adDesign.format === 'square' ? '1:1' : '9:16',
          duration: 5,
        }),
      })
      const data: StatusPayload = await res.json()

      if (data.status === 'disabled') {
        setPhase('disabled')
        return
      }
      if (!res.ok || !data.request_id) {
        throw new Error((data as any).message || data.error || `Error ${res.status}`)
      }

      setRequestId(data.request_id)
      setModel(data.model ?? null)
      setPrompt(data.prompt ?? null)
      setPhase('queued')
      startTimeRef.current = Date.now()
      elapsedRef.current = setInterval(() => setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000)), 1000)
      schedulePoll(data.request_id, data.model ?? '')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Unknown error')
      setPhase('error')
    }
  }

  function schedulePoll(rid: string, mdl: string, delay = 4000) {
    pollRef.current = setTimeout(() => pollStatus(rid, mdl), delay)
  }

  async function pollStatus(rid: string, mdl: string) {
    try {
      const res = await fetch(`/api/video-status?request_id=${encodeURIComponent(rid)}&model=${encodeURIComponent(mdl)}`)
      const data: StatusPayload = await res.json()

      if (data.status === 'IN_QUEUE') {
        setPhase('queued')
        setQueuePos(data.queue_position ?? null)
        schedulePoll(rid, mdl, 5000)
      } else if (data.status === 'IN_PROGRESS') {
        setPhase('generating')
        setQueuePos(null)
        schedulePoll(rid, mdl, 5000)
      } else if (data.status === 'COMPLETED') {
        clearPoll()
        setVideoUrl(data.video_url ?? null)
        setPhase('done')
      } else if (data.status === 'FAILED') {
        clearPoll()
        setError(data.error ?? 'Video generation failed')
        setPhase('error')
      } else {
        schedulePoll(rid, mdl, 5000)
      }
    } catch {
      schedulePoll(rid, mdl, 8000)
    }
  }

  const fmtElapsed = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8">
        <h2 className="text-2xl font-black text-white mb-2">Generate Your Video</h2>
        <p className="text-white/45 text-sm">AI turns your ad script into a real video — or preview the animated mockup for free.</p>
      </div>

      {/* Idle */}
      {phase === 'idle' && (
        <div className="card text-center py-12">
          <div className="w-16 h-16 rounded-2xl gradient-bg flex items-center justify-center mx-auto mb-5 shadow-2xl">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
              <path d="M8 5v14l11-7z" fill="white" />
            </svg>
          </div>
          <h3 className="text-lg font-bold text-white mb-2">Ready to generate</h3>
          <p className="text-white/40 text-sm mb-6 max-w-xs mx-auto">
            This uses fal.ai text-to-video (Kling). Requires a FAL_KEY in your backend .env. Takes ~60–90 seconds.
          </p>
          {prompt === null && (
            <div className="bg-white/3 border border-white/8 rounded-xl p-4 text-left mb-6 max-w-sm mx-auto">
              <p className="text-xs font-bold text-white/40 uppercase tracking-widest mb-2">Your selected copy</p>
              <p className="text-sm text-white/70 italic mb-1">"{adSelection.hook}"</p>
              <p className="text-sm font-semibold text-white">{adSelection.headline}</p>
              <p className="text-xs text-white/40 mt-1">{adSelection.cta}</p>
            </div>
          )}
          <button onClick={startGeneration} className="btn-primary px-8 py-3 text-sm mx-auto">
            ▶ Generate AI Video
          </button>
        </div>
      )}

      {/* Submitting */}
      {phase === 'submitting' && (
        <div className="card text-center py-12">
          <div className="relative w-14 h-14 mx-auto mb-5">
            <div className="absolute inset-0 rounded-full border-2 border-brand-500/20" />
            <div className="absolute inset-0 rounded-full border-2 border-t-brand-400 animate-spin" />
          </div>
          <p className="text-white font-semibold">Submitting to AI…</p>
          <p className="text-white/35 text-sm mt-1">Connecting to fal.ai</p>
        </div>
      )}

      {/* Queued / Generating */}
      {(phase === 'queued' || phase === 'generating') && (
        <div className="card text-center py-12">
          <div className="relative w-20 h-20 mx-auto mb-6">
            <svg viewBox="0 0 80 80" className="w-full h-full -rotate-90">
              <circle cx="40" cy="40" r="34" fill="none" stroke="rgba(139,48,255,0.15)" strokeWidth="4" />
              <circle cx="40" cy="40" r="34" fill="none" stroke="#8b30ff" strokeWidth="4"
                strokeDasharray="213" strokeDashoffset={phase === 'queued' ? 170 : 80}
                className="transition-all duration-1000" strokeLinecap="round" />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-brand-400 font-mono text-sm font-bold">{fmtElapsed(elapsed)}</span>
            </div>
          </div>
          <p className="text-white font-semibold text-lg mb-1">
            {STATUS_MESSAGES[phase === 'queued' ? 'IN_QUEUE' : 'IN_PROGRESS']}
          </p>
          {queuePos !== null && (
            <p className="text-white/40 text-sm">Position in queue: #{queuePos}</p>
          )}
          {phase === 'generating' && (
            <p className="text-white/40 text-sm">This usually takes 60–90 seconds</p>
          )}
          {prompt && (
            <div className="mt-6 bg-white/3 border border-white/8 rounded-xl p-4 text-left max-w-sm mx-auto">
              <p className="text-xs font-bold text-white/30 uppercase tracking-widest mb-1">Video prompt</p>
              <p className="text-xs text-white/45 leading-relaxed line-clamp-4">{prompt}</p>
            </div>
          )}
        </div>
      )}

      {/* Done */}
      {phase === 'done' && videoUrl && (
        <div className="space-y-6">
          <div className="card p-0 overflow-hidden">
            <video
              src={videoUrl}
              controls
              autoPlay
              loop
              playsInline
              className="w-full max-h-[560px] object-contain bg-black"
            />
          </div>
          <div className="flex flex-wrap gap-3 justify-center">
            <a
              href={videoUrl}
              download="reelix-ad.mp4"
              className="btn-primary px-6 py-2.5 text-sm"
            >
              ↓ Download Video
            </a>
            <button onClick={startGeneration} className="btn-ghost px-5 py-2.5 text-sm">
              ↺ Generate Again
            </button>
            <button onClick={onReset} className="btn-ghost px-5 py-2.5 text-sm">
              + New Ad
            </button>
          </div>
          {model && (
            <p className="text-center text-white/20 text-xs">Generated with {model} via fal.ai · {fmtElapsed(elapsed)}</p>
          )}
        </div>
      )}

      {/* Error */}
      {phase === 'error' && (
        <div className="card text-center py-12">
          <div className="w-12 h-12 rounded-full bg-red-500/15 border border-red-500/30 flex items-center justify-center mx-auto mb-4">
            <span className="text-red-400 text-lg font-bold">!</span>
          </div>
          <p className="text-red-400 font-semibold mb-2">{error}</p>
          <p className="text-white/35 text-sm mb-6">Check your FAL_KEY and backend logs for details.</p>
          <div className="flex gap-3 justify-center">
            <button onClick={onBack} className="btn-ghost px-5 py-2.5 text-sm">← Back</button>
            <button onClick={startGeneration} className="btn-primary px-5 py-2.5 text-sm">Retry</button>
          </div>
        </div>
      )}

      {/* Disabled — no FAL_KEY */}
      {phase === 'disabled' && (
        <div className="space-y-6">
          <div className="card border-brand-500/20 bg-brand-500/5 text-center py-8">
            <div className="w-10 h-10 rounded-full bg-yellow-500/15 border border-yellow-500/25 flex items-center justify-center mx-auto mb-3">
              <span className="text-yellow-400 text-base">⚡</span>
            </div>
            <p className="text-white font-semibold mb-1">AI video not configured</p>
            <p className="text-white/40 text-sm mb-2">Add your <code className="text-brand-300 bg-brand-500/10 px-1 py-0.5 rounded text-xs">FAL_KEY</code> to the backend <code className="text-brand-300 bg-brand-500/10 px-1 py-0.5 rounded text-xs">.env</code> file to enable real AI video.</p>
            <p className="text-white/25 text-xs">Preview the animated mockup below while you set it up.</p>
          </div>

          <div className="flex justify-center">
            <AnimatedReel selection={adSelection} design={adDesign} />
          </div>

          <div className="flex gap-3 justify-center">
            <button onClick={onBack} className="btn-ghost px-5 py-2.5 text-sm">← Back</button>
            <button onClick={onReset} className="btn-primary px-5 py-2.5 text-sm">+ New Ad</button>
          </div>
        </div>
      )}

      {/* Back button when idle */}
      {phase === 'idle' && (
        <div className="mt-6">
          <button onClick={onBack} className="btn-ghost px-6 py-2.5 text-sm">← Back</button>
        </div>
      )}
    </div>
  )
}

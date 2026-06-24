import { useState, useRef, useCallback } from 'react'
import type { AdSelection, AdDesign } from '../types'

type ReelPhase = 'idle' | 'playing' | 'done'

interface Props {
  selection: AdSelection
  design: AdDesign
}

/**
 * A CSS-animated "reel" preview shown inside a phone mockup.
 * Used as the free fallback when AI video generation is not configured.
 */
export default function AnimatedReel({ selection, design }: Props) {
  const [phase, setPhase] = useState<ReelPhase>('idle')
  const [tick, setTick] = useState(0)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const start = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    setPhase('idle')
    setTimeout(() => {
      setPhase('playing')
      setTick(t => t + 1)
      timerRef.current = setTimeout(() => setPhase('done'), 4500)
    }, 50)
  }, [])

  const isPlaying = phase === 'playing' || phase === 'done'

  const bgStyle: React.CSSProperties = design.template === 'vibrant'
    ? { background: `linear-gradient(160deg, ${design.primaryColor}, ${design.accentColor}, #ff6b35)` }
    : design.template === 'clean'
    ? { background: '#f8f5ff' }
    : { background: `linear-gradient(160deg, #160026 0%, #0a000f 100%)` }

  const isDark = design.template !== 'clean'
  const textColor = isDark ? '#fff' : '#0f0a1a'
  const subColor = isDark ? 'rgba(255,255,255,0.65)' : 'rgba(15,10,26,0.55)'

  return (
    <div className="flex flex-col items-center gap-5">
      <div className="relative" style={{ width: 260, height: 460 }}>
        <div className="absolute inset-0 rounded-[2.5rem] border-2 border-white/20 overflow-hidden"
          style={{ ...bgStyle, boxShadow: `0 40px 100px ${design.primaryColor}50, inset 0 1px 0 rgba(255,255,255,0.1)` }}>

          {isDark && (
            <>
              <div className="absolute top-8 right-4 w-28 h-28 rounded-full blur-2xl opacity-25 pointer-events-none"
                style={{ background: `radial-gradient(circle, ${design.primaryColor}, transparent)` }} />
              <div className="absolute bottom-24 left-2 w-20 h-20 rounded-full blur-2xl opacity-20 pointer-events-none"
                style={{ background: `radial-gradient(circle, ${design.accentColor}, transparent)` }} />
            </>
          )}

          <div className="flex justify-between items-center px-5 pt-3 pb-1 text-[9px]"
            style={{ color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.3)' }}>
            <span>9:41</span>
            <div className="flex gap-1"><span>●●●</span><span>WiFi</span><span>■</span></div>
          </div>

          <div key={tick} className="absolute inset-x-0 top-10 bottom-0 px-6 flex flex-col justify-center">
            <div className={isPlaying ? 'animate-reel-hook' : 'opacity-0'}>
              <p className="text-[9px] font-bold uppercase tracking-widest mb-1" style={{ color: design.primaryColor }}>Hook</p>
              <p className="text-xs font-semibold italic leading-snug mb-4" style={{ color: textColor }}>"{selection.hook}"</p>
            </div>

            <div className={isPlaying ? 'animate-reel-headline' : 'opacity-0'}>
              <div className="h-px w-16 mb-3" style={{ background: `linear-gradient(90deg, ${design.primaryColor}, ${design.accentColor})` }} />
              <p className="text-base font-black leading-tight mb-2" style={{ color: textColor }}>{selection.headline}</p>
            </div>

            <div className={isPlaying ? 'animate-reel-sub' : 'opacity-0'}>
              <p className="text-[11px] leading-relaxed mb-4" style={{ color: subColor }}>{selection.subheadline}</p>
            </div>

            <div className={isPlaying ? 'animate-reel-cta' : 'opacity-0'}>
              <div className="inline-flex items-center px-4 py-2 rounded-full text-[11px] font-bold text-white"
                style={{ background: `linear-gradient(135deg, ${design.primaryColor}, ${design.accentColor})`, boxShadow: `0 8px 24px ${design.primaryColor}60` }}>
                {selection.cta} →
              </div>
            </div>

            <div className={`mt-4 ${isPlaying ? 'animate-reel-tags' : 'opacity-0'}`}>
              <p className="text-[9px] leading-relaxed" style={{ color: design.primaryColor + 'bb' }}>
                {selection.hashtags.slice(0, 4).map(t => `#${t}`).join('  ')}
              </p>
            </div>
          </div>

          <div className="absolute bottom-6 left-0 right-0 flex justify-center gap-1">
            {[0,1,2,3,4].map(i => (
              <div key={i} className={`h-1 rounded-full transition-all duration-300 ${
                phase === 'playing' ? (i === 2 ? 'w-5 opacity-100' : 'w-1.5 opacity-40') :
                phase === 'done' ? 'w-1.5 opacity-60' : 'w-1.5 opacity-20'
              }`} style={{ background: design.primaryColor }} />
            ))}
          </div>

          {phase === 'idle' && (
            <div className="absolute inset-0 flex items-center justify-center"
              style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(2px)' }}>
              <div className="flex flex-col items-center gap-3">
                <div className="w-14 h-14 rounded-full bg-white/15 flex items-center justify-center border border-white/20">
                  <div className="w-0 h-0 border-t-[8px] border-b-[8px] border-l-[14px] border-t-transparent border-b-transparent border-l-white ml-1" />
                </div>
                <p className="text-white/70 text-[10px]">Tap to preview</p>
              </div>
            </div>
          )}
        </div>
      </div>

      <button onClick={start} className="btn-primary px-6 py-2.5 text-sm">
        {phase === 'idle' ? '▶ Play Preview' : '↺ Replay'}
      </button>
    </div>
  )
}

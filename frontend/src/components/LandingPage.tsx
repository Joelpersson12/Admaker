import { useState, useEffect } from 'react'
import Header from './Header'
import Footer from './Footer'

interface LandingPageProps {
  onStart: () => void
}

const DEMO_SCENES = [
  { hook: 'Stop scrolling.', headline: 'Your product deserves better ads.' },
  { hook: 'Watch this.', headline: 'AI makes your video in seconds.' },
  { hook: 'No camera. No crew.', headline: 'Just type. We generate.' },
  { hook: 'Ready to post.', headline: 'For TikTok, Reels & Shorts.' },
]

const FEATURES = [
  {
    icon: '▶',
    title: 'AI Video Generation',
    desc: 'Describe your product and let AI generate a real, scroll-stopping ad video — text-to-video powered, no camera or editing skills needed.',
    color: 'from-brand-500/20 to-violet-500/10',
    border: 'border-brand-500/25',
  },
  {
    icon: '✦',
    title: 'AI Copy & Script',
    desc: 'AI writes your hook, headline, body copy, CTA and hashtags — tailored to your product, audience, and platform.',
    color: 'from-violet-500/20 to-purple-500/10',
    border: 'border-violet-500/20',
  },
  {
    icon: '◈',
    title: 'Visual Ad Composer',
    desc: 'Compose a matching image ad on the built-in canvas: templates, brand colors, your product image — perfect for the video poster.',
    color: 'from-pink-500/20 to-rose-500/10',
    border: 'border-pink-500/20',
  },
  {
    icon: '⬡',
    title: 'Made for Every Platform',
    desc: 'Vertical 9:16 for Reels, TikTok & Shorts, 1:1 for feed posts, 16:9 for YouTube — the right format every time.',
    color: 'from-cyan-500/20 to-blue-500/10',
    border: 'border-cyan-500/20',
  },
  {
    icon: '◎',
    title: 'Tone & Voice Control',
    desc: 'Professional, casual, urgent or inspirational — the AI matches your brand voice across copy and video style.',
    color: 'from-green-500/20 to-emerald-500/10',
    border: 'border-green-500/20',
  },
  {
    icon: '❋',
    title: 'Instant Download',
    desc: 'Export your finished video and image ad in one click. Post it everywhere — no watermark on paid plans.',
    color: 'from-orange-500/20 to-amber-500/10',
    border: 'border-orange-500/20',
  },
]

const STEPS = [
  {
    n: '01',
    title: 'Describe your product',
    desc: 'Enter your product, audience, tone and platform. Less than 60 seconds.',
  },
  {
    n: '02',
    title: 'AI writes your script',
    desc: 'Get hooks, headlines, CTAs and a video concept — pick what resonates.',
  },
  {
    n: '03',
    title: 'Compose your visual',
    desc: 'Choose a template and brand colors, drop in your product image.',
  },
  {
    n: '04',
    title: 'Generate your ad video',
    desc: 'AI turns it into a real video ad. Preview, download, and post.',
  },
]

const PRICING = [
  {
    name: 'Free',
    price: '$0',
    period: 'forever',
    features: ['3 ad videos per month', 'AI copy generation', 'Image ad composer', 'Animated preview', '720p export'],
    cta: 'Start Free',
    highlighted: false,
  },
  {
    name: 'Creator',
    price: '$19',
    period: '/month',
    features: ['30 AI videos per month', 'All templates', '1080p HD export', 'No watermark', 'All platforms', 'Priority rendering'],
    cta: 'Get Creator',
    highlighted: true,
  },
  {
    name: 'Business',
    price: '$49',
    period: '/month',
    features: ['Unlimited videos', 'Team workspace', '4K export', 'Brand kits', 'API access', 'Priority support'],
    cta: 'Get Business',
    highlighted: false,
  },
]

function AnimatedHeroPhone() {
  const [idx, setIdx] = useState(0)

  useEffect(() => {
    const t = setInterval(() => setIdx(i => (i + 1) % DEMO_SCENES.length), 2400)
    return () => clearInterval(t)
  }, [])

  const scene = DEMO_SCENES[idx]

  return (
    <div className="relative flex items-center justify-center mt-8 md:mt-0 animate-float">
      <div className="absolute w-80 h-80 rounded-full blur-3xl opacity-20 pointer-events-none"
        style={{ background: 'radial-gradient(circle, #8b30ff 0%, #ec4899 100%)' }} />

      {/* Phone frame */}
      <div className="relative w-52 h-96 rounded-[2.5rem] border-2 border-white/15 overflow-hidden"
        style={{ background: 'linear-gradient(160deg, #160026 0%, #0a000f 100%)', boxShadow: '0 32px 80px rgba(139,48,255,0.3), inset 0 1px 0 rgba(255,255,255,0.1)' }}>

        <div className="flex justify-between items-center px-5 pt-3 pb-1 text-[9px] text-white/40">
          <span>9:41</span>
          <div className="flex gap-1 items-center"><span>●●●</span><span>WiFi</span><span>■</span></div>
        </div>

        {/* "Video" preview */}
        <div className="absolute inset-x-0 bottom-0 top-8 overflow-hidden">
          <div key={idx} className="absolute inset-0 animate-reel-bg"
            style={{ background: 'linear-gradient(160deg, #2d006b 0%, #0e0019 60%, #1a0033 100%)' }} />

          {/* moving "film" shimmer to suggest video */}
          <div className="absolute inset-0 opacity-30 animate-shimmer pointer-events-none"
            style={{ background: 'linear-gradient(115deg, transparent 30%, rgba(196,154,255,0.25) 50%, transparent 70%)', backgroundSize: '200% 100%' }} />

          <div className="absolute top-6 right-4 w-20 h-20 rounded-full opacity-20"
            style={{ background: 'radial-gradient(circle, #c39aff, transparent)' }} />

          <div key={`t-${idx}`} className="absolute inset-0 flex flex-col justify-center px-5">
            <p className="text-[8px] text-brand-300 font-semibold uppercase tracking-widest mb-2 animate-reel-hook">▶ playing</p>
            <div className="text-white/60 text-[9px] font-semibold mb-2 animate-reel-hook">{scene.hook}</div>
            <div className="text-white text-sm font-black leading-tight mb-3 animate-reel-headline">
              {scene.headline}
            </div>
            <div className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-[8px] font-bold text-white animate-reel-cta"
              style={{ background: 'linear-gradient(135deg, #8b30ff, #ec4899)', width: 'fit-content' }}>
              Try Free →
            </div>
          </div>

          {/* progress bars */}
          <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-1">
            {DEMO_SCENES.map((_, i) => (
              <div key={i} className="h-1 rounded-full transition-all duration-300"
                style={{ width: i === idx ? '20px' : '6px', background: i === idx ? '#8b30ff' : 'rgba(255,255,255,0.2)' }} />
            ))}
          </div>
        </div>
      </div>

      <div className="absolute -top-4 -right-4 glass rounded-xl px-3 py-2 text-[10px] font-semibold border-brand-500/30 border">
        <span className="text-green-400">●</span> AI Generated
      </div>
      <div className="absolute -bottom-2 -left-6 glass rounded-xl px-3 py-2 text-[10px] border-pink-500/30 border">
        <span className="gradient-text font-bold">9:16</span> ready to post
      </div>
    </div>
  )
}

export default function LandingPage({ onStart }: LandingPageProps) {
  return (
    <div className="min-h-screen">
      <Header onStart={onStart} />

      {/* ── HERO ─────────────────────────────────── */}
      <section className="relative pt-32 pb-20 px-6 overflow-hidden">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full blur-3xl opacity-10"
            style={{ background: 'radial-gradient(circle, #8b30ff, transparent)' }} />
          <div className="absolute top-1/3 right-1/4 w-80 h-80 rounded-full blur-3xl opacity-8"
            style={{ background: 'radial-gradient(circle, #ec4899, transparent)' }} />
          <div className="absolute inset-0" style={{
            backgroundImage: 'linear-gradient(rgba(139,48,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(139,48,255,0.04) 1px, transparent 1px)',
            backgroundSize: '60px 60px',
          }} />
        </div>

        <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-12 items-center relative">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-brand-500/30 bg-brand-500/10 text-xs text-brand-300 font-medium mb-6">
              <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              AI text-to-video · Free to try
            </div>

            <h1 className="text-5xl md:text-6xl font-black leading-[1.05] tracking-tight mb-6">
              Turn Any Product Into a{' '}
              <span className="gradient-text">Scroll-Stopping</span> Ad Video
            </h1>

            <p className="text-white/50 text-lg leading-relaxed mb-8 max-w-md">
              Reelix uses AI to write your script, compose your visuals, and generate a real ad video — for any product, in seconds. No camera, no crew, no editing.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 mb-10">
              <button onClick={onStart} className="btn-primary text-sm px-7 py-3.5">
                Create Your First Video Free →
              </button>
              <a href="#how-it-works" className="btn-ghost text-sm px-7 py-3.5">
                See How It Works
              </a>
            </div>

            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-white/35">
              <span>✓ No credit card</span>
              <span>✓ 3 free videos / month</span>
              <span>✓ Ready for Reels & TikTok</span>
            </div>
          </div>

          <AnimatedHeroPhone />
        </div>
      </section>

      {/* ── SOCIAL PROOF ────────────────────────── */}
      <section className="py-8 border-y border-white/5">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <p className="text-white/25 text-xs uppercase tracking-widest mb-6">Built for creators & brands on</p>
          <div className="flex flex-wrap justify-center gap-8 items-center">
            {['TikTok', 'Instagram Reels', 'YouTube Shorts', 'Facebook', 'LinkedIn'].map(b => (
              <span key={b} className="text-white/20 text-sm font-medium">{b}</span>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ────────────────────────── */}
      <section id="how-it-works" className="py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-brand-400 text-xs font-semibold uppercase tracking-widest mb-3">How It Works</p>
            <h2 className="text-4xl font-black">
              From product to ad video in{' '}
              <span className="gradient-text">4 steps</span>
            </h2>
          </div>

          <div className="relative">
            <div className="hidden md:block absolute top-8 left-[calc(12.5%+1rem)] right-[calc(12.5%+1rem)] h-px"
              style={{ background: 'linear-gradient(90deg, transparent, rgba(139,48,255,0.4), rgba(236,72,153,0.4), transparent)' }} />

            <div className="grid md:grid-cols-4 gap-6">
              {STEPS.map((s, i) => (
                <div key={i} className="relative">
                  <div className="flex flex-col items-center text-center">
                    <div className="w-16 h-16 rounded-2xl glass border border-brand-500/25 flex items-center justify-center mb-4"
                      style={{ background: 'linear-gradient(135deg, rgba(139,48,255,0.12), rgba(236,72,153,0.05))' }}>
                      <span className="text-2xl font-black gradient-text">{s.n}</span>
                    </div>
                    <h3 className="text-sm font-bold text-white mb-2">{s.title}</h3>
                    <p className="text-white/40 text-xs leading-relaxed">{s.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-12 text-center">
            <button onClick={onStart} className="btn-primary">Get Started Now →</button>
          </div>
        </div>
      </section>

      {/* ── FEATURES ────────────────────────────── */}
      <section id="features" className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-brand-400 text-xs font-semibold uppercase tracking-widest mb-3">Features</p>
            <h2 className="text-4xl font-black">
              Everything you need to{' '}
              <span className="gradient-text">go viral</span>
            </h2>
            <p className="text-white/40 mt-4 max-w-xl mx-auto">
              AI copy, visual composition, and real video generation — all in one tool. No design or editing skills required.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            {FEATURES.map((f, i) => (
              <div key={i} className={`glass-hover card bg-gradient-to-br ${f.color} border ${f.border}`}>
                <div className="text-2xl mb-3 gradient-text font-bold">{f.icon}</div>
                <h3 className="font-bold text-sm text-white mb-2">{f.title}</h3>
                <p className="text-white/45 text-xs leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRICING ─────────────────────────────── */}
      <section id="pricing" className="py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-brand-400 text-xs font-semibold uppercase tracking-widest mb-3">Pricing</p>
            <h2 className="text-4xl font-black">
              Simple,{' '}
              <span className="gradient-text">transparent</span> pricing
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {PRICING.map((p, i) => (
              <div key={i} className={`card relative overflow-hidden transition-transform duration-200 hover:-translate-y-1 ${p.highlighted ? 'border-brand-500/40' : 'border-white/8'}`}
                style={p.highlighted ? { background: 'linear-gradient(135deg, rgba(139,48,255,0.12), rgba(14,0,25,0.9))' } : {}}>

                {p.highlighted && <div className="absolute top-0 left-0 right-0 h-px gradient-bg opacity-60" />}
                {p.highlighted && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="px-3 py-1 rounded-full text-[10px] font-bold text-white gradient-bg">Most Popular</span>
                  </div>
                )}

                <div className="mb-4">
                  <p className="text-white/60 text-xs font-semibold uppercase tracking-wider mb-2">{p.name}</p>
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-black text-white">{p.price}</span>
                    <span className="text-white/40 text-sm">{p.period}</span>
                  </div>
                </div>

                <ul className="space-y-2 mb-6">
                  {p.features.map(f => (
                    <li key={f} className="flex items-center gap-2 text-xs text-white/60">
                      <span className="text-brand-400">✓</span> {f}
                    </li>
                  ))}
                </ul>

                <button onClick={onStart} className={p.highlighted ? 'btn-primary w-full justify-center' : 'btn-ghost w-full justify-center'}>
                  {p.cta}
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ───────────────────────────── */}
      <section className="py-24 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <div className="card border-brand-500/20 border relative overflow-hidden"
            style={{ background: 'linear-gradient(135deg, rgba(139,48,255,0.1), rgba(236,72,153,0.06))' }}>
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute top-0 left-1/2 w-64 h-32 -translate-x-1/2 blur-3xl opacity-20"
                style={{ background: 'radial-gradient(ellipse, #8b30ff, transparent)' }} />
            </div>
            <div className="relative">
              <h2 className="text-4xl font-black mb-4">
                Make your first ad video{' '}
                <span className="gradient-text">today</span>
              </h2>
              <p className="text-white/45 text-sm mb-8 max-w-md mx-auto">
                Join creators and brands using Reelix to launch video campaigns faster than ever.
              </p>
              <button onClick={onStart} className="btn-primary text-base px-10 py-4">
                Create Your First Video — It's Free →
              </button>
              <p className="text-white/25 text-xs mt-4">No credit card · 3 free videos per month · Instant access</p>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  )
}

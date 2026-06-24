import { useState, useEffect } from 'react'
import type { ProductInfo, GeneratedCopy, AdSelection } from '../../types'

interface Props {
  productInfo: ProductInfo
  onBack: () => void
  onNext: (copy: GeneratedCopy, selection: AdSelection) => void
}

function CopyCard({ label, options, selected, onSelect }: {
  label: string
  options: string[]
  selected: number
  onSelect: (i: number) => void
}) {
  return (
    <div className="mb-6">
      <p className="text-xs font-bold uppercase tracking-widest text-white/40 mb-3">{label}</p>
      <div className="space-y-2">
        {options.map((text, i) => (
          <button
            key={i}
            onClick={() => onSelect(i)}
            className={`w-full text-left px-4 py-3 rounded-xl border text-sm transition-all duration-200 ${
              selected === i
                ? 'border-brand-400 bg-brand-500/10 text-white'
                : 'border-white/10 bg-white/3 text-white/65 hover:border-white/25 hover:bg-white/6 hover:text-white/90'
            }`}
          >
            <div className="flex items-start gap-3">
              <div className={`mt-0.5 w-4 h-4 rounded-full border flex-shrink-0 flex items-center justify-center transition-all ${
                selected === i ? 'border-brand-400 bg-brand-400' : 'border-white/25'
              }`}>
                {selected === i && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
              </div>
              <span className="leading-relaxed">{text}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

export default function Step2GenerateCopy({ productInfo, onBack, onNext }: Props) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [copy, setCopy] = useState<GeneratedCopy | null>(null)

  const [selHeadline, setSelHeadline] = useState(0)
  const [selSub, setSelSub] = useState(0)
  const [selCta, setSelCta] = useState(0)
  const [editedHook, setEditedHook] = useState('')
  const [editedBody, setEditedBody] = useState('')
  const [editedHashtags, setEditedHashtags] = useState('')

  async function generate() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/generate-copy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(productInfo),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.detail || `Server error ${res.status}`)
      }
      const data: GeneratedCopy = await res.json()
      setCopy(data)
      setSelHeadline(0)
      setSelSub(0)
      setSelCta(0)
      setEditedHook(data.hook)
      setEditedBody(data.body_copy)
      setEditedHashtags(data.hashtags.join(', '))
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { generate() }, [])

  function handleNext() {
    if (!copy) return
    const tags = editedHashtags.split(',').map(t => t.trim().replace(/^#/, '')).filter(Boolean)
    onNext(copy, {
      headline: copy.headlines[selHeadline],
      subheadline: copy.subheadlines[selSub],
      cta: copy.ctas[selCta],
      body_copy: editedBody,
      hashtags: tags,
      hook: editedHook,
    })
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-6">
        <div className="relative w-16 h-16">
          <div className="absolute inset-0 rounded-full border-2 border-brand-500/20" />
          <div className="absolute inset-0 rounded-full border-2 border-t-brand-400 animate-spin" />
          <div className="absolute inset-2 rounded-full border border-brand-400/20 animate-pulse" />
        </div>
        <div className="text-center">
          <p className="text-white font-semibold mb-1">Generating your AI script…</p>
          <p className="text-white/40 text-sm">GPT-4o is crafting copy tailored to your product</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <div className="w-12 h-12 rounded-full bg-red-500/15 border border-red-500/30 flex items-center justify-center">
          <span className="text-red-400 text-lg">!</span>
        </div>
        <p className="text-red-400 font-medium">{error}</p>
        <p className="text-white/35 text-sm">Make sure your OPENAI_API_KEY is set in the backend .env</p>
        <div className="flex gap-3 mt-2">
          <button onClick={onBack} className="btn-ghost px-5 py-2 text-sm">← Back</button>
          <button onClick={generate} className="btn-primary px-5 py-2 text-sm">Retry</button>
        </div>
      </div>
    )
  }

  if (!copy) return null

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8">
        <h2 className="text-2xl font-black text-white mb-2">Your AI Script</h2>
        <p className="text-white/45 text-sm">Pick the best option for each element, then fine-tune the details.</p>
      </div>

      <div className="card mb-6">
        <CopyCard label="Hook (opening line)" options={[editedHook]} selected={0} onSelect={() => {}} />
        <label className="block">
          <span className="text-xs text-white/35 mb-1 block">Edit hook</span>
          <textarea
            value={editedHook}
            onChange={e => setEditedHook(e.target.value)}
            className="input-field w-full text-sm resize-none"
            rows={2}
          />
        </label>
      </div>

      <div className="card mb-6">
        <CopyCard label="Headline" options={copy.headlines} selected={selHeadline} onSelect={setSelHeadline} />
      </div>

      <div className="card mb-6">
        <CopyCard label="Subheadline" options={copy.subheadlines} selected={selSub} onSelect={setSelSub} />
      </div>

      <div className="card mb-6">
        <CopyCard label="Call to Action" options={copy.ctas} selected={selCta} onSelect={setSelCta} />
      </div>

      <div className="card mb-6">
        <p className="text-xs font-bold uppercase tracking-widest text-white/40 mb-3">Body Copy</p>
        <textarea
          value={editedBody}
          onChange={e => setEditedBody(e.target.value)}
          className="input-field w-full text-sm resize-none"
          rows={4}
        />
      </div>

      <div className="card mb-8">
        <p className="text-xs font-bold uppercase tracking-widest text-white/40 mb-3">Hashtags</p>
        <input
          type="text"
          value={editedHashtags}
          onChange={e => setEditedHashtags(e.target.value)}
          className="input-field w-full text-sm"
          placeholder="tag1, tag2, tag3"
        />
        <p className="text-white/25 text-xs mt-2">Comma-separated, without #</p>
      </div>

      <div className="flex justify-between">
        <button onClick={onBack} className="btn-ghost px-6 py-2.5 text-sm">← Back</button>
        <div className="flex gap-3">
          <button onClick={generate} className="btn-ghost px-5 py-2.5 text-sm opacity-60 hover:opacity-100">↺ Regenerate</button>
          <button onClick={handleNext} className="btn-primary px-6 py-2.5 text-sm">Compose Visual →</button>
        </div>
      </div>
    </div>
  )
}

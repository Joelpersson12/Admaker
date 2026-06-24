import { useState } from 'react'
import type { ProductInfo } from '../../types'

interface Props {
  onNext: (info: ProductInfo) => void
}

const TONES = [
  { value: 'professional', label: '💼 Professional', desc: 'Formal, trustworthy, authoritative' },
  { value: 'casual', label: '😊 Casual', desc: 'Friendly, conversational, warm' },
  { value: 'urgent', label: '⚡ Urgent', desc: 'Time-sensitive, action-driving' },
  { value: 'inspirational', label: '✨ Inspirational', desc: 'Motivating, aspirational, bold' },
]

const PLATFORMS = [
  { value: 'instagram', label: 'Instagram' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'all', label: 'All Platforms' },
]

const GOALS = [
  { value: 'awareness', label: 'Brand Awareness' },
  { value: 'leads', label: 'Lead Generation' },
  { value: 'sales', label: 'Drive Sales' },
  { value: 'downloads', label: 'App Downloads' },
]

export default function Step1ProductInfo({ onNext }: Props) {
  const [form, setForm] = useState<Partial<ProductInfo>>({
    tone: 'professional',
    platform: 'instagram',
    goal: 'sales',
  })

  const [errors, setErrors] = useState<Record<string, string>>({})

  function set(key: keyof ProductInfo, value: string) {
    setForm(f => ({ ...f, [key]: value }))
    setErrors(e => { const n = { ...e }; delete n[key]; return n })
  }

  function validate(): boolean {
    const e: Record<string, string> = {}
    if (!form.name?.trim()) e.name = 'Product name is required'
    if (!form.description?.trim()) e.description = 'Description is required'
    if (!form.audience?.trim()) e.audience = 'Target audience is required'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function handleNext() {
    if (validate()) onNext(form as ProductInfo)
  }

  return (
    <div className="animate-slide-up">
      <div className="mb-8">
        <h1 className="text-3xl font-black text-white mb-2">Tell us about your product</h1>
        <p className="text-white/45 text-sm">The more detail you give, the better your AI-generated ads will be.</p>
      </div>

      <div className="space-y-5">
        {/* Product name */}
        <div>
          <label className="block text-xs font-semibold text-white/60 uppercase tracking-wider mb-2">
            Product / Brand Name *
          </label>
          <input
            type="text"
            placeholder="e.g. Cadio AI, Nike Air Max, My Shopify Store"
            value={form.name ?? ''}
            onChange={e => set('name', e.target.value)}
            className={`input-field ${errors.name ? 'border-red-500/60' : ''}`}
          />
          {errors.name && <p className="text-red-400 text-xs mt-1">{errors.name}</p>}
        </div>

        {/* Description */}
        <div>
          <label className="block text-xs font-semibold text-white/60 uppercase tracking-wider mb-2">
            Product Description *
          </label>
          <textarea
            placeholder="Describe what your product does, its key benefits, and what makes it unique..."
            value={form.description ?? ''}
            onChange={e => set('description', e.target.value)}
            rows={4}
            className="input-field resize-none"
          />
          {errors.description && <p className="text-red-400 text-xs mt-1">{errors.description}</p>}
        </div>

        {/* Target audience */}
        <div>
          <label className="block text-xs font-semibold text-white/60 uppercase tracking-wider mb-2">
            Target Audience *
          </label>
          <input
            type="text"
            placeholder="e.g. 3D printing enthusiasts aged 18-35, small business owners, fitness beginners"
            value={form.audience ?? ''}
            onChange={e => set('audience', e.target.value)}
            className={`input-field ${errors.audience ? 'border-red-500/60' : ''}`}
          />
          {errors.audience && <p className="text-red-400 text-xs mt-1">{errors.audience}</p>}
        </div>

        {/* Tone */}
        <div>
          <label className="block text-xs font-semibold text-white/60 uppercase tracking-wider mb-3">
            Brand Tone
          </label>
          <div className="grid grid-cols-2 gap-2">
            {TONES.map(t => (
              <button
                key={t.value}
                type="button"
                onClick={() => set('tone', t.value)}
                className={`copy-card text-left ${form.tone === t.value ? 'copy-card-selected' : ''}`}
              >
                <p className="font-semibold text-white text-xs mb-0.5">{t.label}</p>
                <p className="text-white/35 text-[11px]">{t.desc}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Platform + Goal row */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-white/60 uppercase tracking-wider mb-2">
              Platform
            </label>
            <div className="relative">
              <select
                value={form.platform}
                onChange={e => set('platform', e.target.value)}
                className="select-field"
              >
                {PLATFORMS.map(p => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-white/40 text-xs">▼</div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-white/60 uppercase tracking-wider mb-2">
              Ad Goal
            </label>
            <div className="relative">
              <select
                value={form.goal}
                onChange={e => set('goal', e.target.value)}
                className="select-field"
              >
                {GOALS.map(g => (
                  <option key={g.value} value={g.value}>{g.label}</option>
                ))}
              </select>
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-white/40 text-xs">▼</div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-8 flex justify-end">
        <button onClick={handleNext} className="btn-primary px-8 py-3.5">
          Generate AI Copy →
        </button>
      </div>
    </div>
  )
}

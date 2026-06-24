import { useRef } from 'react'
import type { AdSelection, AdDesign } from '../../types'
import AnimatedReel from '../AnimatedReel'

interface Props {
  adSelection: AdSelection
  adDesign: AdDesign
  onDesignChange: (d: AdDesign) => void
  onBack: () => void
  onNext: () => void
}

const TEMPLATES: { id: AdDesign['template']; label: string; desc: string }[] = [
  { id: 'dark_bold', label: 'Dark Bold', desc: 'High contrast, premium feel' },
  { id: 'vibrant', label: 'Vibrant', desc: 'Colorful, energetic gradient' },
  { id: 'clean', label: 'Clean Light', desc: 'Minimal, elegant, bright' },
]

const FORMATS: { id: AdDesign['format']; label: string; dims: string }[] = [
  { id: 'story', label: 'Story / Reel', dims: '9:16' },
  { id: 'square', label: 'Square Post', dims: '1:1' },
  { id: 'landscape', label: 'Landscape', dims: '16:9' },
]

const PRESETS = [
  { primary: '#8b30ff', accent: '#ec4899' },
  { primary: '#3b82f6', accent: '#06b6d4' },
  { primary: '#10b981', accent: '#84cc16' },
  { primary: '#f59e0b', accent: '#ef4444' },
  { primary: '#e879f9', accent: '#f43f5e' },
  { primary: '#6366f1', accent: '#8b5cf6' },
]

export default function Step3ComposeAd({ adSelection, adDesign, onDesignChange, onBack, onNext }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)

  function set<K extends keyof AdDesign>(key: K, value: AdDesign[K]) {
    onDesignChange({ ...adDesign, [key]: value })
  }

  function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const url = URL.createObjectURL(file)
    set('backgroundImage', url)
  }

  return (
    <div className="flex flex-col lg:flex-row gap-10 items-start">
      {/* Controls */}
      <div className="flex-1 min-w-0">
        <div className="mb-8">
          <h2 className="text-2xl font-black text-white mb-2">Compose Your Visual</h2>
          <p className="text-white/45 text-sm">Customise the look of your ad preview.</p>
        </div>

        {/* Template */}
        <div className="card mb-5">
          <p className="text-xs font-bold uppercase tracking-widest text-white/40 mb-3">Template</p>
          <div className="grid grid-cols-3 gap-2">
            {TEMPLATES.map(t => (
              <button
                key={t.id}
                onClick={() => set('template', t.id)}
                className={`p-3 rounded-xl border text-left transition-all ${
                  adDesign.template === t.id
                    ? 'border-brand-400 bg-brand-500/10'
                    : 'border-white/10 bg-white/3 hover:border-white/25'
                }`}
              >
                <p className={`text-xs font-bold mb-0.5 ${adDesign.template === t.id ? 'text-white' : 'text-white/65'}`}>{t.label}</p>
                <p className="text-[10px] text-white/30">{t.desc}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Format */}
        <div className="card mb-5">
          <p className="text-xs font-bold uppercase tracking-widest text-white/40 mb-3">Format</p>
          <div className="flex gap-2">
            {FORMATS.map(f => (
              <button
                key={f.id}
                onClick={() => set('format', f.id)}
                className={`flex-1 py-2.5 px-3 rounded-xl border text-center transition-all ${
                  adDesign.format === f.id
                    ? 'border-brand-400 bg-brand-500/10'
                    : 'border-white/10 bg-white/3 hover:border-white/25'
                }`}
              >
                <p className={`text-xs font-bold ${adDesign.format === f.id ? 'text-white' : 'text-white/60'}`}>{f.label}</p>
                <p className="text-[10px] text-white/30">{f.dims}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Color presets */}
        <div className="card mb-5">
          <p className="text-xs font-bold uppercase tracking-widest text-white/40 mb-3">Color Palette</p>
          <div className="flex flex-wrap gap-2 mb-4">
            {PRESETS.map((p, i) => (
              <button
                key={i}
                onClick={() => onDesignChange({ ...adDesign, primaryColor: p.primary, accentColor: p.accent })}
                className={`w-8 h-8 rounded-full border-2 transition-all ${
                  adDesign.primaryColor === p.primary ? 'border-white scale-110' : 'border-transparent hover:scale-105'
                }`}
                style={{ background: `linear-gradient(135deg, ${p.primary}, ${p.accent})` }}
              />
            ))}
          </div>
          <div className="flex gap-4">
            <label className="flex-1">
              <span className="text-xs text-white/35 block mb-1">Primary</span>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={adDesign.primaryColor}
                  onChange={e => set('primaryColor', e.target.value)}
                  className="w-8 h-8 rounded cursor-pointer bg-transparent border-0 p-0"
                />
                <input
                  type="text"
                  value={adDesign.primaryColor}
                  onChange={e => set('primaryColor', e.target.value)}
                  className="input-field text-xs flex-1 font-mono"
                />
              </div>
            </label>
            <label className="flex-1">
              <span className="text-xs text-white/35 block mb-1">Accent</span>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={adDesign.accentColor}
                  onChange={e => set('accentColor', e.target.value)}
                  className="w-8 h-8 rounded cursor-pointer bg-transparent border-0 p-0"
                />
                <input
                  type="text"
                  value={adDesign.accentColor}
                  onChange={e => set('accentColor', e.target.value)}
                  className="input-field text-xs flex-1 font-mono"
                />
              </div>
            </label>
          </div>
        </div>

        {/* Background image */}
        <div className="card mb-8">
          <p className="text-xs font-bold uppercase tracking-widest text-white/40 mb-3">Background Image (optional)</p>
          {adDesign.backgroundImage ? (
            <div className="flex items-center gap-3">
              <img src={adDesign.backgroundImage} alt="bg" className="w-14 h-14 rounded-lg object-cover border border-white/10" />
              <div>
                <p className="text-sm text-white/70">Image set</p>
                <button onClick={() => set('backgroundImage', null)} className="text-xs text-red-400 hover:text-red-300 mt-0.5">Remove</button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => fileRef.current?.click()}
              className="w-full border border-dashed border-white/15 rounded-xl py-5 text-white/35 text-sm hover:border-white/30 hover:text-white/55 transition-all"
            >
              + Upload product image
            </button>
          )}
          <input ref={fileRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
        </div>

        <div className="flex justify-between">
          <button onClick={onBack} className="btn-ghost px-6 py-2.5 text-sm">← Back</button>
          <button onClick={onNext} className="btn-primary px-6 py-2.5 text-sm">Generate Video →</button>
        </div>
      </div>

      {/* Preview */}
      <div className="lg:sticky lg:top-24 flex flex-col items-center gap-3">
        <p className="text-xs text-white/35 uppercase tracking-widest">Live Preview</p>
        <AnimatedReel selection={adSelection} design={adDesign} />
      </div>
    </div>
  )
}

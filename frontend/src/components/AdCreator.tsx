import { useState } from 'react'
import type { ProductInfo, GeneratedCopy, AdSelection, AdDesign, WizardStep } from '../types'
import Header from './Header'
import Step1ProductInfo from './steps/Step1ProductInfo'
import Step2GenerateCopy from './steps/Step2GenerateCopy'
import Step3ComposeAd from './steps/Step3ComposeAd'
import Step4VideoGenerate from './steps/Step4VideoGenerate'

interface AdCreatorProps {
  onBack: () => void
}

const STEPS = [
  { n: 1, label: 'Product Info' },
  { n: 2, label: 'AI Script' },
  { n: 3, label: 'Compose Visual' },
  { n: 4, label: 'Generate Video' },
]

const DEFAULT_DESIGN: AdDesign = {
  template: 'dark_bold',
  primaryColor: '#8b30ff',
  accentColor: '#ec4899',
  backgroundImage: null,
  format: 'story',
}

export default function AdCreator({ onBack }: AdCreatorProps) {
  const [step, setStep] = useState<WizardStep>(1)
  const [productInfo, setProductInfo] = useState<ProductInfo | null>(null)
  const [, setGeneratedCopy] = useState<GeneratedCopy | null>(null)
  const [adSelection, setAdSelection] = useState<AdSelection | null>(null)
  const [adDesign, setAdDesign] = useState<AdDesign>(DEFAULT_DESIGN)

  function stepStatus(n: number): 'active' | 'done' | 'pending' {
    if (n === step) return 'active'
    if (n < step) return 'done'
    return 'pending'
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header onStart={onBack} minimal onBack={onBack} />

      {/* Step progress bar */}
      <div className="pt-20 pb-4 px-6 border-b border-white/8">
        <div className="max-w-3xl mx-auto flex items-center gap-0">
          {STEPS.map((s, i) => {
            const status = stepStatus(s.n)
            return (
              <div key={s.n} className="flex items-center flex-1">
                <div className="flex items-center gap-2 shrink-0">
                  <div className={`step-badge ${
                    status === 'active' ? 'step-badge-active' :
                    status === 'done' ? 'step-badge-done' :
                    'step-badge-pending'
                  }`}>
                    {status === 'done' ? '✓' : s.n}
                  </div>
                  <span className={`text-xs font-medium hidden sm:block ${
                    status === 'active' ? 'text-white' :
                    status === 'done' ? 'text-green-400' :
                    'text-white/25'
                  }`}>
                    {s.label}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className={`h-px flex-1 mx-3 transition-all duration-500 ${
                    step > s.n ? 'bg-green-500/40' : 'bg-white/8'
                  }`} />
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Step content */}
      <div className="flex-1 py-8 px-6">
        <div className="max-w-3xl mx-auto">
          {step === 1 && (
            <Step1ProductInfo
              onNext={(info) => {
                setProductInfo(info)
                setStep(2)
              }}
            />
          )}
          {step === 2 && productInfo && (
            <Step2GenerateCopy
              productInfo={productInfo}
              onBack={() => setStep(1)}
              onNext={(copy, selection) => {
                setGeneratedCopy(copy)
                setAdSelection(selection)
                setStep(3)
              }}
            />
          )}
          {step === 3 && adSelection && (
            <Step3ComposeAd
              adSelection={adSelection}
              adDesign={adDesign}
              onDesignChange={setAdDesign}
              onBack={() => setStep(2)}
              onNext={() => setStep(4)}
            />
          )}
          {step === 4 && adSelection && productInfo && (
            <Step4VideoGenerate
              productInfo={productInfo}
              adSelection={adSelection}
              adDesign={adDesign}
              onBack={() => setStep(3)}
              onReset={() => {
                setStep(1)
                setProductInfo(null)
                setGeneratedCopy(null)
                setAdSelection(null)
                setAdDesign(DEFAULT_DESIGN)
              }}
            />
          )}
        </div>
      </div>
    </div>
  )
}

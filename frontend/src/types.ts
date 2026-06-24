export interface ProductInfo {
  name: string
  description: string
  audience: string
  tone: 'professional' | 'casual' | 'urgent' | 'inspirational'
  platform: 'instagram' | 'tiktok' | 'facebook' | 'linkedin' | 'all'
  goal: 'awareness' | 'leads' | 'sales' | 'downloads'
}

export interface GeneratedCopy {
  headlines: string[]
  subheadlines: string[]
  ctas: string[]
  body_copy: string
  hashtags: string[]
  hook: string
}

export interface AdSelection {
  headline: string
  subheadline: string
  cta: string
  body_copy: string
  hashtags: string[]
  hook: string
}

export interface AdDesign {
  template: 'dark_bold' | 'vibrant' | 'clean' | 'photo'
  primaryColor: string
  accentColor: string
  backgroundImage: string | null
  format: 'square' | 'story' | 'landscape'
}

export interface VideoJob {
  request_id: string
  model: string
  status: string
  prompt?: string
}

export type WizardStep = 1 | 2 | 3 | 4

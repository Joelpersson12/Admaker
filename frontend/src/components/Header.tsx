interface HeaderProps {
  onStart: () => void
  minimal?: boolean
  onBack?: () => void
}

export default function Header({ onStart, minimal, onBack }: HeaderProps) {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4"
      style={{ background: 'linear-gradient(to bottom, rgba(7,0,15,0.95) 0%, transparent 100%)', backdropFilter: 'blur(12px)' }}>
      <button
        onClick={onBack ?? (() => {})}
        className="flex items-center gap-2 group"
      >
        <div className="w-8 h-8 rounded-lg gradient-bg flex items-center justify-center shadow-lg">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M8 5v14l11-7z" fill="white" />
          </svg>
        </div>
        <span className="font-bold text-base tracking-tight text-white group-hover:gradient-text transition-all">
          Reel<span className="text-brand-400">ix</span>
        </span>
      </button>

      {!minimal && (
        <nav className="hidden md:flex items-center gap-8 text-sm text-white/60">
          <a href="#features" className="hover:text-white transition-colors">Features</a>
          <a href="#how-it-works" className="hover:text-white transition-colors">How it Works</a>
          <a href="#pricing" className="hover:text-white transition-colors">Pricing</a>
        </nav>
      )}

      <div className="flex items-center gap-3">
        {!minimal && (
          <button className="btn-ghost text-xs px-4 py-2">Sign in</button>
        )}
        <button onClick={onStart} className="btn-primary text-xs px-4 py-2">
          {minimal ? '← Back to Home' : 'Create Free Video'}
        </button>
      </div>
    </header>
  )
}

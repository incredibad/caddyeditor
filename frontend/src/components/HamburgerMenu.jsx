import { LogOut, Menu, ShieldCheck, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'

export default function HamburgerMenu({ onOpenTotp }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const { logout, user } = useAuth()

  useEffect(() => {
    if (!open) return
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    const keyHandler = (e) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', handler)
    document.addEventListener('keydown', keyHandler)
    return () => {
      document.removeEventListener('mousedown', handler)
      document.removeEventListener('keydown', keyHandler)
    }
  }, [open])

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="p-1.5 rounded-md"
        style={{ color: 'var(--muted)' }}
        title="Menu"
      >
        {open ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
      </button>

      {open && (
        <div
          className="absolute right-0 top-8 w-48 rounded-lg py-1 shadow-xl z-50"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
        >
          {user?.username && (
            <div
              className="px-3 py-2 text-xs truncate"
              style={{ color: 'var(--muted)', borderBottom: '1px solid var(--border)' }}
            >
              {user.username}
            </div>
          )}

          <button
            onClick={() => { setOpen(false); onOpenTotp() }}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left transition-colors"
            style={{ color: 'var(--text)' }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'var(--surface-hover)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
          >
            <ShieldCheck className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--muted)' }} />
            Two-factor auth
          </button>

          <button
            onClick={() => { setOpen(false); logout() }}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left transition-colors"
            style={{ color: 'var(--text)' }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'var(--surface-hover)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
          >
            <LogOut className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--muted)' }} />
            Log out
          </button>
        </div>
      )}
    </div>
  )
}

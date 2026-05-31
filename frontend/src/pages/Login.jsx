import { Server } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

const inputStyle = {
  background: 'var(--bg)',
  border: '1px solid var(--border)',
  color: 'var(--text)',
}

export default function Login() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [totpCode, setTotpCode] = useState('')
  const [step, setStep] = useState('credentials') // 'credentials' | 'totp'
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)
    try {
      const result = await login(username, password, step === 'totp' ? totpCode : null)
      if (result?.totp_required) {
        setStep('totp')
        return
      }
      navigate('/')
    } catch (err) {
      setError(err.response?.data?.detail || 'Invalid credentials')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div
      className="flex items-center justify-center h-screen"
      style={{ background: 'var(--bg)' }}
    >
      <div
        className="w-full max-w-sm p-8 rounded-xl"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
      >
        <div className="flex items-center gap-3 mb-8">
          <Server className="w-6 h-6" style={{ color: 'var(--primary)' }} />
          <h1 className="text-xl font-semibold">Caddy Editor</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {step === 'credentials' ? (
            <>
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text)' }}>
                  Username
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full px-3 py-2 rounded-md text-sm outline-none"
                  style={inputStyle}
                  autoFocus
                  autoComplete="username"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text)' }}>
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2 rounded-md text-sm outline-none"
                  style={inputStyle}
                  autoComplete="current-password"
                />
              </div>
            </>
          ) : (
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text)' }}>
                Authenticator code
              </label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ''))}
                placeholder="123456"
                className="w-full px-3 py-2 rounded-md text-sm font-mono outline-none text-center tracking-widest"
                style={inputStyle}
                autoFocus
                autoComplete="one-time-code"
              />
              <button
                type="button"
                onClick={() => { setStep('credentials'); setTotpCode(''); setError('') }}
                className="mt-2 text-xs"
                style={{ color: 'var(--muted)' }}
              >
                ← Back
              </button>
            </div>
          )}

          {error && <p className="text-sm text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-2 rounded-md text-sm font-medium transition-opacity disabled:opacity-50"
            style={{ background: 'var(--primary)', color: 'white' }}
          >
            {isLoading ? 'Signing in…' : step === 'totp' ? 'Verify' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  )
}

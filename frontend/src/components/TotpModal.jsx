import { QRCodeSVG } from 'qrcode.react'
import { useEffect, useState } from 'react'
import { CheckCircle, Copy, ShieldCheck, ShieldOff, X } from 'lucide-react'
import toast from 'react-hot-toast'
import client from '../api/client'

const inputStyle = {
  background: 'var(--bg)',
  border: '1px solid var(--border)',
  color: 'var(--text)',
}

const btnSecondary = {
  background: 'var(--surface-hover)',
  border: '1px solid var(--border)',
  color: 'var(--text)',
}

export default function TotpModal({ onClose }) {
  const [status, setStatus] = useState(null)      // null = loading, true/false
  const [step, setStep] = useState('status')       // 'status' | 'setup' | 'disable'
  const [setupData, setSetupData] = useState(null) // {secret, uri}
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [isBusy, setIsBusy] = useState(false)

  useEffect(() => {
    client.get('/api/totp/status').then((r) => setStatus(r.data.enabled))
  }, [])

  const startSetup = async () => {
    setIsBusy(true)
    try {
      const r = await client.post('/api/totp/setup')
      setSetupData(r.data)
      setStep('setup')
      setCode('')
      setError('')
    } catch {
      toast.error('Failed to generate TOTP secret')
    } finally {
      setIsBusy(false)
    }
  }

  const enable = async () => {
    setError('')
    setIsBusy(true)
    try {
      await client.post('/api/totp/enable', { secret: setupData.secret, code })
      setStatus(true)
      setStep('status')
      setSetupData(null)
      setCode('')
      toast.success('Two-factor authentication enabled')
    } catch (err) {
      setError(err.response?.data?.detail || 'Invalid code')
    } finally {
      setIsBusy(false)
    }
  }

  const disable = async () => {
    setError('')
    setIsBusy(true)
    try {
      await client.post('/api/totp/disable', { code })
      setStatus(false)
      setStep('status')
      setCode('')
      toast.success('Two-factor authentication disabled')
    } catch (err) {
      setError(err.response?.data?.detail || 'Invalid code')
    } finally {
      setIsBusy(false)
    }
  }

  const copySecret = () => {
    navigator.clipboard.writeText(setupData.secret)
    toast.success('Secret copied')
  }

  const handleCodeKey = (e) => {
    if (e.key === 'Enter') {
      if (step === 'setup') enable()
      if (step === 'disable') disable()
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.6)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="w-full max-w-sm rounded-xl p-6 shadow-2xl"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5" style={{ color: 'var(--primary)' }} />
            <h2 className="font-semibold text-sm">Two-factor authentication</h2>
          </div>
          <button onClick={onClose} style={{ color: 'var(--muted)' }}>
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Loading */}
        {status === null && (
          <p className="text-sm text-center py-4" style={{ color: 'var(--muted)' }}>Loading…</p>
        )}

        {/* Status view */}
        {status !== null && step === 'status' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm">
              {status ? (
                <>
                  <CheckCircle className="w-4 h-4 text-green-400" />
                  <span>TOTP is <strong>enabled</strong></span>
                </>
              ) : (
                <>
                  <ShieldOff className="w-4 h-4" style={{ color: 'var(--muted)' }} />
                  <span style={{ color: 'var(--muted)' }}>TOTP is <strong>disabled</strong></span>
                </>
              )}
            </div>

            {status ? (
              <button
                onClick={() => { setStep('disable'); setCode(''); setError('') }}
                className="w-full py-2 rounded-md text-sm font-medium"
                style={btnSecondary}
              >
                Disable TOTP
              </button>
            ) : (
              <button
                onClick={startSetup}
                disabled={isBusy}
                className="w-full py-2 rounded-md text-sm font-medium disabled:opacity-50"
                style={{ background: 'var(--primary)', color: 'white' }}
              >
                {isBusy ? 'Generating…' : 'Set up TOTP'}
              </button>
            )}
          </div>
        )}

        {/* Setup view */}
        {step === 'setup' && setupData && (
          <div className="space-y-4">
            <p className="text-xs" style={{ color: 'var(--muted)' }}>
              Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.), then enter the 6-digit code to confirm.
            </p>

            <div className="flex justify-center p-3 rounded-lg bg-white">
              <QRCodeSVG value={setupData.uri} size={180} />
            </div>

            <div>
              <p className="text-xs mb-1" style={{ color: 'var(--muted)' }}>Manual entry key</p>
              <div
                className="flex items-center gap-2 px-3 py-2 rounded-md font-mono text-xs"
                style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}
              >
                <span className="flex-1 break-all">{setupData.secret}</span>
                <button onClick={copySecret} style={{ color: 'var(--muted)' }}>
                  <Copy className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs mb-1.5" style={{ color: 'var(--text)' }}>
                Verification code
              </label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                onKeyDown={handleCodeKey}
                placeholder="123456"
                className="w-full px-3 py-2 rounded-md text-sm font-mono outline-none"
                style={inputStyle}
                autoFocus
              />
            </div>

            {error && <p className="text-xs text-red-400">{error}</p>}

            <div className="flex gap-2">
              <button
                onClick={() => { setStep('status'); setSetupData(null) }}
                className="flex-1 py-2 rounded-md text-sm"
                style={btnSecondary}
              >
                Cancel
              </button>
              <button
                onClick={enable}
                disabled={isBusy || code.length < 6}
                className="flex-1 py-2 rounded-md text-sm font-medium disabled:opacity-50"
                style={{ background: 'var(--primary)', color: 'white' }}
              >
                {isBusy ? 'Verifying…' : 'Enable TOTP'}
              </button>
            </div>
          </div>
        )}

        {/* Disable view */}
        {step === 'disable' && (
          <div className="space-y-4">
            <p className="text-xs" style={{ color: 'var(--muted)' }}>
              Enter your current TOTP code to disable two-factor authentication.
            </p>

            <div>
              <label className="block text-xs mb-1.5" style={{ color: 'var(--text)' }}>
                Current TOTP code
              </label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                onKeyDown={handleCodeKey}
                placeholder="123456"
                className="w-full px-3 py-2 rounded-md text-sm font-mono outline-none"
                style={inputStyle}
                autoFocus
              />
            </div>

            {error && <p className="text-xs text-red-400">{error}</p>}

            <div className="flex gap-2">
              <button
                onClick={() => { setStep('status'); setCode(''); setError('') }}
                className="flex-1 py-2 rounded-md text-sm"
                style={btnSecondary}
              >
                Cancel
              </button>
              <button
                onClick={disable}
                disabled={isBusy || code.length < 6}
                className="flex-1 py-2 rounded-md text-sm font-medium disabled:opacity-50 text-red-400"
                style={{ background: 'var(--surface-hover)', border: '1px solid #ef4444' }}
              >
                {isBusy ? 'Disabling…' : 'Disable TOTP'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

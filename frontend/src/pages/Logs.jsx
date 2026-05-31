import { ArrowLeft, RefreshCw } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import client from '../api/client'

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatTs(ts) {
  if (!ts) return ''
  const d = new Date(parseFloat(ts) * 1000)
  return (
    d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) +
    ' ' +
    d.toLocaleTimeString('en-GB', { hour12: false }) +
    '.' +
    String(d.getMilliseconds()).padStart(3, '0')
  )
}

function formatDuration(s) {
  if (s == null) return null
  if (s < 0.001) return `${(s * 1_000_000).toFixed(0)}µs`
  if (s < 1) return `${(s * 1000).toFixed(1)}ms`
  return `${s.toFixed(2)}s`
}

const LEVEL_STYLE = {
  info:  { color: '#60a5fa', bg: 'rgba(59,130,246,0.12)'  },
  warn:  { color: '#facc15', bg: 'rgba(234,179,8,0.12)'   },
  error: { color: '#f87171', bg: 'rgba(239,68,68,0.12)'   },
  debug: { color: '#9ca3af', bg: 'rgba(107,114,128,0.12)' },
  fatal: { color: '#ef4444', bg: 'rgba(239,68,68,0.2)'    },
}

const STATUS_COLOR = (s) => {
  if (s >= 500) return '#f87171'
  if (s >= 400) return '#facc15'
  if (s >= 300) return '#a78bfa'
  return '#4ade80'
}

// ─── Pretty log entry ────────────────────────────────────────────────────────

function PrettyEntry({ raw }) {
  const [open, setOpen] = useState(false)

  let parsed
  try { parsed = JSON.parse(raw) } catch { parsed = null }

  if (!parsed) {
    return (
      <div className="px-4 py-1 font-mono text-xs" style={{ color: 'var(--muted)' }}>
        {raw}
      </div>
    )
  }

  const { level, ts, logger, msg, request, status, duration, size, ...rest } = parsed
  const lvl = LEVEL_STYLE[level] ?? LEVEL_STYLE.info
  const shortLogger = logger ? logger.split('.').pop() : ''
  const isHttp = logger === 'http.log'
  const hasExtra = Object.keys(rest).length > 0 || request

  return (
    <div
      className="px-4 py-1.5 border-b cursor-pointer select-none"
      style={{ borderColor: 'var(--border)' }}
      onClick={() => hasExtra && setOpen((v) => !v)}
    >
      {/* Main row */}
      <div className="flex items-start gap-2 flex-wrap text-xs font-mono">
        {/* Timestamp */}
        <span className="flex-shrink-0 tabular-nums" style={{ color: 'var(--muted)', minWidth: '13ch' }}>
          {formatTs(ts)}
        </span>

        {/* Level badge */}
        <span
          className="flex-shrink-0 px-1.5 rounded uppercase font-semibold text-[10px] leading-5"
          style={{ background: lvl.bg, color: lvl.color }}
        >
          {level ?? '?'}
        </span>

        {/* Logger */}
        {shortLogger && (
          <span className="flex-shrink-0" style={{ color: 'var(--primary)' }}>
            {shortLogger}
          </span>
        )}

        {/* Message */}
        <span className="flex-1" style={{ color: 'var(--text)' }}>{msg}</span>

        {/* HTTP inline fields */}
        {isHttp && request && (
          <span className="flex items-center gap-1.5 flex-shrink-0">
            <span className="font-bold" style={{ color: '#a78bfa' }}>{request.method}</span>
            <span style={{ color: 'var(--muted)' }}>{request.host}{request.uri}</span>
          </span>
        )}
        {isHttp && status != null && (
          <span className="font-bold flex-shrink-0" style={{ color: STATUS_COLOR(status) }}>
            {status}
          </span>
        )}
        {isHttp && duration != null && (
          <span className="flex-shrink-0" style={{ color: 'var(--muted)' }}>
            {formatDuration(duration)}
          </span>
        )}

        {/* Non-http inline extras: method, uri, remote_ip */}
        {!isHttp && rest.method && (
          <span className="font-bold flex-shrink-0" style={{ color: '#a78bfa' }}>{rest.method}</span>
        )}
        {!isHttp && rest.uri && (
          <span className="flex-shrink-0" style={{ color: 'var(--muted)' }}>{rest.uri}</span>
        )}
        {!isHttp && rest.remote_ip && (
          <span className="flex-shrink-0" style={{ color: 'var(--muted)' }}>{rest.remote_ip}</span>
        )}

        {hasExtra && (
          <span className="flex-shrink-0 text-[10px]" style={{ color: 'var(--muted)' }}>
            {open ? '▲' : '▼'}
          </span>
        )}
      </div>

      {/* Expanded JSON */}
      {open && (
        <pre
          className="mt-2 p-3 rounded text-xs overflow-x-auto"
          style={{ background: 'var(--bg)', color: 'var(--text)' }}
        >
          {JSON.stringify(parsed, null, 2)}
        </pre>
      )}
    </div>
  )
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function Logs() {
  const navigate = useNavigate()
  const [lines, setLines] = useState([])
  const [container, setContainer] = useState('')
  const [tab, setTab] = useState('pretty') // 'raw' | 'pretty'
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [tail, setTail] = useState(500)

  const fetchLogs = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await client.get(`/api/logs?tail=${tail}`)
      setLines(res.data.lines)
      setContainer(res.data.container)
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to fetch logs')
    } finally {
      setIsLoading(false)
    }
  }, [tail])

  useEffect(() => { fetchLogs() }, [fetchLogs])

  const tabStyle = (t) => ({
    padding: '4px 12px',
    borderRadius: '6px',
    fontSize: '13px',
    fontWeight: '500',
    cursor: 'pointer',
    background: tab === t ? 'var(--primary)' : 'transparent',
    color: tab === t ? 'white' : 'var(--muted)',
    border: 'none',
  })

  return (
    <div className="flex flex-col h-screen" style={{ background: 'var(--bg)' }}>
      {/* Header */}
      <header
        className="flex items-center justify-between px-4 flex-shrink-0 gap-3"
        style={{ height: '56px', background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}
      >
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={() => navigate('/')} style={{ color: 'var(--muted)' }} title="Back to editor">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <span className="font-semibold text-sm">Logs</span>
          {container && (
            <span className="text-xs font-mono" style={{ color: 'var(--muted)' }}>
              {container}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Tail selector */}
          <select
            value={tail}
            onChange={(e) => setTail(Number(e.target.value))}
            className="text-xs rounded-md px-2 py-1 outline-none"
            style={{ background: 'var(--surface-hover)', border: '1px solid var(--border)', color: 'var(--text)' }}
          >
            {[100, 250, 500, 1000, 2000].map((n) => (
              <option key={n} value={n}>{n} lines</option>
            ))}
          </select>

          <button
            onClick={fetchLogs}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium disabled:opacity-50"
            style={{ background: 'var(--surface-hover)', border: '1px solid var(--border)', color: 'var(--text)' }}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </header>

      {/* Tab bar */}
      <div
        className="flex items-center gap-1 px-4 flex-shrink-0"
        style={{ height: '44px', borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}
      >
        <button style={tabStyle('pretty')} onClick={() => setTab('pretty')}>Pretty</button>
        <button style={tabStyle('raw')} onClick={() => setTab('raw')}>Raw</button>
        {!isLoading && (
          <span className="ml-auto text-xs" style={{ color: 'var(--muted)' }}>
            {lines.length} lines
          </span>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {isLoading && (
          <div className="flex items-center justify-center h-full text-sm" style={{ color: 'var(--muted)' }}>
            Loading…
          </div>
        )}

        {!isLoading && error && (
          <div className="p-6 text-sm text-red-400">{error}</div>
        )}

        {!isLoading && !error && tab === 'raw' && (
          <pre
            className="p-4 text-xs font-mono leading-relaxed"
            style={{ color: 'var(--text)' }}
          >
            {lines.join('\n') || 'No log lines found.'}
          </pre>
        )}

        {!isLoading && !error && tab === 'pretty' && (
          <div>
            {lines.length === 0 && (
              <p className="p-6 text-sm" style={{ color: 'var(--muted)' }}>No log lines found.</p>
            )}
            {lines.map((line, i) => (
              <PrettyEntry key={i} raw={line} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

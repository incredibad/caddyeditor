import MonacoEditor from '@monaco-editor/react'
import { AlertCircle, LogOut, RefreshCw, Save, Server } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import client from '../api/client'
import { useAuth } from '../contexts/AuthContext'
import { registerCaddyLanguage } from '../utils/caddyLanguage'

export default function Editor() {
  const [initialContent, setInitialContent] = useState(null)
  const [filePath, setFilePath] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isReloading, setIsReloading] = useState(false)
  const [isDirty, setIsDirty] = useState(false)
  const [statusNote, setStatusNote] = useState(null)

  const editorRef = useRef(null)
  const savedContentRef = useRef('')
  const { logout, user } = useAuth()

  useEffect(() => {
    client
      .get('/api/caddyfile')
      .then((res) => {
        setInitialContent(res.data.content)
        savedContentRef.current = res.data.content
        setFilePath(res.data.path)
      })
      .catch((err) => {
        if (err.response?.status === 404) {
          setInitialContent('')
          savedContentRef.current = ''
          setFilePath(err.response?.data?.path || '/data/Caddyfile')
          setStatusNote('File not found — will be created on first save')
        } else {
          toast.error(err.response?.data?.detail || 'Failed to load Caddyfile')
        }
      })
      .finally(() => setIsLoading(false))
  }, [])

  const handleMount = (editor) => {
    editorRef.current = editor
    editor.onDidChangeModelContent(() => {
      setIsDirty(editor.getValue() !== savedContentRef.current)
    })
    editor.focus()
  }

  const handleSave = useCallback(async () => {
    if (!editorRef.current || isSaving) return
    const content = editorRef.current.getValue()
    setIsSaving(true)
    try {
      await client.post('/api/caddyfile', { content })
      savedContentRef.current = content
      setIsDirty(false)
      setStatusNote(null)
      toast.success('Saved')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Save failed')
    } finally {
      setIsSaving(false)
    }
  }, [isSaving])

  const handleReload = useCallback(async () => {
    if (isReloading) return
    if (isDirty) {
      toast.error('Save your changes before reloading')
      return
    }
    setIsReloading(true)
    try {
      await client.post('/api/reload')
      toast.success('Caddy reloaded successfully')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Reload failed')
    } finally {
      setIsReloading(false)
    }
  }, [isDirty, isReloading])

  // Ctrl/Cmd+S to save
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        handleSave()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [handleSave])

  return (
    <div className="flex flex-col h-screen" style={{ background: 'var(--bg)' }}>
      {/* Header */}
      <header
        className="flex items-center justify-between px-4 flex-shrink-0"
        style={{
          height: '56px',
          background: 'var(--surface)',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <div className="flex items-center gap-3 min-w-0">
          <Server className="w-5 h-5 flex-shrink-0" style={{ color: 'var(--primary)' }} />
          <span className="font-semibold text-sm flex-shrink-0">Caddy Editor</span>
          {filePath && (
            <span
              className="text-xs font-mono truncate hidden sm:block"
              style={{ color: 'var(--muted)' }}
            >
              {filePath}
            </span>
          )}
          {isDirty && (
            <span
              className="w-2 h-2 rounded-full flex-shrink-0 bg-yellow-400"
              title="Unsaved changes"
            />
          )}
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={handleSave}
            disabled={isSaving || isLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-opacity disabled:opacity-50"
            style={{ background: 'var(--primary)', color: 'white' }}
            title="Save (Ctrl+S)"
          >
            <Save className="w-3.5 h-3.5" />
            {isSaving ? 'Saving…' : 'Save'}
          </button>

          <button
            onClick={handleReload}
            disabled={isReloading || isLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-opacity disabled:opacity-50"
            style={{
              background: 'var(--surface-hover)',
              border: '1px solid var(--border)',
              color: 'var(--text)',
            }}
            title="Reload Caddy via admin API"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isReloading ? 'animate-spin' : ''}`} />
            {isReloading ? 'Reloading…' : 'Reload Caddy'}
          </button>

          <button
            onClick={logout}
            className="p-1.5 rounded-md transition-colors"
            style={{ color: 'var(--muted)' }}
            title={`Logout (${user?.username})`}
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Editor */}
      <div className="flex-1 overflow-hidden">
        {isLoading ? (
          <div
            className="flex items-center justify-center h-full text-sm"
            style={{ color: 'var(--muted)' }}
          >
            Loading…
          </div>
        ) : (
          <MonacoEditor
            height="100%"
            language="caddyfile"
            theme="vs-dark"
            defaultValue={initialContent ?? ''}
            onMount={handleMount}
            beforeMount={(monaco) => registerCaddyLanguage(monaco)}
            options={{
              fontSize: 14,
              fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, 'Courier New', monospace",
              fontLigatures: true,
              minimap: { enabled: false },
              lineNumbers: 'on',
              wordWrap: 'off',
              scrollBeyondLastLine: false,
              folding: true,
              renderLineHighlight: 'all',
              padding: { top: 16, bottom: 16 },
              smoothScrolling: true,
              cursorSmoothCaretAnimation: 'on',
              tabSize: 4,
              insertSpaces: false,
            }}
          />
        )}
      </div>

      {/* Status bar */}
      {(statusNote || isDirty) && (
        <div
          className="flex items-center gap-2 px-4 py-1 text-xs flex-shrink-0"
          style={{
            background: 'var(--surface)',
            borderTop: '1px solid var(--border)',
            color: 'var(--muted)',
          }}
        >
          {statusNote && (
            <>
              <AlertCircle className="w-3 h-3 text-yellow-400" />
              <span>{statusNote}</span>
            </>
          )}
          {isDirty && !statusNote && <span>Unsaved changes — Ctrl+S to save</span>}
        </div>
      )}
    </div>
  )
}

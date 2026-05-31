import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './contexts/AuthContext'
import Editor from './pages/Editor'
import Login from './pages/Login'
import Logs from './pages/Logs'

export default function App() {
  const { isAuthenticated, isChecking } = useAuth()

  if (isChecking) {
    return (
      <div
        className="flex items-center justify-center h-screen"
        style={{ background: 'var(--bg)', color: 'var(--muted)' }}
      >
        Loading...
      </div>
    )
  }

  return (
    <Routes>
      <Route
        path="/login"
        element={isAuthenticated ? <Navigate to="/" replace /> : <Login />}
      />
      <Route
        path="/logs"
        element={isAuthenticated ? <Logs /> : <Navigate to="/login" replace />}
      />
      <Route
        path="/*"
        element={isAuthenticated ? <Editor /> : <Navigate to="/login" replace />}
      />
    </Routes>
  )
}

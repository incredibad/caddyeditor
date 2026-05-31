import axios from 'axios'
import { createContext, useContext, useEffect, useState } from 'react'

const AuthContext = createContext()

export function AuthProvider({ children }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isChecking, setIsChecking] = useState(true)
  const [user, setUser] = useState(null)

  useEffect(() => {
    const token = localStorage.getItem('token')
    const headers = token ? { Authorization: `Bearer ${token}` } : {}

    axios
      .get('/auth/me', { headers })
      .then((res) => {
        setUser(res.data)
        setIsAuthenticated(true)
      })
      .catch(() => {
        localStorage.removeItem('token')
        setIsAuthenticated(false)
      })
      .finally(() => setIsChecking(false))
  }, [])

  const login = async (username, password) => {
    const res = await axios.post('/auth/login', { username, password })
    const { access_token } = res.data
    localStorage.setItem('token', access_token)
    setUser({ username })
    setIsAuthenticated(true)
  }

  const logout = () => {
    localStorage.removeItem('token')
    setUser(null)
    setIsAuthenticated(false)
  }

  return (
    <AuthContext.Provider value={{ isAuthenticated, isChecking, user, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)

import { useState, useEffect, useCallback } from 'react'

export interface User {
  id: number
  email: string
  name: string
}

const TOKEN_KEY = 'reelix_token'

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY)
    if (!token) { setLoading(false); return }
    fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(data => setUser(data?.user ?? null))
      .catch(() => setUser(null))
      .finally(() => setLoading(false))
  }, [])

  const login = useCallback((token: string, u: User) => {
    localStorage.setItem(TOKEN_KEY, token)
    setUser(u)
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY)
    setUser(null)
  }, [])

  const token = () => localStorage.getItem(TOKEN_KEY)

  return { user, loading, login, logout, token }
}

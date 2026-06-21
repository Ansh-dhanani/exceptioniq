import React, { createContext, useContext, useEffect, useState } from 'react'
import { client } from '../api/client'

export type User = {
  id: string;
  username: string;
  email: string;
  role: string;
  first_name?: string;
  last_name?: string;
  organization?: string | null;
  organization_name?: string | null;
}

type AuthCtx = {
  user: User | null;
  loading: boolean;
  hasOrg: boolean;
  login: (username: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthCtx | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  const refreshUser = async () => {
    try {
      const data = await client.get('/auth/me/')
      setUser(data)
      if (data && data.role) {
        localStorage.setItem('currentUserRole', data.role)
      }
    } catch (err) {
      setUser(null)
    } finally {
      setLoading(false)
    }
  }

  const handleLogin = async (username: string, password: string) => {
    const data = await client.post('/auth/login/', { username, password })
    setUser(data)
    localStorage.setItem('currentUserRole', data.role)
    return data
  }

  const hasOrg = !!user?.organization

  const handleLogout = async () => {
    try {
      await client.post('/auth/logout/', {})
    } catch (err) {
      console.error('Logout failed on server, cleaning up local state', err)
    } finally {
      setUser(null)
    }
  }

  useEffect(() => {
    refreshUser()
  }, [])

  return (
    <AuthContext.Provider value={{ user, loading, login: handleLogin, logout: handleLogout, refreshUser, hasOrg }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

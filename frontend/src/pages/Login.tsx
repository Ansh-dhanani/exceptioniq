import { useState } from 'react'
import { useNavigate, Navigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const { user, login } = useAuth()
  const navigate = useNavigate()

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  if (user) {
    return <Navigate to={user.organization ? "/app/dashboard" : "/org/setup"} replace />
  }

  const redirectAfterLogin = (userData: any) => {
    if (userData.organization) {
      navigate('/app/dashboard')
    } else {
      navigate('/org/setup')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!username.trim() || !password.trim()) {
      setError('Enter both username and password.')
      return
    }
    setLoading(true)
    setError('')
    try {
      const userData = await login(username.trim(), password.trim())
      redirectAfterLogin(userData)
    } catch (err: any) {
      setError(err.message || 'Invalid username or password.')
    } finally {
      setLoading(false)
    }
  }

  const handleQuickLogin = async (role: string) => {
    setLoading(true)
    setError('')
    try {
      const userData = await login(role, role)
      redirectAfterLogin(userData)
    } catch (err: any) {
      setError(err.message || `Quick login failed for ${role}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      display: 'flex',
      minHeight: '100vh',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#f9fafb',
      padding: '24px',
    }}>
      <div style={{
        width: '100%',
        maxWidth: 400,
        background: '#fff',
        border: '1px solid #e5e7eb',
        borderRadius: 10,
        padding: '32px',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <Link to="/" style={{ textDecoration: 'none' }}>
            <h1 style={{ fontSize: 24, fontWeight: 700, color: '#111827', margin: '0 0 4px 0', letterSpacing: '-0.3px' }}>
              ExceptionIQ
            </h1>
          </Link>
          <p style={{ color: '#6b7280', fontSize: 13, margin: 0 }}>
            Sign in to your workspace
          </p>
        </div>

        {error && (
          <div style={{
            background: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: 6,
            color: '#991b1b',
            fontSize: 13,
            padding: '10px 14px',
            marginBottom: 16,
            fontWeight: 500,
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4, display: 'block' }}>
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. analyst"
              style={{
                width: '100%',
                padding: '8px 12px',
                fontSize: 13,
                borderRadius: 6,
                border: '1px solid #d1d5db',
                background: '#fff',
                color: '#111827',
                outline: 'none',
              }}
              onFocus={(e) => e.target.style.borderColor = '#3B4EFF'}
              onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
              required
            />
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4, display: 'block' }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="......"
              style={{
                width: '100%',
                padding: '8px 12px',
                fontSize: 13,
                borderRadius: 6,
                border: '1px solid #d1d5db',
                background: '#fff',
                color: '#111827',
                outline: 'none',
              }}
              onFocus={(e) => e.target.style.borderColor = '#3B4EFF'}
              onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
              required
            />
          </div>

          <button
            type="submit"
            style={{
              width: '100%',
              padding: '9px 0',
              background: '#111827',
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              opacity: loading ? 0.7 : 1,
            }}
            disabled={loading}
          >
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        <div style={{
          marginTop: 28,
          borderTop: '1px solid #e5e7eb',
          paddingTop: 20,
        }}>
          <div style={{
            fontSize: 11,
            fontWeight: 600,
            color: '#6b7280',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            marginBottom: 10,
            textAlign: 'center',
          }}>
            Demo accounts
          </div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 6,
          }}>
            {['admin', 'manager', 'approver', 'analyst'].map((role) => (
              <button
                key={role}
                onClick={() => handleQuickLogin(role)}
                style={{
                  padding: '7px 0',
                  fontSize: 12,
                  fontWeight: 600,
                  background: '#fff',
                  color: '#374151',
                  border: '1px solid #d1d5db',
                  borderRadius: 6,
                  cursor: 'pointer',
                  textTransform: 'capitalize',
                }}
                disabled={loading}
              >
                {role}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

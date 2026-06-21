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
          marginTop: 20,
          borderTop: '1px solid #e5e7eb',
          paddingTop: 16,
        }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', margin: '0 0 8px 0' }}>
            Quick Login (demo accounts)
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {[
              { role: 'manager', username: 'manager' },
              { role: 'analyst', username: 'analyst' },
              { role: 'approver', username: 'approver' },
              { role: 'admin', username: 'admin' },
            ].map(({ role, username: uname }) => (
              <button
                key={uname}
                onClick={async () => {
                  setLoading(true)
                  setError('')
                  try {
                    const userData = await login(uname, uname)
                    redirectAfterLogin(userData)
                  } catch (err: any) {
                    setError(err.message || 'Login failed.')
                  } finally {
                    setLoading(false)
                  }
                }}
                style={{
                  padding: '4px 10px',
                  fontSize: 11,
                  borderRadius: 4,
                  border: '1px solid #d1d5db',
                  background: '#f9fafb',
                  color: '#374151',
                  cursor: 'pointer',
                  fontWeight: 500,
                }}
              >
                {role}
              </button>
            ))}
          </div>
        </div>

        <div style={{
          marginTop: 16,
          padding: '12px 14px',
          background: '#f8fafc',
          borderRadius: 6,
          border: '1px solid #e2e8f0',
          fontSize: 12,
          color: '#475569',
          lineHeight: 1.5,
        }}>
          <strong style={{ color: '#1e293b' }}>New to ExceptionIQ?</strong><br />
          Managers create an organization first, then invite team members via invite codes.
          If you have an invite code, sign in and you can join your organization.
        </div>

        <div style={{ marginTop: 16, textAlign: 'center', fontSize: 12, color: '#6b7280' }}>
          No account?{' '}
          <Link to="/register" style={{ fontWeight: 600 }}>Create one</Link>
        </div>
      </div>
    </div>
  )
}

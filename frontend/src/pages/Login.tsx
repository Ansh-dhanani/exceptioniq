import { useState } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const { user, login } = useAuth()
  const navigate = useNavigate()

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  if (user) {
    return <Navigate to="/dashboard" replace />
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!username.trim() || !password.trim()) {
      setError('Please enter both username and password.')
      return
    }

    setLoading(true)
    setError('')

    try {
      await login(username.trim(), password.trim())
      navigate('/dashboard')
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
      await login(role, role)
      navigate('/dashboard')
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
      background: 'var(--color-bg)',
      padding: '24px'
    }}>
      <div style={{
        width: '100%',
        maxWidth: '440px',
        background: '#ffffff',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius)',
        boxShadow: 'var(--shadow-card)',
        padding: '36px'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <h1 style={{ fontSize: '28px', color: 'var(--color-text)', fontWeight: 700, margin: '0 0 8px 0' }}>ExceptionIQ</h1>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '14px', margin: 0 }}>Maker-Checker Reconciliation Platform</p>
        </div>

        {error && (
          <div style={{
            background: 'var(--color-danger-bg)',
            border: '1px solid #fca5a5',
            borderRadius: '4px',
            color: '#991b1b',
            fontSize: '13px',
            padding: '12px',
            marginBottom: '20px',
            fontWeight: 500
          }}>
            ⚠️ {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. analyst"
              className="form-input"
              required
            />
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="form-input"
              required
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', marginTop: '8px', height: '42px', fontWeight: 600 }}
            disabled={loading}
          >
            {loading ? 'Authenticating...' : 'Sign In'}
          </button>
        </form>

        <div style={{
          marginTop: '32px',
          borderTop: '1px solid var(--color-border)',
          paddingTop: '24px'
        }}>
          <div style={{
            fontSize: '11px',
            fontWeight: 600,
            textTransform: 'uppercase',
            color: 'var(--color-text-secondary)',
            letterSpacing: '0.5px',
            marginBottom: '12px',
            textAlign: 'center'
          }}>
            Developer Bypass Roles
          </div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '8px'
          }}>
            <button
              onClick={() => handleQuickLogin('analyst')}
              className="btn btn-secondary"
              style={{ fontSize: '12px', padding: '8px' }}
              disabled={loading}
            >
              💼 Analyst
            </button>
            <button
              onClick={() => handleQuickLogin('approver')}
              className="btn btn-secondary"
              style={{ fontSize: '12px', padding: '8px' }}
              disabled={loading}
            >
              ✍️ Approver
            </button>
            <button
              onClick={() => handleQuickLogin('manager')}
              className="btn btn-secondary"
              style={{ fontSize: '12px', padding: '8px' }}
              disabled={loading}
            >
              📈 Manager
            </button>
            <button
              onClick={() => handleQuickLogin('admin')}
              className="btn btn-secondary"
              style={{ fontSize: '12px', padding: '8px' }}
              disabled={loading}
            >
              🔑 Admin
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

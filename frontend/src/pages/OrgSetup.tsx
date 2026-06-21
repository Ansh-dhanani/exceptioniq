import { useState } from 'react'
import { useNavigate, Navigate, Link } from 'react-router-dom'
import { client } from '../api/client'
import { useAuth } from '../context/AuthContext'

export default function OrgSetup() {
  const { user, refreshUser } = useAuth()
  const navigate = useNavigate()
  const isManager = user?.role === 'manager'

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (user.organization) {
    return <Navigate to="/app/dashboard" replace />
  }

  const [orgName, setOrgName] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const handleCreateOrg = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!orgName.trim()) return
    setLoading(true)
    setError('')
    try {
      await client.post('/org/create/', { name: orgName.trim() })
      setSuccess(`Organization "${orgName.trim()}" created!`)
      await refreshUser()
      setTimeout(() => navigate('/app/dashboard'), 800)
    } catch (err: any) {
      setError(err.message || 'Failed to create organization')
    } finally {
      setLoading(false)
    }
  }

  const handleJoinOrg = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inviteCode.trim()) return
    setLoading(true)
    setError('')
    try {
      await client.post('/org/join/', { code: inviteCode.trim() })
      setSuccess('Joined organization successfully!')
      await refreshUser()
      setTimeout(() => navigate('/app/dashboard'), 800)
    } catch (err: any) {
      setError(err.message || 'Invalid or expired invite code')
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
        maxWidth: 440,
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
            {isManager
              ? 'Create your organization to get started'
              : 'Enter your invite code to join an organization'}
          </p>
        </div>

        {/* Role indicator */}
        <div style={{
          textAlign: 'center',
          marginBottom: 20,
          padding: '8px 16px',
          background: '#f0f5ff',
          borderRadius: 6,
          fontSize: 12,
          color: '#1e40af',
          fontWeight: 600,
        }}>
          Signed in as <strong>{user?.username}</strong> ({user?.role})
        </div>

        {error && (
          <div style={{
            background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6,
            color: '#991b1b', fontSize: 13, padding: '10px 14px', marginBottom: 16, fontWeight: 500,
          }}>
            {error}
          </div>
        )}

        {success && (
          <div style={{
            background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 6,
            color: '#065f46', fontSize: 13, padding: '10px 14px', marginBottom: 16, fontWeight: 500,
          }}>
            {success}
          </div>
        )}

        {isManager ? (
          <form onSubmit={handleCreateOrg} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4, display: 'block' }}>
                Organization Name
              </label>
              <input
                type="text"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                placeholder="e.g. Acme Corporation"
                style={{
                  width: '100%', padding: '8px 12px', fontSize: 13, borderRadius: 6,
                  border: '1px solid #d1d5db', background: '#fff', color: '#111827', outline: 'none',
                }}
                required
              />
            </div>
            <button
              type="submit"
              style={{
                width: '100%', padding: '9px 0', background: '#111827', color: '#fff',
                border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600,
                cursor: 'pointer', opacity: loading ? 0.7 : 1,
              }}
              disabled={loading}
            >
              {loading ? 'Creating...' : 'Create Organization'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleJoinOrg} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4, display: 'block' }}>
                Invite Code
              </label>
              <input
                type="text"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
                placeholder="Paste invite code from your manager"
                style={{
                  width: '100%', padding: '8px 12px', fontSize: 13, borderRadius: 6,
                  border: '1px solid #d1d5db', background: '#fff', color: '#111827', outline: 'none',
                  fontFamily: 'monospace',
                }}
                required
              />
            </div>
            <button
              type="submit"
              style={{
                width: '100%', padding: '9px 0', background: '#111827', color: '#fff',
                border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600,
                cursor: 'pointer', opacity: loading ? 0.7 : 1,
              }}
              disabled={loading}
            >
              {loading ? 'Joining...' : 'Join Organization'}
            </button>
          </form>
        )}

        <div style={{ marginTop: 20, textAlign: 'center' }}>
          <button
            onClick={() => navigate('/login')}
            style={{
              background: 'none', border: 'none', color: '#6b7280', fontSize: 12,
              cursor: 'pointer', textDecoration: 'underline',
            }}
          >
            Switch account
          </button>
        </div>
      </div>
    </div>
  )
}

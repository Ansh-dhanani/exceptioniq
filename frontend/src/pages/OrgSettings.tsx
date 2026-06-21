import { useState, useEffect } from 'react'
import { client } from '../api/client'

type Member = {
  id: string
  username: string
  email: string
  role: string
  date_joined: string
}

type Invite = {
  id: string
  code: string
  role: string
  is_used: boolean
  created_at: string
  expires_at: string
}

export default function OrgSettings() {
  const [members, setMembers] = useState<Member[]>([])
  const [invites, setInvites] = useState<Invite[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [inviteRole, setInviteRole] = useState('analyst')
  const [inviteHours, setInviteHours] = useState(72)
  const [generating, setGenerating] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const fetchData = async () => {
    setLoading(true)
    setError('')
    try {
      const [membersData, invitesData] = await Promise.all([
        client.get('/org/members/'),
        client.get('/org/invites/')
      ])
      setMembers(membersData)
      setInvites(invitesData)
    } catch (err: any) {
      setError(err.message || 'Failed to load organization data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  useEffect(() => {
    if (success || error) {
      const t = setTimeout(() => { setSuccess(''); setError('') }, 4000)
      return () => clearTimeout(t)
    }
  }, [success, error])

  useEffect(() => {
    if (copiedId) {
      const t = setTimeout(() => setCopiedId(null), 2000)
      return () => clearTimeout(t)
    }
  }, [copiedId])

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault()
    setGenerating(true)
    setError('')
    try {
      const invite = await client.post('/org/invite/', {
        role: inviteRole,
        expires_in_hours: inviteHours,
      })
      setInvites((prev) => [invite, ...prev])
      setSuccess(`Invite code generated for role: ${inviteRole}`)
    } catch (err: any) {
      setError(err.message || 'Failed to generate invite')
    } finally {
      setGenerating(false)
    }
  }

  const copyToClipboard = async (code: string, id: string) => {
    try {
      await navigator.clipboard.writeText(code)
      setCopiedId(id)
    } catch {
      setError('Failed to copy to clipboard')
    }
  }

  if (loading) {
    return (
      <div className="page-container" style={{ padding: 0 }}>
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--color-text-secondary)' }}>
          Loading organization settings...
        </div>
      </div>
    )
  }

  return (
    <div className="page-container" style={{ padding: 0 }}>
      <div className="page-header-row">
        <div>
          <h1>Organization Settings</h1>
          <p>Manage members and invite codes for your organization</p>
        </div>
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

      {/* Generate Invite */}
      <div className="card" style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, margin: '0 0 4px 0' }}>Generate Invite Code</h2>
        <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', margin: '0 0 16px 0' }}>
          Create an invite code to grant access to your organization
        </p>
        <form onSubmit={handleGenerate} style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div className="form-group" style={{ minWidth: 160 }}>
            <label className="form-label">Role</label>
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value)}
              className="form-input"
            >
              <option value="admin">Admin</option>
              <option value="analyst">Analyst</option>
              <option value="approver">Approver</option>
              <option value="manager">Manager</option>
              <option value="viewer">Viewer</option>
            </select>
          </div>
          <div className="form-group" style={{ minWidth: 120 }}>
            <label className="form-label">Expires in (hours)</label>
            <input
              type="number"
              value={inviteHours}
              onChange={(e) => setInviteHours(Number(e.target.value))}
              className="form-input"
              min={1}
              max={720}
            />
          </div>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={generating}
            style={{ height: 36 }}
          >
            {generating ? 'Generating...' : 'Generate Code'}
          </button>
        </form>
      </div>

      {/* Invite Codes */}
      <div className="card" style={{ marginBottom: 24, padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--color-border)' }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>Invite Codes</h2>
        </div>
        {invites.length === 0 ? (
          <div style={{ padding: 36, textAlign: 'center', color: 'var(--color-text-secondary)', fontSize: 13 }}>
            No invite codes generated yet
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="table" style={{ margin: 0, width: '100%' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid var(--color-border)' }}>
                  <th style={{ padding: '10px 16px', textAlign: 'left' }}>Code</th>
                  <th style={{ padding: '10px 16px', textAlign: 'left' }}>Role</th>
                  <th style={{ padding: '10px 16px', textAlign: 'center' }}>Status</th>
                  <th style={{ padding: '10px 16px', textAlign: 'left' }}>Expires</th>
                  <th style={{ padding: '10px 16px', textAlign: 'center' }}>Copy</th>
                </tr>
              </thead>
              <tbody>
                {invites.map((inv) => (
                  <tr key={inv.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <td style={{ padding: '10px 16px', fontFamily: 'monospace', fontSize: 12 }}>
                      {inv.is_used ? '••••••••••••••••' : inv.code}
                    </td>
                    <td style={{ padding: '10px 16px', textTransform: 'capitalize', fontWeight: 500 }}>
                      {inv.role}
                    </td>
                    <td style={{ padding: '10px 16px', textAlign: 'center' }}>
                      {inv.is_used ? (
                        <span style={{ background: '#f1f5f9', color: '#64748b', padding: '2px 6px', borderRadius: 4, fontSize: 11, fontWeight: 600 }}>
                          Used
                        </span>
                      ) : (
                        <span style={{ background: '#ecfdf5', color: '#065f46', padding: '2px 6px', borderRadius: 4, fontSize: 11, fontWeight: 600 }}>
                          Active
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '10px 16px', fontSize: 12, color: 'var(--color-text-secondary)' }}>
                      {new Date(inv.expires_at).toLocaleDateString()}
                    </td>
                    <td style={{ padding: '10px 16px', textAlign: 'center' }}>
                      <button
                        onClick={() => copyToClipboard(inv.code, inv.id)}
                        className="btn btn-secondary"
                        style={{ padding: '4px 10px', fontSize: 11, minWidth: 60 }}
                        disabled={inv.is_used}
                      >
                        {copiedId === inv.id ? 'Copied!' : 'Copy'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Members */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--color-border)' }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>
            Members ({members.length})
          </h2>
        </div>
        {members.length === 0 ? (
          <div style={{ padding: 36, textAlign: 'center', color: 'var(--color-text-secondary)', fontSize: 13 }}>
            No members
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="table" style={{ margin: 0, width: '100%' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid var(--color-border)' }}>
                  <th style={{ padding: '10px 16px', textAlign: 'left' }}>Username</th>
                  <th style={{ padding: '10px 16px', textAlign: 'left' }}>Email</th>
                  <th style={{ padding: '10px 16px', textAlign: 'left' }}>Role</th>
                  <th style={{ padding: '10px 16px', textAlign: 'left' }}>Joined</th>
                </tr>
              </thead>
              <tbody>
                {members.map((m) => (
                  <tr key={m.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <td style={{ padding: '10px 16px', fontWeight: 600 }}>{m.username}</td>
                    <td style={{ padding: '10px 16px', fontSize: 12, color: 'var(--color-text-secondary)' }}>
                      {m.email}
                    </td>
                    <td style={{ padding: '10px 16px', textTransform: 'capitalize' }}>{m.role}</td>
                    <td style={{ padding: '10px 16px', fontSize: 12, color: 'var(--color-text-secondary)' }}>
                      {new Date(m.date_joined).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

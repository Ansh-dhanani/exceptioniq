import { useState, useEffect } from 'react'
import { Outlet, Navigate } from 'react-router-dom'
import Sidebar from './components/Sidebar'
import Navbar from './components/Navbar'
import { useAuth } from './context/AuthContext'

export default function App() {
  const { user, loading } = useAuth()
  const [entityId, setEntityId] = useState<string>(() => localStorage.getItem('selectedEntityId') || '')

  useEffect(() => {
    if (entityId) {
      localStorage.setItem('selectedEntityId', entityId)
    }
  }, [entityId])

  if (loading) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', background: 'var(--color-bg)' }}>
        <div style={{ fontSize: '14px', color: 'var(--color-text-secondary)' }}>Loading ExceptionIQ workspace...</div>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/" replace />
  }

  return (
    <div className="app-container">
      <Sidebar />
      <div className="main-content">
        <Navbar 
          entityId={entityId} 
          setEntityId={setEntityId} 
          currentUserRole={user.role} 
          setCurrentUserRole={() => {}} // Switched via account login inside Navbar
        />
        <main className="page-container">
          <Outlet context={{ entityId, setEntityId, currentUserRole: user.role }} />
        </main>
      </div>
    </div>
  )
}

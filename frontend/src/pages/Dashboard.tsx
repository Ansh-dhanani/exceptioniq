import { useOutletContext } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import AnalystDashboard from './dashboards/AnalystDashboard'
import ApproverDashboard from './dashboards/ApproverDashboard'
import ManagerDashboard from './dashboards/ManagerDashboard'
import AdminDashboard from './dashboards/AdminDashboard'
import ViewerDashboard from './dashboards/ViewerDashboard'

interface AppContextType {
  entityId: string;
}

export default function Dashboard() {
  const { entityId } = useOutletContext<AppContextType>()
  const { user, loading } = useAuth()

  if (loading) {
    return <div style={{ padding: '24px' }}>Loading workspace session...</div>
  }

  if (!user) {
    return <div style={{ padding: '24px' }}>No active session found. Please log in.</div>
  }

  switch (user.role) {
    case 'admin':
      return <AdminDashboard entityId={entityId} user={user} />
    case 'manager':
      return <ManagerDashboard entityId={entityId} user={user} />
    case 'approver':
      return <ApproverDashboard entityId={entityId} user={user} />
    case 'analyst':
      return <AnalystDashboard entityId={entityId} user={user} />
    default:
      return <ViewerDashboard entityId={entityId} user={user} />
  }
}

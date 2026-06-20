import { NavLink } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Sidebar() {
  const { user } = useAuth()
  const role = user?.role || 'viewer'

  const showIngestion = ['admin', 'manager', 'analyst'].includes(role)
  const showRouting = ['admin'].includes(role)

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        ExceptionIQ
      </div>
      <nav style={{ display: 'flex', flexDirection: 'column', height: 'calc(100% - 64px)', justifyContent: 'space-between' }}>
        <ul className="sidebar-menu">
          <li>
            <NavLink to="/dashboard" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
              📊 Dashboard
            </NavLink>
          </li>
          <li>
            <NavLink to="/exceptions" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
              🔍 Exceptions Queue
            </NavLink>
          </li>
          
          {showIngestion && (
            <li>
              <NavLink to="/ingestion" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
                📥 Data Ingestion
              </NavLink>
            </li>
          )}
          
          {showRouting && (
            <li>
              <NavLink to="/routing-rules" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
                ⚙️ Routing Rules
              </NavLink>
            </li>
          )}
        </ul>
      </nav>
    </aside>
  )
}

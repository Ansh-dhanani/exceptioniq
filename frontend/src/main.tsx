import React from 'react'
import ReactDOM from 'react-dom/client'
import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom'
import App from './App'
import Landing from './pages/Landing'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import OrgSetup from './pages/OrgSetup'
import OrgSettings from './pages/OrgSettings'
import ExceptionQueue from './pages/ExceptionQueue'
import ExceptionDetail from './pages/ExceptionDetail'
import Ingestion from './pages/Ingestion'
import RoutingRules from './pages/RoutingRules'
import GSTRecon from './pages/GSTRecon'
import TDSRecon from './pages/TDSRecon'
import VendorRisk from './pages/VendorRisk'
import MonthEndClose from './pages/MonthEndClose'
import Integrations from './pages/Integrations'
import { AuthProvider } from './context/AuthContext'
import './index.css'

const router = createBrowserRouter([
  {
    path: '/',
    element: <Landing />,
  },
  {
    path: '/login',
    element: <Login />,
  },
  {
    path: '/org/setup',
    element: <OrgSetup />,
  },
  {
    path: '/app',
    element: <App />,
    children: [
      { index: true, element: <Navigate to="/app/dashboard" replace /> },
      { path: 'dashboard', element: <Dashboard /> },
      { path: 'exceptions', element: <ExceptionQueue /> },
      { path: 'exceptions/:id', element: <ExceptionDetail /> },
      { path: 'ingestion', element: <Ingestion /> },
      { path: 'gst', element: <GSTRecon /> },
      { path: 'tds', element: <TDSRecon /> },
      { path: 'vendors', element: <VendorRisk /> },
      { path: 'close', element: <MonthEndClose /> },
      { path: 'integrations', element: <Integrations /> },
      { path: 'routing-rules', element: <RoutingRules /> },
      { path: 'org/settings', element: <OrgSettings /> },
      { path: '*', element: <Navigate to="/app/dashboard" replace /> }
    ],
  },
])

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  </React.StrictMode>,
)

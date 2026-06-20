import React from 'react'
import ReactDOM from 'react-dom/client'
import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom'
import App from './App'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import ExceptionQueue from './pages/ExceptionQueue'
import ExceptionDetail from './pages/ExceptionDetail'
import Ingestion from './pages/Ingestion'
import RoutingRules from './pages/RoutingRules'
import { AuthProvider } from './context/AuthContext'
import './index.css'

const router = createBrowserRouter([
  {
    path: '/login',
    element: <Login />,
  },
  {
    path: '/',
    element: <App />,
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      { path: 'dashboard', element: <Dashboard /> },
      { path: 'exceptions', element: <ExceptionQueue /> },
      { path: 'exceptions/:id', element: <ExceptionDetail /> },
      { path: 'ingestion', element: <Ingestion /> },
      { path: 'routing-rules', element: <RoutingRules /> },
      { path: '*', element: <Navigate to="/dashboard" replace /> }
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

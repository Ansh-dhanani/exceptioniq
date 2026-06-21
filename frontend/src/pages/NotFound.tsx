import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <div style={{
      display: 'flex',
      minHeight: '100vh',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#f9fafb',
      padding: '24px',
    }}>
      <div style={{ textAlign: 'center' }}>
        <h1 style={{ fontSize: 72, fontWeight: 800, color: '#111827', margin: '0 0 8px 0', letterSpacing: '-2px' }}>
          404
        </h1>
        <p style={{ fontSize: 16, color: '#6b7280', margin: '0 0 24px 0' }}>
          Page not found
        </p>
        <Link
          to="/"
          style={{
            display: 'inline-block',
            padding: '10px 24px',
            background: '#111827',
            color: '#fff',
            borderRadius: 6,
            textDecoration: 'none',
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          Go home
        </Link>
      </div>
    </div>
  )
}
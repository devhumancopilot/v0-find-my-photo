/**
 * Backend API Server Status Page
 * This is just a status page - all actual logic is in /api routes
 */

export default function BackendStatusPage() {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      fontFamily: 'system-ui, sans-serif',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      color: 'white',
      padding: '20px',
    }}>
      <h1 style={{ fontSize: '3rem', marginBottom: '1rem' }}>
        ✅ Find My Photo API Server
      </h1>
      <p style={{ fontSize: '1.2rem', opacity: 0.9 }}>
        Backend server is running successfully
      </p>
      <div style={{
        marginTop: '2rem',
        padding: '1.5rem',
        background: 'rgba(255,255,255,0.1)',
        borderRadius: '10px',
        backdropFilter: 'blur(10px)',
      }}>
        <p style={{ margin: '0.5rem 0' }}>
          <strong>Status:</strong> Online
        </p>
        <p style={{ margin: '0.5rem 0' }}>
          <strong>Environment:</strong> {process.env.NODE_ENV}
        </p>
        <p style={{ margin: '0.5rem 0' }}>
          <strong>API Endpoint:</strong> /api/*
        </p>
      </div>
      <div style={{ marginTop: '2rem', textAlign: 'center', opacity: 0.7 }}>
        <p>This is the backend API server.</p>
        <p>Frontend is deployed separately on Vercel.</p>
      </div>
    </div>
  )
}

'use client';

export default function GlobalError({ error, reset }) {
  return (
    <html lang="en">
      <head>
        <title>Error - DataFlow</title>
      </head>
      <body>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          backgroundColor: '#f9fafb'
        }}>
          <div style={{ textAlign: 'center' }}>
            <h1 style={{ fontSize: '3rem', fontWeight: 'bold' }}>Error</h1>
            <p style={{ fontSize: '1.25rem', marginTop: '1rem' }}>Something went wrong</p>
            <button
              onClick={reset}
              style={{
                marginTop: '1.5rem',
                padding: '0.75rem 1.5rem',
                backgroundColor: '#2563eb',
                color: 'white',
                border: 'none',
                borderRadius: '0.5rem',
                cursor: 'pointer'
              }}
            >
              Try Again
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
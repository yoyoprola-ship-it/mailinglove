import { Component } from 'react'

// Last-resort net: if a render throws (e.g. the DOM was mutated under
// React by an in-browser translator), show a reload prompt instead of a
// blank page.
export default class ErrorBoundary extends Component {
  state = { crashed: false }

  static getDerivedStateFromError() {
    return { crashed: true }
  }

  componentDidCatch(err) {
    console.error('[app] render crashed:', err)
  }

  render() {
    if (!this.state.crashed) return this.props.children
    return (
      <div
        style={{
          padding: '40px 24px',
          textAlign: 'center',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          color: '#4a1626',
        }}
      >
        <p style={{ fontSize: '1rem', marginBottom: 16 }}>
          Something went wrong. Please reload the page.
        </p>
        <button
          onClick={() => window.location.reload()}
          style={{
            padding: '10px 24px',
            borderRadius: 999,
            border: 0,
            background: '#4a1626',
            color: '#fff',
            fontSize: '0.95rem',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Reload
        </button>
      </div>
    )
  }
}

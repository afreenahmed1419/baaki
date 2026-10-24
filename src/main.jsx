import { Component, StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import '@fontsource/archivo/800.css'
import '@fontsource/archivo/900.css'
import '@fontsource/ibm-plex-sans/400.css'
import '@fontsource/ibm-plex-sans/500.css'
import '@fontsource/ibm-plex-sans/600.css'
import '@fontsource/ibm-plex-sans/700.css'
import '@fontsource/ibm-plex-sans-devanagari/400.css'
import '@fontsource/ibm-plex-sans-devanagari/500.css'
import '@fontsource/ibm-plex-sans-devanagari/600.css'
import '@fontsource/ibm-plex-sans-devanagari/700.css'
import '@fontsource/ibm-plex-mono/400.css'
import '@fontsource/ibm-plex-mono/500.css'
import '@fontsource/ibm-plex-mono/600.css'
import '@fontsource/noto-sans-devanagari/800.css'
import './index.css'
import App from './App.jsx'
import { AppProvider } from './store.jsx'

class ErrorBoundary extends Component {
  state = { error: null }
  static getDerivedStateFromError(error) { return { error } }
  render() {
    if (!this.state.error) return this.props.children
    return (
      <div style={{ padding: 24, maxWidth: 560, margin: '40px auto', fontFamily: 'system-ui' }}>
        <h1>Something went wrong / कुछ गड़बड़ हो गई</h1>
        <p>{String(this.state.error.message || this.state.error)}</p>
        <button className="btn" onClick={() => { try { localStorage.removeItem('baaki.v1') } catch { /* ignore */ } window.location.href = '/' }}>
          Reset demo data / डेमो रीसेट करें
        </button>
      </div>
    )
  }
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <AppProvider>
          <App />
        </AppProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>,
)

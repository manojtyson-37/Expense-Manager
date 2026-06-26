import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App'
import { AuthProvider } from './lib/AuthContext'

// autoUpdate applies the new SW + reloads on controllerchange. The interval
// makes an already-open app notice a new deploy within 60s, so users get the
// latest build after a refresh (or sooner) instead of staying on a stale cache.
registerSW({
  immediate: true,
  onRegisteredSW(_url, r) {
    if (r) setInterval(() => r.update(), 60_000)
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </HashRouter>
  </StrictMode>,
)

import React from 'react'
import ReactDOM from 'react-dom/client'
import './design-tokens.css'
import './styles.css'
import './dead-zones.css'
import './listening-rooms.css'
import './anomalies.css'
import './signal-alerts.css'
import './settings.css'
import './signal-inspirations.css'
import './capsules.css'
import './profile-polish.css'
import './signal-rituals.css'
import './find-engine.css'
import './global-architecture.css'
import './stability-pass.css'
import App from './App'
import { AudioProvider } from './audio-system'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AudioProvider>
      <App />
    </AudioProvider>
  </React.StrictMode>,
)

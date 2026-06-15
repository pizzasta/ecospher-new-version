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
import './relics.css'
import './drift-notes.css'
import './polish-pass.css'
import './profile-polish.css'
import './audio-system.css'
import './return-rituals.css'
import './signal-rituals.css'
import './signal-observatory.css'
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

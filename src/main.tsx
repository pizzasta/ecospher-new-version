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
import App from './App'
import IntroGate from './components/IntroGate'
import PageTransitionFlow from './components/PageTransitionFlow'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <IntroGate>
      <PageTransitionFlow />
      <App />
    </IntroGate>
  </React.StrictMode>,
)

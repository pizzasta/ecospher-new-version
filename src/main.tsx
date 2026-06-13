import React from 'react'
import ReactDOM from 'react-dom/client'
import './design-tokens.css'
import './atmosphere.css'
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
import SignalErrorBoundary from './components/SignalErrorBoundary'
import { EcosystemProvider } from './hooks/useEcosystemState'
import { GlobalAudioProvider } from './hooks/useGlobalAudio'
import { RecordingSessionProvider } from './hooks/useRecordingSession'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <SignalErrorBoundary>
      <EcosystemProvider>
        <GlobalAudioProvider>
          <RecordingSessionProvider>
            <IntroGate>
              <PageTransitionFlow />
              <App />
            </IntroGate>
          </RecordingSessionProvider>
        </GlobalAudioProvider>
      </EcosystemProvider>
    </SignalErrorBoundary>
  </React.StrictMode>,
)

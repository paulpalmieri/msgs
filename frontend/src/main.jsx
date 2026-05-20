import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

// Styles - split by feature for maintainability
import './styles/base.css'      // Foundation: reset, typography, animations, Recharts
import './styles/analytics.css' // Homepage: stat tiles, sections, buttons
import './styles/wrapped.css'   // Wrapped feature (dark theme)

import App from './App.jsx'

createRoot(document.getElementById('root')).render(
    <StrictMode>
        <App />
    </StrictMode>,
)

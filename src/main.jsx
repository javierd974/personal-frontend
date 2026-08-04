import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import { biometricoService } from './services/biometricoService'

// Calentar la WebAPI del lector apenas arranca la app. La primera llamada a
// sgibiosrv tarda ~12 s; si la paga el usuario, se come ese tiempo de espera al
// abrir el kiosco o el enrolamiento. Aca corre en segundo plano y no molesta:
// si no hay lector en esta PC, falla en silencio y no cambia nada.
biometricoService.calentar()

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

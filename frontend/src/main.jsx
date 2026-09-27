import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/tokens.css'
import './index.css'
import App from './App.jsx'
import { ProveedorAvisos } from './components/ui'
import VistaDisenoPage from './features/vista-diseno/VistaDisenoPage.jsx'

// Sin router todavía: la vista previa del sistema de diseño se sirve por su ruta directa.
const esVistaDiseno = window.location.pathname === '/design-preview'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ProveedorAvisos>
      {esVistaDiseno ? <VistaDisenoPage /> : <App />}
    </ProveedorAvisos>
  </StrictMode>,
)

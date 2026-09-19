import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { EventFlowProvider } from './hooks/useEventFlowData.tsx'
import { ToastProvider } from './hooks/useToast.tsx'
import { ErrorBoundary } from './components/ErrorBoundary.tsx'
import './styles.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <EventFlowProvider>
        <ToastProvider>
          <ErrorBoundary>
            <App />
          </ErrorBoundary>
        </ToastProvider>
      </EventFlowProvider>
    </BrowserRouter>
  </StrictMode>,
)

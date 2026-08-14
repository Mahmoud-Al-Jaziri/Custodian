import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ErrorBoundary } from '@sentry/react'
import App from './App'
import 'bootstrap/dist/css/bootstrap.min.css'
import './styles/Global.css'
import UserAuthProvider from './context/AuthContext'
import { initErrorReporting } from './sentry'
import ErrorFallback from './components/ErrorFallback'

// Before render, so a crash during the very first paint is still reported.
initErrorReporting()

// The boundary sits OUTSIDE the providers: an error thrown while the auth
// context initialises is exactly the kind that would otherwise be a white
// screen with nothing in the console for the user to report. It works with or
// without a Sentry DSN — unreported is still much better than blank.
createRoot(document.getElementById('root')).render(
  <ErrorBoundary fallback={<ErrorFallback />}>
    <UserAuthProvider>
      <StrictMode>
        <App />
      </StrictMode>
    </UserAuthProvider>
  </ErrorBoundary>
)

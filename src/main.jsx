import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import 'bootstrap/dist/css/bootstrap.min.css'
import './styles/Global.css'
import UserAuthProvider from './context/AuthContext'

createRoot(document.getElementById('root')).render(
  <UserAuthProvider>
    <StrictMode>
      <App />
    </StrictMode>
  </UserAuthProvider>
)

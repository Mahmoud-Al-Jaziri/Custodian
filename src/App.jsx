import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Evening from './pages/Evening'
import Morning from './pages/Morning'
import Dashboard from './pages/Dashboard'
import Login from './pages/Login'
import ProtectedRoute from './components/ProtectedRoute'
import Onboarding from './pages/Onboarding'

function App() {

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to={localStorage.getItem("onboarded") ? "/login" : "/onboarding"} replace />} />
        <Route path="/evening" element={
          <ProtectedRoute> 
            <Evening />
          </ProtectedRoute>
        } />
        <Route path="/morning" element={
          <ProtectedRoute>
            <Morning />
          </ProtectedRoute>
        } />
        <Route path="/dashboard" element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        } />
        <Route path="/login"   element={<Login />} />
        <Route path="/onboarding" element={<Onboarding />} />
      </Routes>
      

    </BrowserRouter>
  )
}

export default App

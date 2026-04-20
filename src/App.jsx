import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Evening from './pages/Evening'
import Morning from './pages/morning'
import Dashboard from './pages/Dashboard'
import Login from './pages/Login'
import ProtectedRoute from './components/ProtectedRoute'

function App() {

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
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
      </Routes>
    </BrowserRouter>
  )
}

export default App

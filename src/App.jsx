import React, { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { supabase } from './services/supabase'
import Login from './pages/Login'
import ResetPassword from './pages/ResetPassword'
import Dashboard from './pages/Dashboard'
import Administracion from './pages/Administracion'
import Kiosco from './pages/Kiosco'
import EnrolarHuellas from './pages/EnrolarHuellas'
import InstalacionesKiosco from './pages/InstalacionesKiosco'
import ControlRegistros from './pages/ControlRegistros'
import LoadingSpinner from './components/common/LoadingSpinner'

// Componente de ruta protegida
const ProtectedRoute = ({ children }) => {
  const [loading, setLoading] = useState(true)
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  useEffect(() => {
    checkAuth()
  }, [])

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    setIsAuthenticated(!!session)
    setLoading(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="xl" />
      </div>
    )
  }

  return isAuthenticated ? children : <Navigate to="/login" replace />
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/kiosco" element={<Kiosco />} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin"
          element={
            <ProtectedRoute>
              <Administracion />
            </ProtectedRoute>
          }
        />
        <Route
          path="/enrolar"
          element={
            <ProtectedRoute>
              <EnrolarHuellas />
            </ProtectedRoute>
          }
        />
        <Route
          path="/instalaciones"
          element={
            <ProtectedRoute>
              <InstalacionesKiosco />
            </ProtectedRoute>
          }
        />
        <Route
          path="/control-registros"
          element={
            <ProtectedRoute>
              <ControlRegistros />
            </ProtectedRoute>
          }
        />
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App

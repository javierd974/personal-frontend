import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { LogIn, Mail, Lock, AlertCircle } from 'lucide-react'
import { authService } from '../services/authService'
import LoadingSpinner from '../components/common/LoadingSpinner'

const Login = () => {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  })

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    })
    setError('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const result = await authService.signIn(formData.email, formData.password)
      
      if (result.success) {
        navigate('/dashboard')
      } else {
        setError(result.error)
      }
    } catch (err) {
      setError('Error al iniciar sesión. Por favor, intente nuevamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary to-primary-dark flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8">
        {/* Logo y título */}
        <div className="text-center mb-8">
          <img 
            src="/smartdom-logo.png" 
            alt="SmartDom Logo" 
            className="w-48 mx-auto mb-4"
          />
          <p className="text-gray-600 text-lg">Sistema de Gestión de Personal</p>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded">
              <div className="flex items-start">
                <AlertCircle className="w-5 h-5 text-red-500 mr-2 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            </div>
          )}

          {/* Email */}
          <div>
            <label className="label">Correo Electrónico</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                className="input-field pl-10"
                placeholder="tu@email.com"
                required
                disabled={loading}
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <label className="label">Contraseña</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                className="input-field pl-10"
                placeholder="••••••••"
                required
                disabled={loading}
              />
            </div>
          </div>

          {/* Botón de login */}
          <button
            type="submit"
            className="btn-primary w-full flex items-center justify-center space-x-2"
            disabled={loading}
          >
            {loading ? (
              <>
                <LoadingSpinner size="sm" />
                <span>Iniciando sesión...</span>
              </>
            ) : (
              <>
                <LogIn className="w-5 h-5" />
                <span>Iniciar Sesión</span>
              </>
            )}
          </button>
        </form>

        {/* Footer */}
        <div className="mt-8 text-center">
          <p className="text-sm text-gray-600">
            Desarrollado por <span className="font-semibold text-primary">SmartDom</span>
          </p>
        </div>
      </div>
    </div>
  )
}

export default Login

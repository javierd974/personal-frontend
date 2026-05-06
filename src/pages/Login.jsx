import React, { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { LogIn, Mail, Lock, AlertCircle, ArrowLeft, CheckCircle } from 'lucide-react'
import { authService } from '../services/authService'
import LoadingSpinner from '../components/common/LoadingSpinner'
import { APP_VERSION } from '../version'

const Login = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const [mode, setMode] = useState('login') // 'login' | 'forgot' | 'forgot-sent'
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState(location.state?.info || '')
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

  const switchMode = (newMode) => {
    setMode(newMode)
    setError('')
    setInfo('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setInfo('')
    setLoading(true)

    try {
      if (mode === 'forgot') {
        const result = await authService.resetPassword(formData.email)
        if (result.success) {
          setMode('forgot-sent')
        } else {
          setError(result.error)
        }
      } else {
        const result = await authService.signIn(formData.email, formData.password)
        if (result.success) {
          navigate('/dashboard')
        } else {
          setError(result.error)
        }
      }
    } catch (err) {
      setError('Error al procesar la solicitud. Por favor, intente nuevamente.')
    } finally {
      setLoading(false)
    }
  }

  const tituloPorModo = {
    login: 'Sistema de Gestión de Personal',
    forgot: 'Recuperar contraseña',
    'forgot-sent': 'Email enviado'
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
          <p className="text-gray-600 text-lg">{tituloPorModo[mode]}</p>
        </div>

        {mode === 'forgot-sent' ? (
          /* Pantalla de confirmación de envío */
          <div className="text-center space-y-4">
            <div className="w-16 h-16 mx-auto rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <p className="text-sm text-gray-700">
              Si <strong>{formData.email}</strong> está registrado, te enviamos un link para restablecer tu contraseña.
            </p>
            <p className="text-xs text-gray-500">
              Revisá tu bandeja de entrada (y la carpeta de spam por las dudas).
            </p>
            <button
              type="button"
              onClick={() => {
                switchMode('login')
                setFormData({ email: '', password: '' })
              }}
              className="btn-primary w-full"
            >
              Volver al login
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Botón "volver" en modo forgot */}
            {mode === 'forgot' && (
              <button
                type="button"
                onClick={() => switchMode('login')}
                className="flex items-center text-sm text-gray-600 hover:text-primary transition-colors"
                disabled={loading}
              >
                <ArrowLeft className="w-4 h-4 mr-1" />
                Volver al login
              </button>
            )}

            {info && (
              <div className="bg-green-50 border-l-4 border-green-500 p-4 rounded">
                <div className="flex items-start">
                  <CheckCircle className="w-5 h-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-green-700">{info}</p>
                </div>
              </div>
            )}

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

            {/* Password — solo en modo login */}
            {mode === 'login' && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="label !mb-0">Contraseña</label>
                  <button
                    type="button"
                    onClick={() => switchMode('forgot')}
                    className="text-xs font-medium text-primary hover:underline"
                    disabled={loading}
                  >
                    ¿Olvidaste tu contraseña?
                  </button>
                </div>
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
            )}

            {mode === 'forgot' && (
              <p className="text-sm text-gray-600">
                Ingresá tu email y te enviaremos un link para restablecer tu contraseña.
              </p>
            )}

            <button
              type="submit"
              className="btn-primary w-full flex items-center justify-center space-x-2"
              disabled={loading}
            >
              {loading ? (
                <>
                  <LoadingSpinner size="sm" />
                  <span>{mode === 'forgot' ? 'Enviando...' : 'Iniciando sesión...'}</span>
                </>
              ) : (
                <>
                  {mode === 'login' && <LogIn className="w-5 h-5" />}
                  <span>{mode === 'forgot' ? 'Enviar link de recuperación' : 'Iniciar Sesión'}</span>
                </>
              )}
            </button>
          </form>
        )}

        {/* Footer */}
        <div className="mt-8 text-center">
          <p className="text-sm text-gray-600">
            Desarrollado por <span className="font-semibold text-primary">SmartDom</span>
          </p>
          <p className="text-xs text-gray-400 mt-1">v{APP_VERSION}</p>
        </div>
      </div>
    </div>
  )
}

export default Login

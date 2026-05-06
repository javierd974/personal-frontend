import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Lock, AlertCircle, CheckCircle } from 'lucide-react'
import { supabase } from '../services/supabase'
import { authService } from '../services/authService'
import LoadingSpinner from '../components/common/LoadingSpinner'
import { APP_VERSION } from '../version'

const ResetPassword = () => {
  const navigate = useNavigate()
  const [checkingSession, setCheckingSession] = useState(true)
  const [validSession, setValidSession] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  useEffect(() => {
    let mounted = true

    // Pequeño delay para que detectSessionInUrl procese el token del hash
    const timer = setTimeout(async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!mounted) return
      setValidSession(!!session)
      setCheckingSession(false)
    }, 400)

    return () => {
      mounted = false
      clearTimeout(timer)
    }
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres')
      return
    }

    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden')
      return
    }

    setLoading(true)

    try {
      const result = await authService.updatePassword(password)

      if (result.success) {
        // Cerrar la sesión de recovery y volver al login con mensaje de éxito
        await supabase.auth.signOut()
        navigate('/login', {
          state: { info: 'Contraseña actualizada. Iniciá sesión con tu nueva contraseña.' }
        })
      } else {
        setError(result.error)
      }
    } catch (err) {
      setError('Error al actualizar la contraseña. Intentá nuevamente.')
    } finally {
      setLoading(false)
    }
  }

  if (checkingSession) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary to-primary-dark flex items-center justify-center">
        <LoadingSpinner size="xl" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary to-primary-dark flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8">
        <div className="text-center mb-8">
          <img
            src="/smartdom-logo.png"
            alt="SmartDom Logo"
            className="w-48 mx-auto mb-4"
          />
          <p className="text-gray-600 text-lg">Restablecer contraseña</p>
        </div>

        {!validSession ? (
          <div className="text-center space-y-4">
            <div className="w-16 h-16 mx-auto rounded-full bg-red-100 flex items-center justify-center">
              <AlertCircle className="w-8 h-8 text-red-600" />
            </div>
            <p className="text-sm text-gray-700">
              Este link ya no es válido. Pudo haber expirado o ya fue utilizado.
            </p>
            <button
              type="button"
              onClick={() => navigate('/login')}
              className="btn-primary w-full"
            >
              Volver al login
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded">
                <div className="flex items-start">
                  <AlertCircle className="w-5 h-5 text-red-500 mr-2 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              </div>
            )}

            <div>
              <label className="label">Nueva contraseña</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input-field pl-10"
                  placeholder="••••••••"
                  required
                  minLength={6}
                  disabled={loading}
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">Mínimo 6 caracteres</p>
            </div>

            <div>
              <label className="label">Confirmar contraseña</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="input-field pl-10"
                  placeholder="••••••••"
                  required
                  minLength={6}
                  disabled={loading}
                />
              </div>
            </div>

            <button
              type="submit"
              className="btn-primary w-full flex items-center justify-center space-x-2"
              disabled={loading}
            >
              {loading ? (
                <>
                  <LoadingSpinner size="sm" />
                  <span>Actualizando...</span>
                </>
              ) : (
                <>
                  <CheckCircle className="w-5 h-5" />
                  <span>Actualizar contraseña</span>
                </>
              )}
            </button>
          </form>
        )}

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

export default ResetPassword

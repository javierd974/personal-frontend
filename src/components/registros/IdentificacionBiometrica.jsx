import React, { useState, useEffect } from 'react'
import { Fingerprint, CheckCircle, XCircle, Loader2, UserCheck } from 'lucide-react'
import { biometricoService } from '../../services/biometricoService'
import { empleadosService } from '../../services/empleadosService'

const IdentificacionBiometrica = ({ onEmpleadoIdentificado, onAlert }) => {
  const [estado, setEstado] = useState('idle')
  const [empleadoIdentificado, setEmpleadoIdentificado] = useState(null)
  const [servicioActivo, setServicioActivo] = useState(null)

  useEffect(() => {
    biometricoService.verificarServicio().then(r => setServicioActivo(r.activo))
  }, [])

  const handleIdentificar = async () => {
    setEstado('esperando')
    setEmpleadoIdentificado(null)

    // 1. Capturar huella
    const capturaResult = await biometricoService.capturarHuella(15000)
    if (!capturaResult.success) {
      setEstado('error')
      onAlert({ type: 'error', message: capturaResult.error })
      setTimeout(() => setEstado('idle'), 3000)
      return
    }

    setEstado('identificando')

    // 2. Traer todos los templates registrados
    const huellasResult = await biometricoService.getHuellasActivas()
    if (!huellasResult.success || huellasResult.data.length === 0) {
      setEstado('noEncontrado')
      onAlert({ type: 'warning', message: 'No hay huellas registradas en el sistema.' })
      setTimeout(() => setEstado('idle'), 3000)
      return
    }


    // 3. Comparar contra todos los templates
    const match = await biometricoService.identificarEmpleado(capturaResult.template, huellasResult.data)
    if (!match.encontrado) {
      setEstado('noEncontrado')
      onAlert({ type: 'warning', message: 'Huella no reconocida. Podés buscar el empleado manualmente.' })
      setTimeout(() => setEstado('idle'), 3000)
      return
    }

    // 4. Traer datos del empleado identificado
    const empResult = await empleadosService.getEmpleadoById(match.empleado_id)
    if (!empResult.success) {
      setEstado('error')
      setTimeout(() => setEstado('idle'), 3000)
      return
    }

    setEstado('ok')
    setEmpleadoIdentificado(empResult.data)
    onEmpleadoIdentificado(empResult.data)
  }

  const resetear = () => {
    setEstado('idle')
    setEmpleadoIdentificado(null)
  }

  // Si confirmamos que no está disponible, no mostrar nada
  // null = cargando todavía → mostramos el botón igual (optimista)
  if (servicioActivo === false) return null

  return (
    <div className="space-y-3">
      <button
        onClick={estado === 'ok' ? resetear : handleIdentificar}
        disabled={estado === 'esperando' || estado === 'identificando'}
        className={`w-full py-5 rounded-xl font-bold text-lg transition-all flex items-center justify-center gap-3 shadow-lg ${
          estado === 'ok' ? 'bg-green-600 hover:bg-green-700 text-white'
          : estado === 'noEncontrado' || estado === 'error' ? 'bg-red-500 hover:bg-red-600 text-white'
          : 'bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-60'
        }`}>
        {(estado === 'esperando' || estado === 'identificando') && <Loader2 className="w-6 h-6 animate-spin" />}
        {estado === 'ok' && <UserCheck className="w-6 h-6" />}
        {estado === 'noEncontrado' && <XCircle className="w-6 h-6" />}
        {estado === 'idle' && <Fingerprint className="w-6 h-6" />}
        <span>
          {estado === 'idle' && 'IDENTIFICAR POR HUELLA'}
          {estado === 'esperando' && 'Apoyá el dedo...'}
          {estado === 'identificando' && 'Identificando...'}
          {estado === 'ok' && `${empleadoIdentificado?.nombre} ${empleadoIdentificado?.apellido}`}
          {estado === 'noEncontrado' && 'No reconocido — usá búsqueda manual'}
          {estado === 'error' && 'Error — intentá de nuevo'}
        </span>
      </button>


      {estado === 'esperando' && (
        <p className="text-center text-sm text-gray-500 animate-pulse">Tiempo límite: 15 segundos</p>
      )}

      {estado === 'ok' && empleadoIdentificado && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center gap-3">
          <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-green-900">
              {empleadoIdentificado.nombre} {empleadoIdentificado.apellido}
            </p>
            <p className="text-xs text-green-700">DNI: {empleadoIdentificado.documento}</p>
          </div>
        </div>
      )}
    </div>
  )
}

export default IdentificacionBiometrica

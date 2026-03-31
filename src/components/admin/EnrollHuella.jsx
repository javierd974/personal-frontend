import React, { useState, useEffect } from 'react'
import { Fingerprint, CheckCircle, XCircle, Loader2, Trash2 } from 'lucide-react'
import { biometricoService } from '../../services/biometricoService'

const DEDOS = [
  { id: 'indice_derecho',   label: 'Índice derecho',   recomendado: true },
  { id: 'pulgar_derecho',   label: 'Pulgar derecho',   recomendado: true },
  { id: 'indice_izquierdo', label: 'Índice izquierdo', recomendado: false },
  { id: 'pulgar_izquierdo', label: 'Pulgar izquierdo', recomendado: false },
  { id: 'medio_derecho',    label: 'Medio derecho',    recomendado: false },
]

const EnrollHuella = ({ empleado, onAlert, onClose }) => {
  const [servicioActivo, setServicioActivo]       = useState(null)
  const [huellasRegistradas, setHuellasRegistradas] = useState([])
  const [dedoSeleccionado, setDedoSeleccionado]   = useState('indice_derecho')
  const [estado, setEstado]                        = useState('idle')
  const [mensajeEstado, setMensajeEstado]          = useState('')
  const [loading, setLoading]                      = useState(false)

  useEffect(() => { verificarServicioYHuellas() }, [empleado.id])

  const verificarServicioYHuellas = async () => {
    const [servicioResult, huellasResult] = await Promise.all([
      biometricoService.verificarServicio(),
      biometricoService.getHuellasEmpleado(empleado.id)
    ])
    setServicioActivo(servicioResult.activo)
    if (huellasResult.success) setHuellasRegistradas(huellasResult.data)
  }


  const handleCapturar = async () => {
    setEstado('capturando')
    setMensajeEstado('Apoyá el dedo en el lector...')
    const resultado = await biometricoService.capturarHuella(15000)
    if (!resultado.success) {
      setEstado('error'); setMensajeEstado(resultado.error)
      setTimeout(() => setEstado('idle'), 3000)
      return
    }
    setEstado('guardando'); setMensajeEstado('Guardando huella...')
    const guardado = await biometricoService.guardarHuella(empleado.id, dedoSeleccionado, resultado.template)
    if (guardado.success) {
      setEstado('ok'); setMensajeEstado('¡Huella registrada correctamente!')
      onAlert({ type: 'success', message: `Huella de ${DEDOS.find(d => d.id === dedoSeleccionado)?.label} registrada` })
      await verificarServicioYHuellas()
      setTimeout(() => setEstado('idle'), 2000)
    } else {
      setEstado('error'); setMensajeEstado('Error al guardar: ' + guardado.error)
    }
  }

  const handleEliminar = async (dedo) => {
    if (!window.confirm(`¿Eliminar la huella de ${DEDOS.find(d => d.id === dedo)?.label}?`)) return
    setLoading(true)
    const result = await biometricoService.eliminarHuella(empleado.id, dedo)
    if (result.success) {
      onAlert({ type: 'success', message: 'Huella eliminada' })
      await verificarServicioYHuellas()
    } else {
      onAlert({ type: 'error', message: result.error })
    }
    setLoading(false)
  }

  const dedosRegistradosIds = huellasRegistradas.map(h => h.dedo)
  const tieneDosDedos = huellasRegistradas.length >= 2


  return (
    <div className="space-y-6">
      {/* Datos del empleado */}
      <div className="bg-primary/5 rounded-lg p-4">
        <p className="font-semibold text-dark text-lg">{empleado.nombre} {empleado.apellido}</p>
        <p className="text-sm text-gray-500">DNI: {empleado.documento}</p>
      </div>

      {/* Alerta si el servicio no está activo */}
      {servicioActivo === null && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 flex items-center gap-3">
          <div className="animate-spin w-4 h-4 border-2 border-primary border-t-transparent rounded-full flex-shrink-0" />
          <p className="text-gray-600 text-sm">Verificando lector biométrico...</p>
        </div>
      )}
      {servicioActivo === false && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800 font-medium text-sm">⚠️ Servicio biométrico no activo en esta PC.</p>
          <p className="text-red-600 text-xs mt-1">
            Abrí <strong>https://localhost:8443/SGIFPCapture</strong> en el navegador y aceptá el certificado.
          </p>
        </div>
      )}

      {/* Huellas ya registradas */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-semibold text-dark">Huellas registradas ({huellasRegistradas.length}/2 recomendadas)</h4>
          {tieneDosDedos && (
            <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full font-medium">✓ Listo</span>
          )}
        </div>
        {huellasRegistradas.length === 0 ? (
          <p className="text-gray-400 text-sm text-center py-4 border border-dashed border-gray-200 rounded-lg">
            Sin huellas registradas
          </p>
        ) : (
          <div className="space-y-2">
            {huellasRegistradas.map(huella => (
              <div key={huella.id} className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center gap-2">
                  <Fingerprint className="w-4 h-4 text-green-600" />
                  <span className="text-sm font-medium text-green-900">
                    {DEDOS.find(d => d.id === huella.dedo)?.label || huella.dedo}
                  </span>
                </div>
                <button onClick={() => handleEliminar(huella.dedo)} disabled={loading}
                  className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>


      {/* Registrar nueva huella */}
      <div className="border-t pt-4">
        <h4 className="font-semibold text-dark mb-3">Registrar nueva huella</h4>
        <div className="grid grid-cols-1 gap-2 mb-4">
          {DEDOS.map(dedo => {
            const yaRegistrado = dedosRegistradosIds.includes(dedo.id)
            return (
              <button key={dedo.id}
                onClick={() => !yaRegistrado && setDedoSeleccionado(dedo.id)}
                disabled={yaRegistrado}
                className={`flex items-center justify-between p-3 rounded-lg border-2 text-left transition-all ${
                  yaRegistrado ? 'border-green-200 bg-green-50 opacity-60 cursor-not-allowed'
                  : dedoSeleccionado === dedo.id ? 'border-primary bg-primary/5'
                  : 'border-gray-200 hover:border-gray-300'
                }`}>
                <div className="flex items-center gap-2">
                  <Fingerprint className={`w-4 h-4 ${yaRegistrado ? 'text-green-500' : dedoSeleccionado === dedo.id ? 'text-primary' : 'text-gray-400'}`} />
                  <span className="text-sm font-medium">{dedo.label}</span>
                  {dedo.recomendado && !yaRegistrado && (
                    <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">Recomendado</span>
                  )}
                </div>
                {yaRegistrado && <CheckCircle className="w-4 h-4 text-green-500" />}
              </button>
            )
          })}
        </div>

        <button onClick={handleCapturar}
          disabled={estado === 'capturando' || estado === 'guardando' || servicioActivo !== true}
          className={`w-full py-4 rounded-xl font-bold text-lg transition-all flex items-center justify-center gap-3 ${
            estado === 'ok' ? 'bg-green-600 text-white'
            : estado === 'error' ? 'bg-red-600 text-white'
            : 'bg-primary hover:bg-primary/90 text-white disabled:opacity-50'
          }`}>
          {(estado === 'capturando' || estado === 'guardando') && <Loader2 className="w-6 h-6 animate-spin" />}
          {estado === 'ok' && <CheckCircle className="w-6 h-6" />}
          {estado === 'error' && <XCircle className="w-6 h-6" />}
          {estado === 'idle' && <Fingerprint className="w-6 h-6" />}
          <span>
            {estado === 'idle' && 'Capturar huella'}
            {estado === 'capturando' && 'Esperando dedo...'}
            {estado === 'guardando' && 'Guardando...'}
            {estado === 'ok' && '¡Registrada!'}
            {estado === 'error' && mensajeEstado}
          </span>
        </button>
        {estado === 'capturando' && (
          <p className="text-center text-sm text-gray-500 mt-2 animate-pulse">Apoyá el dedo con firmeza en el centro del lector</p>
        )}
      </div>

      {!tieneDosDedos && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
          <p className="text-yellow-800 text-xs">Se recomienda registrar al menos 2 dedos como alternativa si uno no es reconocido.</p>
        </div>
      )}
    </div>
  )
}

export default EnrollHuella

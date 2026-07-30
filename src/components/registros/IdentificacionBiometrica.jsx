import React, { useState, useRef } from 'react'
import { Fingerprint, CheckCircle, XCircle, Loader2, LogOut } from 'lucide-react'
import { biometricoService } from '../../services/biometricoService'
import { empleadosService } from '../../services/empleadosService'
import { registrosService } from '../../services/registrosService'

// Botón permanente de marcación por huella para la pantalla del encargado.
// Mismo comportamiento que el kiosco: apoyás el dedo y el sistema decide solo
// entrada (con el rol del empleado) o salida (si ya tiene un turno abierto).
const IdentificacionBiometrica = ({ localId, onRegistrado, onAlert }) => {
  const [estado, setEstado]       = useState('idle') // idle|capturando|identificando|procesando|ok|error
  const [resultado, setResultado] = useState(null)   // { nombre, accion }
  const enCursoRef = useRef(false)                    // evita doble-toque / reentrada

  const volverAIdle = (ms = 3000) => setTimeout(() => { setEstado('idle'); enCursoRef.current = false }, ms)

  const marcarPorHuella = async () => {
    if (enCursoRef.current) return                    // ya hay una marca en curso: ignorar
    if (!localId) { onAlert?.({ type: 'error', message: 'Seleccioná un local primero.' }); return }
    enCursoRef.current = true
    setResultado(null)
    setEstado('capturando')

    // 1. Capturar
    const cap = await biometricoService.capturarHuella(15000)
    if (!cap.success) {
      setEstado('error'); onAlert?.({ type: 'error', message: cap.error }); volverAIdle(2500); return
    }

    // 2. Identificar contra las huellas del local
    setEstado('identificando')
    const huellas = await biometricoService.getHuellasParaIdentificacion(localId)
    if (!huellas.success || huellas.data.length === 0) {
      setEstado('error'); onAlert?.({ type: 'warning', message: 'No hay huellas registradas en este local.' }); volverAIdle(2500); return
    }
    const match = await biometricoService.identificarEmpleado(cap.template, huellas.data)
    if (!match.encontrado) {
      setEstado('error'); onAlert?.({ type: 'warning', message: 'Huella no reconocida. Podés usar la búsqueda manual.' }); volverAIdle(2500); return
    }

    // 3. Datos del empleado
    const empRes = await empleadosService.getEmpleadoById(match.empleado_id)
    if (!empRes.success) {
      setEstado('error'); onAlert?.({ type: 'error', message: 'No se pudo cargar el empleado.' }); volverAIdle(2500); return
    }
    const emp = empRes.data
    const nombre = `${emp.nombre} ${emp.apellido}`

    // 4. ¿Tiene turno abierto? → decide entrada/salida
    setEstado('procesando')
    const chk = await registrosService.puedeRegistrarEntrada(emp.id)
    if (!chk.success) {
      setEstado('error'); onAlert?.({ type: 'error', message: chk.error }); volverAIdle(3000); return
    }

    if (chk.puede) {
      // ── ENTRADA (rol automático) ──
      if (!emp.rol_id) {
        setEstado('error')
        onAlert?.({ type: 'error', message: `${nombre} no tiene un rol asignado. Cargalo en la ficha del empleado.` })
        volverAIdle(3500); return
      }
      const res = await registrosService.registrarEntrada(emp.id, localId, emp.rol_id, '', 'biometrico')
      if (!res.success) {
        setEstado('error'); onAlert?.({ type: 'error', message: res.error }); volverAIdle(3000); return
      }
      setResultado({ nombre, accion: 'entrada' })
      setEstado('ok'); onAlert?.({ type: 'success', message: `Entrada registrada: ${nombre}` })
    } else {
      // ── SALIDA ──
      const res = await registrosService.registrarSalida(chk.registroActivo.id)
      if (!res.success) {
        setEstado('error'); onAlert?.({ type: 'error', message: res.error }); volverAIdle(3000); return
      }
      setResultado({ nombre, accion: 'salida' })
      setEstado('ok'); onAlert?.({ type: 'success', message: `Salida registrada: ${nombre}` })
    }

    if (onRegistrado) await onRegistrado()
    volverAIdle(3500)
  }

  const trabajando = estado === 'capturando' || estado === 'identificando' || estado === 'procesando'
  const esSalida = resultado?.accion === 'salida'

  return (
    <div className="space-y-2">
      <button
        onClick={marcarPorHuella}
        disabled={estado !== 'idle'}
        className={`w-full py-5 rounded-xl font-bold text-lg transition-all flex items-center justify-center gap-3 shadow-lg text-white ${
          estado === 'ok' ? (esSalida ? 'bg-amber-600' : 'bg-green-600')
          : estado === 'error' ? 'bg-red-500'
          : 'bg-indigo-600 hover:bg-indigo-700 disabled:opacity-70'
        }`}>
        {trabajando && <Loader2 className="w-6 h-6 animate-spin" />}
        {estado === 'ok' && (esSalida ? <LogOut className="w-6 h-6" /> : <CheckCircle className="w-6 h-6" />)}
        {estado === 'error' && <XCircle className="w-6 h-6" />}
        {estado === 'idle' && <Fingerprint className="w-6 h-6" />}
        <span>
          {estado === 'idle' && 'IDENTIFICAR POR HUELLA'}
          {estado === 'capturando' && 'Apoyá el dedo...'}
          {estado === 'identificando' && 'Identificando...'}
          {estado === 'procesando' && 'Registrando...'}
          {estado === 'ok' && (esSalida ? `Salida — ${resultado.nombre}` : `Entrada — ${resultado.nombre}`)}
          {estado === 'error' && 'Reintentá'}
        </span>
      </button>

      {estado === 'capturando' && (
        <p className="text-center text-sm text-gray-500 animate-pulse">Apoyá el dedo en el lector (hasta 15s)</p>
      )}
    </div>
  )
}

export default IdentificacionBiometrica

import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Monitor, ArrowLeft, RefreshCw, CheckCircle, AlertTriangle, Loader2, Fingerprint } from 'lucide-react'
import { authService } from '../services/authService'
import { instalacionesService } from '../services/instalacionesService'

const ROLES_AUTORIZADOS = ['admin', 'rrhh']

// Veredicto -> etiqueta legible + color
const VEREDICTOS = {
  OK:            { label: 'Lector OK',           tone: 'ok' },
  SGIBIOSRV_OFF: { label: 'Servicio apagado',    tone: 'warn' },
  WEBAPI_HTTP:   { label: 'WebAPI HTTP (mal)',   tone: 'bad' },
  WEBAPI_CERT:   { label: 'Certificado faltante',tone: 'warn' },
  WEBAPI_OFF:    { label: 'WebAPI apagado',      tone: 'warn' },
  NO_DETECTADO:  { label: 'Lector no detectado', tone: 'bad' },
  SIN_DRIVER:    { label: 'Sin driver',          tone: 'bad' },
  DRIVER_ERROR:  { label: 'Driver con error',    tone: 'bad' },
  REVISAR:       { label: 'Revisar',             tone: 'warn' },
}

const tonos = {
  ok:   'bg-green-100 text-green-800 border-green-200',
  warn: 'bg-amber-100 text-amber-800 border-amber-200',
  bad:  'bg-red-100 text-red-800 border-red-200',
}

export default function InstalacionesKiosco() {
  const navigate = useNavigate()
  const [cargando, setCargando]     = useState(true)
  const [autorizado, setAutorizado] = useState(false)
  const [filas, setFilas]           = useState([])
  const [refrescando, setRefrescando] = useState(false)

  useEffect(() => { init() }, [])

  const init = async () => {
    const userRes = await authService.getCurrentUser()
    if (!userRes.success) { setCargando(false); return }
    const u = userRes.data
    const ok = ROLES_AUTORIZADOS.includes(u.tipo_usuario) || ROLES_AUTORIZADOS.includes(u.rol)
    setAutorizado(ok)
    if (ok) await cargar()
    setCargando(false)
  }

  const cargar = async () => {
    setRefrescando(true)
    const res = await instalacionesService.getInstalaciones()
    if (res.success) setFilas(res.data)
    setRefrescando(false)
  }

  const fmtFecha = (iso) => {
    if (!iso) return '—'
    const d = new Date(iso)
    return d.toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false })
  }

  const totalOk = filas.filter(f => f.veredicto === 'OK').length

  if (cargando) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
  }

  if (!autorizado) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 max-w-md text-center">
          <AlertTriangle className="w-10 h-10 text-red-500 mx-auto mb-3" />
          <p className="font-semibold text-red-800">No tenés permiso para ver este tablero</p>
          <p className="text-red-600 text-sm mt-1">Es solo para administradores y RRHH.</p>
          <button onClick={() => navigate('/dashboard')} className="mt-4 text-sm text-primary font-medium">Volver al inicio</button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto p-4 sm:p-6">
        <button onClick={() => navigate('/dashboard')} className="flex items-center gap-2 text-gray-500 hover:text-dark text-sm mb-4">
          <ArrowLeft className="w-4 h-4" /> Volver
        </button>

        <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 p-2.5 rounded-xl"><Monitor className="w-6 h-6 text-primary" /></div>
            <div>
              <h1 className="text-xl font-bold text-dark">Instalación de kioscos</h1>
              <p className="text-sm text-gray-500">Estado del lector biométrico por máquina</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-gray-600">
              <span className="text-green-600 font-bold">{totalOk}</span> / {filas.length} listas
            </span>
            <button onClick={cargar} disabled={refrescando}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white border border-gray-200 text-sm font-medium hover:border-primary disabled:opacity-60">
              <RefreshCw className={`w-4 h-4 ${refrescando ? 'animate-spin' : ''}`} /> Actualizar
            </button>
          </div>
        </div>

        {filas.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-xl p-10 text-center">
            <Fingerprint className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">Todavía no reportó ninguna máquina.</p>
            <p className="text-gray-400 text-sm mt-1">Cuando corras el instalador en una PC, aparece acá automáticamente.</p>
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    {['Local', 'Máquina', 'Sistema', 'Estado', 'Detalle', 'Actualizado'].map(h => (
                      <th key={h} className="px-4 py-3 text-left font-medium text-gray-500 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filas.map(f => {
                    const v = VEREDICTOS[f.veredicto] || { label: f.veredicto || '—', tone: 'warn' }
                    const nombreLocal = f.local?.nombre || f.local_nombre || '—'
                    return (
                      <tr key={f.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium text-dark whitespace-nowrap">{nombreLocal}</td>
                        <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{f.machine_name}</td>
                        <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                          {(f.os_caption || '').replace('Microsoft ', '')} {f.os_arch}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full border text-xs font-semibold whitespace-nowrap ${tonos[v.tone]}`}>
                            {v.tone === 'ok' ? <CheckCircle className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                            {v.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-500 max-w-xs">{f.detalle}</td>
                        <td className="px-4 py-3 text-gray-400 whitespace-nowrap tabular-nums">{fmtFecha(f.updated_at)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <p className="text-xs text-gray-400 mt-4">
          Cada PC reporta su estado al correr el instalador o el <code>diagnostico.bat</code>. Un mismo equipo se actualiza en su fila (no duplica).
        </p>
      </div>
    </div>
  )
}

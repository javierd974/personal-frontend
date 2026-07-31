import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ShieldAlert, ArrowLeft, RefreshCw, Loader2, Smartphone, Monitor, AlertTriangle } from 'lucide-react'
import { authService } from '../services/authService'
import { registrosService } from '../services/registrosService'

const ROLES_AUTORIZADOS = ['admin', 'rrhh']

const RANGOS = [
  { label: 'Últimos 7 días', dias: 7 },
  { label: 'Últimos 30 días', dias: 30 },
  { label: 'Últimos 90 días', dias: 90 },
]

export default function ControlRegistros() {
  const navigate = useNavigate()
  const [cargando, setCargando]         = useState(true)
  const [autorizado, setAutorizado]     = useState(false)
  const [filas, setFilas]               = useState([])
  const [refrescando, setRefrescando]   = useState(false)
  const [soloSospechosos, setSoloSospechosos] = useState(false)
  const [dias, setDias]                 = useState(30)

  useEffect(() => { init() }, [])
  useEffect(() => { if (autorizado) cargar() }, [dias, soloSospechosos])

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
    const desde = new Date(Date.now() - dias * 86400000).toISOString().split('T')[0]
    const res = await registrosService.getControlRegistros(desde, soloSospechosos)
    if (res.success) setFilas(res.data || [])
    setRefrescando(false)
  }

  const fmt = (iso) => {
    if (!iso) return '—'
    const d = new Date(iso)
    return d.toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false })
  }

  const totalSospechosos = filas.filter(f => f.sospechoso).length

  if (cargando) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
  }

  if (!autorizado) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 max-w-md text-center">
          <AlertTriangle className="w-10 h-10 text-red-500 mx-auto mb-3" />
          <p className="font-semibold text-red-800">No tenés permiso para ver este control</p>
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

        <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 p-2.5 rounded-xl"><ShieldAlert className="w-6 h-6 text-primary" /></div>
            <div>
              <h1 className="text-xl font-bold text-dark">Control de registros manuales</h1>
              <p className="text-sm text-gray-500">Quién cargó cada registro manual, desde qué IP y dispositivo</p>
            </div>
          </div>
          <button onClick={cargar} disabled={refrescando}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white border border-gray-200 text-sm font-medium hover:border-primary disabled:opacity-60">
            <RefreshCw className={`w-4 h-4 ${refrescando ? 'animate-spin' : ''}`} /> Actualizar
          </button>
        </div>

        {/* Resumen + filtros */}
        <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
          <div className="flex items-center gap-2">
            {totalSospechosos > 0 ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-100 text-red-800 border border-red-200 text-sm font-semibold">
                <Smartphone className="w-4 h-4" /> {totalSospechosos} sospechoso{totalSospechosos !== 1 ? 's' : ''} (manual desde celular)
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-50 text-green-700 border border-green-200 text-sm font-medium">
                Sin registros manuales desde celular en el período
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <select value={dias} onChange={e => setDias(Number(e.target.value))}
              className="border border-gray-200 rounded-lg px-2.5 py-2 text-sm bg-white">
              {RANGOS.map(r => <option key={r.dias} value={r.dias}>{r.label}</option>)}
            </select>
            <label className="inline-flex items-center gap-2 text-sm text-gray-700 cursor-pointer select-none">
              <input type="checkbox" checked={soloSospechosos} onChange={e => setSoloSospechosos(e.target.checked)} />
              Solo sospechosos
            </label>
          </div>
        </div>

        {filas.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-xl p-10 text-center text-gray-500">
            No hay registros manuales en el período seleccionado.
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    {['Fecha', 'Empleado', 'Local', 'Cargado por', 'Dispositivo', 'IP'].map(h => (
                      <th key={h} className="px-4 py-3 text-left font-medium text-gray-500 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filas.map(f => (
                    <tr key={f.id} className={f.sospechoso ? 'bg-red-50 hover:bg-red-100/60' : 'hover:bg-gray-50'}>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap tabular-nums">{fmt(f.hora_entrada)}</td>
                      <td className="px-4 py-3 font-medium text-dark whitespace-nowrap">{f.empleado}</td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{f.local || '—'}</td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{f.registrado_por || '—'}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {f.entrada_es_movil ? (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-red-100 text-red-800 border border-red-200 text-xs font-semibold">
                            <Smartphone className="w-3 h-3" /> Celular
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-gray-100 text-gray-600 border border-gray-200 text-xs font-medium">
                            <Monitor className="w-3 h-3" /> {f.entrada_ip ? 'PC' : 'Sin dato'}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap tabular-nums">{f.entrada_ip || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <p className="text-xs text-gray-400 mt-4">
          Solo se listan registros <b>manuales</b> (los biométricos exigen presencia física con el lector). "Celular" =
          el registro se cargó desde un dispositivo móvil, no desde la PC del local. La IP/dispositivo se empezó a
          guardar desde hoy; los registros anteriores no tienen el dato.
        </p>
      </div>
    </div>
  )
}

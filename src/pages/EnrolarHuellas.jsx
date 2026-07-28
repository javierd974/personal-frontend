import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Fingerprint, ArrowLeft, Search, X, Loader2, MapPin, CheckCircle, AlertCircle } from 'lucide-react'
import { authService } from '../services/authService'
import { localesService } from '../services/catalogosService'
import { empleadosService } from '../services/empleadosService'
import { biometricoService } from '../services/biometricoService'
import EnrollHuella from '../components/admin/EnrollHuella'

const ROLES_AUTORIZADOS = ['encargado', 'admin', 'rrhh']

const EnrolarHuellas = () => {
  const navigate = useNavigate()
  const [cargando, setCargando]         = useState(true)
  const [autorizado, setAutorizado]     = useState(false)
  const [locales, setLocales]           = useState([])
  const [localId, setLocalId]           = useState(null)
  const [empleados, setEmpleados]       = useState([])
  const [estado, setEstado]             = useState({}) // empleado_id -> cantidad de dedos
  const [cargandoLista, setCargandoLista] = useState(false)
  const [busqueda, setBusqueda]         = useState('')
  const [seleccionado, setSeleccionado] = useState(null)
  const [alerta, setAlerta]             = useState(null)

  useEffect(() => { init() }, [])
  useEffect(() => { if (localId) cargarLocal(localId) }, [localId])

  const init = async () => {
    const userRes = await authService.getCurrentUser()
    if (!userRes.success) { setCargando(false); return }
    const u = userRes.data
    const ok = ROLES_AUTORIZADOS.includes(u.tipo_usuario) || ROLES_AUTORIZADOS.includes(u.rol)
    setAutorizado(ok)
    if (ok) {
      const locRes = await localesService.getLocalesUsuario()
      if (locRes.success) {
        setLocales(locRes.data)
        if (locRes.data.length > 0) setLocalId(locRes.data[0].id)
      }
    }
    setCargando(false)
  }

  const cargarLocal = async (id) => {
    setCargandoLista(true)
    setBusqueda('')
    const [empRes, estRes] = await Promise.all([
      empleadosService.getEmpleadosDeLocales([id]),
      biometricoService.getEstadoHuellasLocal(id)
    ])
    if (empRes.success) setEmpleados(empRes.data)
    if (estRes.success) {
      const map = {}
      estRes.data.forEach(h => { map[h.empleado_id] = (map[h.empleado_id] || 0) + 1 })
      setEstado(map)
    }
    setCargandoLista(false)
  }

  const refrescarEstado = async () => {
    if (!localId) return
    const estRes = await biometricoService.getEstadoHuellasLocal(localId)
    if (estRes.success) {
      const map = {}
      estRes.data.forEach(h => { map[h.empleado_id] = (map[h.empleado_id] || 0) + 1 })
      setEstado(map)
    }
  }

  const cerrarModal = async () => {
    setSeleccionado(null)
    await refrescarEstado()
  }

  const empleadosFiltrados = empleados.filter(e => {
    if (!busqueda.trim()) return true
    const t = `${e.nombre} ${e.apellido} ${e.documento || ''}`.toLowerCase()
    return t.includes(busqueda.toLowerCase().trim())
  })

  const totalEnrolados = empleados.filter(e => (estado[e.id] || 0) > 0).length

  if (cargando) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!autorizado) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 max-w-md text-center">
          <AlertCircle className="w-10 h-10 text-red-500 mx-auto mb-3" />
          <p className="font-semibold text-red-800">No tenés permiso para enrolar huellas</p>
          <p className="text-red-600 text-sm mt-1">Esta función es para encargados, RRHH y administradores.</p>
          <button onClick={() => navigate('/dashboard')} className="mt-4 text-sm text-primary font-medium">Volver al inicio</button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto p-4 sm:p-6">
        <button onClick={() => navigate('/dashboard')} className="flex items-center gap-2 text-gray-500 hover:text-dark text-sm mb-4">
          <ArrowLeft className="w-4 h-4" /> Volver
        </button>

        <div className="flex items-center gap-3 mb-6">
          <div className="bg-primary/10 p-2.5 rounded-xl"><Fingerprint className="w-6 h-6 text-primary" /></div>
          <div>
            <h1 className="text-xl font-bold text-dark">Enrolar huellas</h1>
            <p className="text-sm text-gray-500">Registrá la huella de los empleados de tu local</p>
          </div>
        </div>

        {alerta && (
          <div className={`mb-4 rounded-lg p-3 text-sm ${alerta.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
            {alerta.message}
          </div>
        )}

        {locales.length === 0 ? (
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6 text-center">
            <MapPin className="w-8 h-8 text-yellow-500 mx-auto mb-2" />
            <p className="font-medium text-yellow-800">No tenés ningún local asignado</p>
            <p className="text-yellow-700 text-sm mt-1">Pedile a RRHH que te asigne tu local para poder enrolar.</p>
          </div>
        ) : (
          <>
            {locales.length > 1 && (
              <div className="mb-4">
                <label className="block text-xs font-medium text-gray-500 mb-1">Local</label>
                <select value={localId || ''} onChange={e => setLocalId(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg p-2.5 text-sm bg-white">
                  {locales.map(l => <option key={l.id} value={l.id}>{l.nombre}</option>)}
                </select>
              </div>
            )}

            <div className="flex items-center justify-between mb-3">
              <p className="text-sm text-gray-500">
                {empleados.length} empleados · <span className="text-green-600 font-medium">{totalEnrolados} con huella</span>
              </p>
            </div>

            <div className="relative mb-4">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input value={busqueda} onChange={e => setBusqueda(e.target.value)}
                placeholder="Buscar por nombre o DNI..."
                className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-lg text-sm" />
            </div>

            {cargandoLista ? (
              <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
            ) : (
              <div className="space-y-2">
                {empleadosFiltrados.map(emp => {
                  const dedos = estado[emp.id] || 0
                  return (
                    <button key={emp.id} onClick={() => setSeleccionado(emp)}
                      className="w-full flex items-center justify-between p-3.5 bg-white border border-gray-200 rounded-xl hover:border-primary hover:shadow-sm transition-all text-left">
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center ${dedos > 0 ? 'bg-green-100' : 'bg-gray-100'}`}>
                          <Fingerprint className={`w-4 h-4 ${dedos > 0 ? 'text-green-600' : 'text-gray-400'}`} />
                        </div>
                        <div>
                          <p className="font-medium text-dark text-sm">{emp.apellido}, {emp.nombre}</p>
                          <p className="text-xs text-gray-400">DNI: {emp.documento || '—'}</p>
                        </div>
                      </div>
                      {dedos > 0 ? (
                        <span className="flex items-center gap-1 text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full font-medium">
                          <CheckCircle className="w-3 h-3" /> {dedos} {dedos === 1 ? 'dedo' : 'dedos'}
                        </span>
                      ) : (
                        <span className="text-xs bg-gray-100 text-gray-500 px-2 py-1 rounded-full">Sin huella</span>
                      )}
                    </button>
                  )
                })}
                {empleadosFiltrados.length === 0 && (
                  <p className="text-center text-gray-400 text-sm py-8">No se encontraron empleados</p>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Modal de enrolamiento */}
      {seleccionado && (
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4" onClick={cerrarModal}>
          <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md max-h-[90vh] overflow-y-auto p-5" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-dark">Enrolar huella</h3>
              <button onClick={cerrarModal} className="p-1.5 text-gray-400 hover:text-dark hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <EnrollHuella empleado={seleccionado} onAlert={setAlerta} onClose={cerrarModal} />
          </div>
        </div>
      )}
    </div>
  )
}

export default EnrolarHuellas

import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  Users, 
  Clock, 
  FileText, 
  LogOut, 
  Store,
  ChevronDown,
  UserPlus,
  UserMinus,
  DollarSign,
  Settings,
  X,
  ClipboardList,
  MapPin,
  History,
  Fingerprint,
  Monitor
} from 'lucide-react'
import { authService } from '../services/authService'
import { localesService } from '../services/catalogosService'
import { registrosService } from '../services/registrosService'
import { valesService, ausenciasService, observacionesTurnoService } from '../services/catalogosService'
import LoadingSpinner from '../components/common/LoadingSpinner'
import Alert from '../components/common/Alert'
import Modal from '../components/common/Modal'
import ComunicadosManager from '../components/common/ComunicadosManager'
import RegistroHorarios from '../components/registros/RegistroHorarios'
import CierreDia from '../components/reportes/CierreDia'
import ReporteEstado from '../components/reportes/ReporteEstado'
import AltaEmpleadoModal from '../components/registros/AltaEmpleadoModal'
import { APP_VERSION } from '../version'

const Dashboard = () => {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [usuario, setUsuario] = useState(null)
  const [locales, setLocales] = useState([])
  const [localActual, setLocalActual] = useState(null)
  const [empleadosEnTurno, setEmpleadosEnTurno] = useState([])
  const [resumen, setResumen] = useState({
    totalVales: 0,
    cantidadVales: 0,
    ausencias: 0
  })
  const [alert, setAlert] = useState(null)
  
  // Estado para las observaciones
  const [observacionesGenerales, setObservacionesGenerales] = useState('')
  
  // Estados para modales
  const [modalPersonal, setModalPersonal] = useState(false)
  const [modalVales, setModalVales] = useState(false)
  const [modalAusencias, setModalAusencias] = useState(false)
  const [modalCierreDia, setModalCierreDia] = useState(false)
  const [modalReporteEstado, setModalReporteEstado] = useState(false)
  const [modalAlta, setModalAlta] = useState(false)
  const [detalleVales, setDetalleVales] = useState([])
  const [detalleAusencias, setDetalleAusencias] = useState([])
  const [historialVales, setHistorialVales] = useState([])
  const [mostrarHistorial, setMostrarHistorial] = useState(false)
  const [loadingHistorial, setLoadingHistorial] = useState(false)

  // Timeout de sesión: máximo 60 minutos en el dashboard
  useEffect(() => {
    const WARNING_MS = 55 * 60 * 1000
    const SESSION_MS  = 60 * 60 * 1000

    const warningTimer = setTimeout(() => {
      setAlert({ type: 'warning', message: 'La sesión expirará en 5 minutos. La pantalla se cerrará automáticamente.' })
    }, WARNING_MS)

    const sessionTimer = setTimeout(async () => {
      await authService.signOut()
      navigate('/login')
    }, SESSION_MS)

    return () => {
      clearTimeout(warningTimer)
      clearTimeout(sessionTimer)
    }
  }, [])

  useEffect(() => {
    cargarDatos()
  }, [])

  useEffect(() => {
    if (localActual) {
      cargarResumenLocal()
      cargarObservaciones()
    }
  }, [localActual])

  const cargarDatos = async () => {
    setLoading(true)
    try {
      const userResult = await authService.getCurrentUser()
      if (!userResult.success) {
        navigate('/login')
        return
      }
      setUsuario(userResult.data)

      const localesResult = await localesService.getLocalesUsuario()
      if (localesResult.success && localesResult.data.length > 0) {
        setLocales(localesResult.data)
        // NO asignar local por defecto — el usuario debe elegir
        setLocalActual(null)
      } else {
        setAlert({ type: 'warning', message: 'No tiene locales asignados. Contacte al administrador.' })
      }
    } catch (error) {
      setAlert({ type: 'error', message: 'Error al cargar datos' })
    } finally {
      setLoading(false)
    }
  }

  const cargarResumenLocal = async () => {
    if (!localActual) return

    try {
      const turnoResult = await registrosService.getEmpleadosEnTurno(localActual.id)
      if (turnoResult.success) {
        setEmpleadosEnTurno(turnoResult.data)
      }

      const valesResult = await valesService.getTotalValesDelDia(localActual.id)
      if (valesResult.success) {
        setResumen(prev => ({
          ...prev,
          totalVales: valesResult.total,
          cantidadVales: valesResult.cantidad
        }))
      }

      const ausenciasResult = await ausenciasService.getAusenciasDelDia(localActual.id)
      if (ausenciasResult.success) {
        setResumen(prev => ({
          ...prev,
          ausencias: ausenciasResult.data.length
        }))
      }
    } catch (error) {
      console.error('Error al cargar resumen:', error)
    }
  }

  const cargarObservaciones = async () => {
    if (!localActual) return
    const result = await observacionesTurnoService.getObservacion(localActual.id)
    if (result.success) {
      setObservacionesGenerales(result.data)
    }
  }

  const handleCierreExitoso = async () => {
    setObservacionesGenerales('')
    await cargarResumenLocal()
    setModalCierreDia(false)
  }

  const handleObservacionesChange = (nuevasObservaciones) => {
    setObservacionesGenerales(nuevasObservaciones)
  }

  const abrirModalPersonal = () => {
    setModalPersonal(true)
  }

  const abrirModalVales = async () => {
    setMostrarHistorial(false)
    setHistorialVales([])
    try {
      const result = await valesService.getValesDelDia(localActual.id)
      if (result.success) {
        setDetalleVales(result.data)
        setModalVales(true)
      }
    } catch (error) {
      console.error('Error al cargar vales:', error)
    }
  }

  const cargarHistorialVales = async () => {
    if (!localActual) return
    setLoadingHistorial(true)
    try {
      const { supabase } = await import('../services/supabase')
      const fechaDesde = new Date()
      fechaDesde.setDate(fechaDesde.getDate() - 40)
      const fechaDesdeStr = fechaDesde.toISOString().split('T')[0]
      const { data, error } = await supabase
        .from('vales_caja')
        .select(`
          id, fecha, importe, concepto, created_at,
          empleado:empleados(nombre, apellido),
          motivo:motivos_vales(motivo)
        `)
        .eq('local_id', localActual.id)
        .gte('fecha', fechaDesdeStr)
        .order('fecha', { ascending: false })
        .order('created_at', { ascending: false })
      if (!error) setHistorialVales(data || [])
    } catch (err) {
      console.error('Error al cargar historial:', err)
    } finally {
      setLoadingHistorial(false)
    }
  }

  const abrirModalAusencias = async () => {
    try {
      const result = await ausenciasService.getAusenciasDelDia(localActual.id)
      if (result.success) {
        setDetalleAusencias(result.data)
        setModalAusencias(true)
      }
    } catch (error) {
      console.error('Error al cargar ausencias:', error)
    }
  }

  const handleCerrarSesion = async () => {
    const result = await authService.signOut()
    if (result.success) {
      navigate('/login')
    }
  }

  // Selección de local desde la pantalla de bienvenida
  const handleSeleccionarLocal = (local) => {
    setLocalActual(local)
  }

  const puedeEnrolar = ['encargado', 'admin', 'rrhh'].includes(usuario?.tipo_usuario) ||
                       ['encargado', 'admin', 'rrhh'].includes(usuario?.rol)
  const puedeVerInstalaciones = ['admin', 'rrhh'].includes(usuario?.tipo_usuario) ||
                                ['admin', 'rrhh'].includes(usuario?.rol)

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="xl" text="Cargando..." />
      </div>
    )
  }

  // ─── PANTALLA DE SELECCIÓN DE LOCAL ─────────────────────────────────────────
  if (!localActual) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary to-primary-dark flex flex-col">
        {/* Header mínimo */}
        <header className="flex items-center justify-between px-6 py-4">
          <div>
            <h1 className="text-white text-xl font-bold">PERSONAL LOS NOTABLES</h1>
            <p className="text-white/70 text-xs">Sistema de Gestión · v{APP_VERSION}</p>
          </div>
          <div className="flex items-center gap-3">
            {puedeEnrolar && (
              <button
                onClick={() => setModalAlta(true)}
                className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                title="Alta de empleado autorizado"
              >
                <UserPlus className="w-5 h-5" />
              </button>
            )}
            {puedeEnrolar && (
              <button
                onClick={() => navigate('/enrolar')}
                className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                title="Enrolar huellas"
              >
                <Fingerprint className="w-5 h-5" />
              </button>
            )}
            {puedeVerInstalaciones && (
              <button
                onClick={() => navigate('/instalaciones')}
                className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                title="Instalación de kioscos"
              >
                <Monitor className="w-5 h-5" />
              </button>
            )}
            {usuario?.rol === 'admin' && (
              <button
                onClick={() => navigate('/admin')}
                className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                title="Administración"
              >
                <Settings className="w-5 h-5" />
              </button>
            )}
            <button
              onClick={handleCerrarSesion}
              className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
              title="Cerrar Sesión"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* Contenido de selección */}
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="w-full max-w-md">
            <div className="bg-white rounded-2xl shadow-2xl p-8">
              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <MapPin className="w-8 h-8 text-primary" />
                </div>
                <h2 className="text-2xl font-bold text-dark">Seleccionar Local</h2>
                <p className="text-gray-500 mt-2 text-sm">
                  Hola, <span className="font-semibold text-dark">{usuario?.nombre}</span>. 
                  Indicá en qué local vas a trabajar hoy.
                </p>
              </div>

              {locales.length === 0 ? (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-center">
                  <p className="text-yellow-800 text-sm">No tenés locales asignados. Contactá al administrador.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {locales.map((local) => (
                    <button
                      key={local.id}
                      onClick={() => handleSeleccionarLocal(local)}
                      className="w-full flex items-center gap-4 p-4 border-2 border-gray-200 rounded-xl hover:border-primary hover:bg-primary/5 transition-all text-left group"
                    >
                      <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:bg-primary/20 transition-colors">
                        <Store className="w-6 h-6 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-dark truncate">{local.nombre}</p>
                        {local.direccion && (
                          <p className="text-sm text-gray-500 truncate">{local.direccion}</p>
                        )}
                      </div>
                      <ChevronDown className="w-5 h-5 text-gray-400 group-hover:text-primary -rotate-90 transition-colors flex-shrink-0" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <AltaEmpleadoModal
          isOpen={modalAlta}
          onClose={() => setModalAlta(false)}
          localId={localActual?.id}
          onAlert={setAlert}
        />

        <footer className="text-center text-white/50 text-xs py-4">
          Desarrollado por SmartDom
        </footer>
      </div>
    )
  }

  // ─── DASHBOARD PRINCIPAL ────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <div>
                <h1 className="text-xl font-bold text-dark">PERSONAL LOS NOTABLES</h1>
                <p className="text-xs text-gray-600">Sistema de Gestión</p>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              {/* Selector de local */}
              {locales.length > 1 && (
                <div className="relative">
                  <select
                    value={localActual?.id || ''}
                    onChange={(e) => {
                      const local = locales.find(l => l.id === e.target.value)
                      setLocalActual(local)
                    }}
                    className="select-field pr-10 appearance-none cursor-pointer"
                  >
                    {locales.map(local => (
                      <option key={local.id} value={local.id}>
                        {local.nombre}
                      </option>
                    ))}
                  </select>
                  <Store className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5 pointer-events-none" />
                </div>
              )}

              {/* Badge del local actual cuando solo hay uno */}
              {locales.length === 1 && (
                <div className="flex items-center gap-2 px-3 py-2 bg-primary/10 rounded-lg">
                  <Store className="w-4 h-4 text-primary" />
                  <span className="text-sm font-medium text-primary">{localActual.nombre}</span>
                </div>
              )}

              {/* Botón para cambiar de local */}
              <button
                onClick={() => setLocalActual(null)}
                className="px-3 py-2 text-sm text-gray-600 hover:text-primary hover:bg-gray-100 rounded-lg transition-colors border border-gray-200"
                title="Cambiar local"
              >
                Cambiar local
              </button>

              <div className="hidden md:block text-right">
                <p className="text-sm font-medium text-dark">
                  {usuario?.nombre} {usuario?.apellido}
                </p>
                <p className="text-xs text-gray-600">{usuario?.email}</p>
                {usuario?.rol === 'admin' && (
                  <span className="text-xs text-primary font-semibold">Administrador</span>
                )}
                <p className="text-[10px] text-gray-400 mt-0.5">v{APP_VERSION}</p>
              </div>

              {puedeEnrolar && (
                <button
                  onClick={() => setModalAlta(true)}
                  className="p-2 text-gray-600 hover:text-primary hover:bg-gray-100 rounded-lg transition-colors"
                  title="Alta de empleado autorizado"
                >
                  <UserPlus className="w-5 h-5" />
                </button>
              )}
              {puedeEnrolar && (
                <button
                  onClick={() => navigate('/enrolar')}
                  className="p-2 text-gray-600 hover:text-primary hover:bg-gray-100 rounded-lg transition-colors"
                  title="Enrolar huellas"
                >
                  <Fingerprint className="w-5 h-5" />
                </button>
              )}
              {puedeVerInstalaciones && (
                <button
                  onClick={() => navigate('/instalaciones')}
                  className="p-2 text-gray-600 hover:text-primary hover:bg-gray-100 rounded-lg transition-colors"
                  title="Instalación de kioscos"
                >
                  <Monitor className="w-5 h-5" />
                </button>
              )}
              {usuario?.rol === 'admin' && (
                <button
                  onClick={() => navigate('/admin')}
                  className="p-2 text-gray-600 hover:text-primary hover:bg-gray-100 rounded-lg transition-colors"
                  title="Administración"
                >
                  <Settings className="w-5 h-5" />
                </button>
              )}

              <button
                onClick={handleCerrarSesion}
                className="p-2 text-gray-600 hover:text-primary hover:bg-gray-100 rounded-lg transition-colors"
                title="Cerrar Sesión"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Alert global */}
      {alert && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-4">
          <Alert
            type={alert.type}
            message={alert.message}
            onClose={() => setAlert(null)}
          />
        </div>
      )}

      {/* Contenido principal */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Tarjetas de resumen */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div 
            className="card hover:shadow-lg transition-all cursor-pointer hover:scale-105"
            onClick={abrirModalPersonal}
            title="Click para ver detalle"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">En Turno</p>
                <p className="text-3xl font-bold text-dark">{empleadosEnTurno.length}</p>
              </div>
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                <Users className="w-6 h-6 text-primary" />
              </div>
            </div>
          </div>

          <div 
            className="card hover:shadow-lg transition-all cursor-pointer hover:scale-105"
            onClick={abrirModalVales}
            title="Click para ver detalle"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Vales del Día</p>
                <p className="text-3xl font-bold text-dark">
                  ${Math.round(resumen.totalVales).toLocaleString('es-AR')}
                </p>
                <p className="text-xs text-gray-500">{resumen.cantidadVales} vales</p>
              </div>
              <div className="w-12 h-12 bg-secondary/10 rounded-lg flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-secondary" />
              </div>
            </div>
          </div>

          <div 
            className="card hover:shadow-lg transition-all cursor-pointer hover:scale-105"
            onClick={abrirModalAusencias}
            title="Click para ver detalle"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Ausencias</p>
                <p className="text-3xl font-bold text-dark">{resumen.ausencias}</p>
              </div>
              <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
                <UserMinus className="w-6 h-6 text-red-500" />
              </div>
            </div>
          </div>

          <div className="card hover:shadow-lg transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Fecha</p>
                <p className="text-lg font-bold text-dark">
                  {new Date().toLocaleDateString('es-AR', { 
                    day: '2-digit', 
                    month: 'short', 
                    year: 'numeric' 
                  })}
                </p>
                <p className="text-xs text-gray-500">
                  {new Date().toLocaleTimeString('es-AR', { 
                    hour: '2-digit', 
                    minute: '2-digit' 
                  })}
                </p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <Clock className="w-6 h-6 text-blue-500" />
              </div>
            </div>
          </div>
        </div>

        {/* Control de Horarios */}
        {localActual && (
          <RegistroHorarios 
            localId={localActual.id}
            onUpdate={cargarResumenLocal}
            onAlert={setAlert}
            observaciones={observacionesGenerales}
            onObservacionesChange={handleObservacionesChange}
          />
        )}

        {/* Botones de Reportes */}
        {localActual && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
            <div className="card">
              <button
                onClick={() => setModalReporteEstado(true)}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-6 rounded-lg transition-colors flex items-center justify-center gap-3 shadow-lg"
              >
                <ClipboardList className="w-6 h-6" />
                <span>REPORTE DE ESTADO</span>
              </button>
              <p className="text-sm text-gray-600 text-center mt-2">
                Genera un reporte del estado actual para cambio de encargado
              </p>
            </div>

            <div className="card bg-red-50 border-2 border-red-300">
              <button
                onClick={() => setModalCierreDia(true)}
                className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-4 px-6 rounded-lg transition-colors flex items-center justify-center gap-3 shadow-lg"
              >
                <FileText className="w-6 h-6" />
                <span>CIERRE DEL DÍA</span>
              </button>
              <p className="text-sm text-red-700 text-center mt-2">
                Cierra el día de trabajo y reinicia los contadores
              </p>
            </div>
          </div>
        )}
      </main>

      {/* Modales */}
      
      {/* Modal Personal en Turno */}
      <Modal
        isOpen={modalPersonal}
        onClose={() => setModalPersonal(false)}
        title="Personal en Turno"
      >
        <div className="space-y-3">
          {empleadosEnTurno.length === 0 ? (
            <p className="text-gray-500 text-center py-4">No hay personal en turno</p>
          ) : (
            empleadosEnTurno.map((emp, index) => {
              const horaEntrada = emp.hora_entrada.includes('T') 
                ? new Date(emp.hora_entrada).toLocaleTimeString('es-AR', { 
                    hour: '2-digit', 
                    minute: '2-digit',
                    hour12: false 
                  })
                : emp.hora_entrada.substring(0, 5)
              
              return (
                <div key={emp.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                      <span className="text-sm font-bold text-primary">{index + 1}</span>
                    </div>
                    <div>
                      <p className="font-medium text-dark">
                        {emp.empleado.nombre} {emp.empleado.apellido}
                      </p>
                      <p className="text-sm text-gray-600">{emp.rol.nombre}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-600">Entrada</p>
                    <p className="font-medium text-primary">{horaEntrada}</p>
                  </div>
                </div>
              )
            })
          )}
          <div className="pt-3 border-t">
            <p className="text-sm text-gray-600 text-center">
              Total en turno: <span className="font-bold text-dark">{empleadosEnTurno.length}</span>
            </p>
          </div>
        </div>
      </Modal>

      {/* Modal Vales del Día */}
      <Modal
        isOpen={modalVales}
        onClose={() => { setModalVales(false); setMostrarHistorial(false); setHistorialVales([]) }}
        title="Vales del Día"
      >
        <div className="space-y-3">
          {detalleVales.length === 0 ? (
            <p className="text-gray-500 text-center py-4">No hay vales registrados hoy</p>
          ) : (
            <>
              {detalleVales.map((vale, index) => (
                <div key={vale.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3 flex-1">
                    <div className="w-8 h-8 bg-secondary/10 rounded-full flex items-center justify-center">
                      <span className="text-sm font-bold text-secondary">{index + 1}</span>
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-dark">
                        {vale.empleado.nombre} {vale.empleado.apellido}
                      </p>
                      <p className="text-sm text-gray-600">{vale.motivo?.motivo || vale.concepto}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-secondary text-lg">
                      ${Math.round(vale.importe).toLocaleString('es-AR')}
                    </p>
                  </div>
                </div>
              ))}
              <div className="pt-3 border-t">
                <div className="flex justify-between items-center">
                  <p className="text-sm text-gray-600">
                    Total de vales: <span className="font-bold text-dark">{detalleVales.length}</span>
                  </p>
                  <p className="text-lg font-bold text-secondary">
                    ${Math.round(resumen.totalVales).toLocaleString('es-AR')}
                  </p>
                </div>
              </div>
            </>
          )}

          {/* Botón historial */}
          <div className="pt-2 border-t border-gray-100">
            <button
              onClick={async () => {
                if (!mostrarHistorial) {
                  setMostrarHistorial(true)
                  await cargarHistorialVales()
                } else {
                  setMostrarHistorial(false)
                }
              }}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 text-sm font-medium text-gray-600 hover:text-primary hover:bg-primary/5 rounded-lg transition-colors border border-gray-200"
            >
              <History className="w-4 h-4" />
              {mostrarHistorial ? 'Ocultar historial' : 'Ver historial últimos 40 días'}
            </button>
          </div>

          {/* Historial expandible */}
          {mostrarHistorial && (
            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-dark flex items-center gap-2">
                <History className="w-4 h-4 text-primary" />
                Historial últimos 40 días
              </h4>

              {loadingHistorial ? (
                <div className="flex justify-center py-6">
                  <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
                </div>
              ) : historialVales.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-4">Sin vales en los últimos 40 días</p>
              ) : (
                <>
                  {/* Resumen total historial */}
                  <div className="flex justify-between items-center bg-secondary/5 rounded-lg px-4 py-2 mb-1">
                    <span className="text-xs text-gray-500">{historialVales.length} vales en 40 días</span>
                    <span className="text-sm font-bold text-secondary">
                      ${historialVales.reduce((s, v) => s + Math.round(parseFloat(v.importe)), 0).toLocaleString('es-AR')}
                    </span>
                  </div>

                  {/* Lista agrupada por fecha */}
                  {(() => {
                    // Agrupar por fecha
                    const porFecha = historialVales.reduce((acc, vale) => {
                      const f = vale.fecha
                      if (!acc[f]) acc[f] = []
                      acc[f].push(vale)
                      return acc
                    }, {})

                    return Object.entries(porFecha).map(([fecha, valesDelDia]) => {
                      const totalDia = valesDelDia.reduce((s, v) => s + Math.round(parseFloat(v.importe)), 0)
                      const fechaFormateada = new Date(fecha + 'T12:00:00').toLocaleDateString('es-AR', {
                        weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric'
                      })
                      return (
                        <div key={fecha} className="border border-gray-100 rounded-lg overflow-hidden">
                          {/* Header de fecha */}
                          <div className="flex justify-between items-center px-3 py-2 bg-gray-50 border-b border-gray-100">
                            <span className="text-xs font-semibold text-gray-600 capitalize">{fechaFormateada}</span>
                            <span className="text-xs font-bold text-secondary">
                              ${totalDia.toLocaleString('es-AR')}
                            </span>
                          </div>
                          {/* Vales del día */}
                          {valesDelDia.map((vale) => (
                            <div key={vale.id} className="flex items-center justify-between px-3 py-2 hover:bg-gray-50 border-b border-gray-50 last:border-0">
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-dark truncate">
                                  {vale.empleado.nombre} {vale.empleado.apellido}
                                </p>
                                <p className="text-xs text-gray-400 truncate">
                                  {vale.motivo?.motivo || vale.concepto || '—'}
                                </p>
                              </div>
                              <span className="text-sm font-bold text-secondary ml-3 flex-shrink-0">
                                ${Math.round(parseFloat(vale.importe)).toLocaleString('es-AR')}
                              </span>
                            </div>
                          ))}
                        </div>
                      )
                    })
                  })()}
                </>
              )}
            </div>
          )}
        </div>
      </Modal>

      {/* Modal Ausencias */}
      <Modal
        isOpen={modalAusencias}
        onClose={() => setModalAusencias(false)}
        title="Ausencias del Día"
      >
        <div className="space-y-3">
          {detalleAusencias.length === 0 ? (
            <p className="text-gray-500 text-center py-4">No hay ausencias registradas hoy</p>
          ) : (
            <>
              {detalleAusencias.map((ausencia, index) => (
                <div key={ausencia.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3 flex-1">
                    <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
                      <span className="text-sm font-bold text-red-600">{index + 1}</span>
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-dark">
                        {ausencia.empleado.nombre} {ausencia.empleado.apellido}
                      </p>
                      <p className="text-sm text-gray-600">{ausencia.motivo.motivo}</p>
                      {ausencia.observaciones && (
                        <p className="text-xs text-gray-500 mt-1">{ausencia.observaciones}</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              <div className="pt-3 border-t">
                <p className="text-sm text-gray-600 text-center">
                  Total de ausencias: <span className="font-bold text-dark">{detalleAusencias.length}</span>
                </p>
              </div>
            </>
          )}
        </div>
      </Modal>

      {/* Modal Reporte de Estado */}
      {modalReporteEstado && localActual && (
        <Modal
          isOpen={true}
          onClose={() => setModalReporteEstado(false)}
          title="Reporte de Estado"
          size="lg"
        >
          <ReporteEstado
            localId={localActual.id}
            localNombre={localActual.nombre}
            onAlert={setAlert}
            observacionesInicial={observacionesGenerales}
          />
        </Modal>
      )}

      {/* Modal Cierre del Día */}
      {modalCierreDia && localActual && (
        <Modal
          isOpen={true}
          onClose={() => setModalCierreDia(false)}
          title="Cierre del Día"
          size="lg"
        >
          <CierreDia 
            localId={localActual.id}
            localNombre={localActual.nombre}
            onAlert={setAlert}
            onCierreExitoso={handleCierreExitoso}
            observacionesIniciales={observacionesGenerales}
          />
        </Modal>
      )}

      {/* Alta de empleado autorizado (DNI pre-aprobado por administración) */}
      <AltaEmpleadoModal
        isOpen={modalAlta}
        onClose={() => setModalAlta(false)}
        localId={localActual?.id}
        onAlert={setAlert}
        onSuccess={cargarResumenLocal}
      />

      {/* Comunicados RRHH -> Local (pop-up + acuse de recibo, realtime) */}
      {localActual && usuario && (
        <ComunicadosManager localId={localActual.id} usuario={usuario} />
      )}

      <footer className="smartdom-footer">
        <p>Desarrollado por SmartDom</p>
      </footer>
    </div>
  )
}

export default Dashboard

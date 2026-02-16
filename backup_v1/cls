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
  X
} from 'lucide-react'
import { authService } from '../services/authService'
import { localesService } from '../services/catalogosService'
import { registrosService } from '../services/registrosService'
import { valesService, ausenciasService } from '../services/catalogosService'
import LoadingSpinner from '../components/common/LoadingSpinner'
import Alert from '../components/common/Alert'
import Modal from '../components/common/Modal'
import RegistroHorarios from '../components/registros/RegistroHorarios'
import CierreTurno from '../components/reportes/CierreTurno'

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
  const [vistaActual, setVistaActual] = useState('registros') // 'registros' | 'cierre'
  
  // Estados para modales
  const [modalPersonal, setModalPersonal] = useState(false)
  const [modalVales, setModalVales] = useState(false)
  const [modalAusencias, setModalAusencias] = useState(false)
  const [detalleVales, setDetalleVales] = useState([])
  const [detalleAusencias, setDetalleAusencias] = useState([])

  useEffect(() => {
    cargarDatos()
  }, [])

  useEffect(() => {
    if (localActual) {
      cargarResumenLocal()
    }
  }, [localActual])

  const cargarDatos = async () => {
    setLoading(true)
    try {
      // Obtener usuario actual
      const userResult = await authService.getCurrentUser()
      if (!userResult.success) {
        navigate('/login')
        return
      }
      setUsuario(userResult.data)

      // Obtener locales del usuario
      const localesResult = await localesService.getLocalesUsuario()
      if (localesResult.success && localesResult.data.length > 0) {
        setLocales(localesResult.data)
        setLocalActual(localesResult.data[0])
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
      // Empleados en turno
      const turnoResult = await registrosService.getEmpleadosEnTurno(localActual.id)
      if (turnoResult.success) {
        setEmpleadosEnTurno(turnoResult.data)
      }

      // Total de vales
      const valesResult = await valesService.getTotalValesDelDia(localActual.id)
      if (valesResult.success) {
        setResumen(prev => ({
          ...prev,
          totalVales: valesResult.total,
          cantidadVales: valesResult.cantidad
        }))
      }

      // Ausencias
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

  // Función para limpiar dashboard después de cerrar turno
  const handleCierreExitoso = async () => {
    // Recargar resumen para actualizar datos
    await cargarResumenLocal()
    // Cerrar modal de cierre
    setVistaActual('registros')
  }

  // Funciones para abrir modales con detalle
  const abrirModalPersonal = () => {
    setModalPersonal(true)
  }

  const abrirModalVales = async () => {
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="xl" text="Cargando..." />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Título del sistema */}
            <div className="flex items-center space-x-4">
              <div>
                <h1 className="text-xl font-bold text-dark">PERSONAL LOS NOTABLES</h1>
                <p className="text-xs text-gray-600">Sistema de Gestión</p>
              </div>
            </div>

            {/* Usuario y selector de local */}
            <div className="flex items-center space-x-4">
              {/* Selector de local */}
              {locales.length > 0 && (
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

              {/* Información del usuario */}
              <div className="hidden md:block text-right">
                <p className="text-sm font-medium text-dark">
                  {usuario?.nombre} {usuario?.apellido}
                </p>
                <p className="text-xs text-gray-600">{usuario?.email}</p>
                {usuario?.rol === 'administrador' && (
                  <span className="text-xs text-primary font-semibold">Administrador</span>
                )}
              </div>

              {/* Botón de administración - Solo visible para administradores */}
              {usuario?.rol === 'administrador' && (
                <button
                  onClick={() => navigate('/admin')}
                  className="p-2 text-gray-600 hover:text-primary hover:bg-gray-100 rounded-lg transition-colors"
                  title="Administración"
                >
                  <Settings className="w-5 h-5" />
                </button>
              )}

              {/* Botón cerrar sesión */}
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
          {/* Empleados en turno - CLICKEABLE */}
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

          {/* Total de vales - CLICKEABLE */}
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

          {/* Ausencias - CLICKEABLE */}
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

          {/* Fecha actual */}
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

        {/* Vista única - Control de Horarios */}
        {localActual && (
          <RegistroHorarios 
            localId={localActual.id}
            onUpdate={cargarResumenLocal}
            onAlert={setAlert}
          />
        )}

        {/* Botón rojo prominente de Cierre de Turno */}
        {localActual && vistaActual === 'registros' && (
          <div className="card bg-red-50 border-2 border-red-300 mt-6">
            <button
              onClick={() => setVistaActual('cierre')}
              className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-6 px-6 rounded-lg transition-colors flex items-center justify-center gap-3 shadow-lg text-xl"
            >
              <FileText className="w-8 h-8" />
              <span>CIERRE DE TURNO</span>
            </button>
            <p className="text-sm text-red-700 text-center mt-3">
              Presiona aquí para generar el reporte y cerrar el turno actual
            </p>
          </div>
        )}

        {/* Modal de Cierre de Turno */}
        {vistaActual === 'cierre' && localActual && (
          <Modal
            isOpen={true}
            onClose={() => setVistaActual('registros')}
            title="Cierre de Turno"
          >
            <CierreTurno 
              localId={localActual.id}
              localNombre={localActual.nombre}
              onAlert={setAlert}
              onCierreExitoso={handleCierreExitoso}
            />
          </Modal>
        )}
      </main>

      {/* Modales de detalle */}
      
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
            empleadosEnTurno.map((emp, index) => (
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
                  <p className="font-medium text-primary">{emp.hora_entrada}</p>
                </div>
              </div>
            ))
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
        onClose={() => setModalVales(false)}
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
                      ${Math.round(parseFloat(vale.importe)).toLocaleString('es-AR')}
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

      {/* Footer */}
      <footer className="smartdom-footer">
        <p>Desarrollado por SmartDom</p>
      </footer>
    </div>
  )
}

export default Dashboard

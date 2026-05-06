import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  Users, 
  Store, 
  Plus, 
  Trash2, 
  Edit, 
  UserPlus,
  Building2,
  X,
  ArrowLeft,
  Home,
  Fingerprint
} from 'lucide-react'
import { adminService } from '../services/adminService'
import LoadingSpinner from '../components/common/LoadingSpinner'
import Alert from '../components/common/Alert'
import Modal from '../components/common/Modal'
import GestionUsuarios from '../components/admin/GestionUsuarios'
import EnrollHuella from '../components/admin/EnrollHuella'
import { empleadosService } from '../services/empleadosService'
import { biometricoService } from '../services/biometricoService'

// ── Subcomponente: lista de empleados con estado de huellas ───────────────────
const HuellasEmpleados = ({ onAlert }) => {
  const [empleados, setEmpleados] = useState([])
  const [huellasPorEmpleado, setHuellasPorEmpleado] = useState({})
  const [loading, setLoading] = useState(true)
  const [modalEnroll, setModalEnroll] = useState(false)
  const [empleadoSeleccionado, setEmpleadoSeleccionado] = useState(null)
  const [busqueda, setBusqueda] = useState('')

  useEffect(() => { cargarDatos() }, [])

  const cargarDatos = async () => {
    setLoading(true)
    const empResult = await empleadosService.getEmpleadosPorLocal(null)
    if (empResult.success) {
      setEmpleados(empResult.data)
      // Cargar estado de huellas de todos los empleados
      const huellasResult = await biometricoService.getHuellasActivas()
      if (huellasResult.success) {
        const mapa = {}
        huellasResult.data.forEach(h => {
          if (!mapa[h.empleado_id]) mapa[h.empleado_id] = 0
          mapa[h.empleado_id]++
        })
        setHuellasPorEmpleado(mapa)
      }
    }
    setLoading(false)
  }

  const abrirEnroll = (empleado) => {
    setEmpleadoSeleccionado(empleado)
    setModalEnroll(true)
  }

  const cerrarEnroll = () => {
    setModalEnroll(false)
    setEmpleadoSeleccionado(null)
    cargarDatos() // recargar para actualizar los contadores
  }

  const empleadosFiltrados = empleados.filter(e =>
    `${e.nombre} ${e.apellido} ${e.documento}`.toLowerCase().includes(busqueda.toLowerCase())
  )

  if (loading) return <div className="flex justify-center py-12"><div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" /></div>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-dark">Huellas Dactilares</h2>
          <p className="text-gray-600 mt-1">Registrá las huellas de cada empleado para identificación biométrica</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-sm text-gray-500">
            {Object.keys(huellasPorEmpleado).length} de {empleados.length} empleados registrados
          </div>
        </div>
      </div>

      {/* Buscador */}
      <input
        type="text" value={busqueda}
        onChange={e => setBusqueda(e.target.value)}
        className="input-field" placeholder="Buscar empleado por nombre o DNI..."
      />

      {/* Lista de empleados */}
      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Empleado</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">DNI</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Huellas</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Acción</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {empleadosFiltrados.map(emp => {
              const cantHuellas = huellasPorEmpleado[emp.id] || 0
              return (
                <tr key={emp.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-medium text-dark">{emp.nombre} {emp.apellido}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{emp.documento}</td>
                  <td className="px-6 py-4">
                    {cantHuellas === 0 && (
                      <span className="px-2 py-1 text-xs rounded-full bg-red-100 text-red-700 font-medium">Sin registrar</span>
                    )}
                    {cantHuellas === 1 && (
                      <span className="px-2 py-1 text-xs rounded-full bg-yellow-100 text-yellow-700 font-medium">1 dedo</span>
                    )}
                    {cantHuellas >= 2 && (
                      <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-700 font-medium">✓ {cantHuellas} dedos</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button onClick={() => abrirEnroll(emp)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-primary border border-primary rounded-lg hover:bg-primary hover:text-white transition-colors">
                      <Fingerprint className="w-4 h-4" />
                      {cantHuellas === 0 ? 'Registrar' : 'Gestionar'}
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Modal enrollment inline */}
      {modalEnroll && empleadoSeleccionado && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4"
          onClick={cerrarEnroll}>
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-hidden"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-dark">Registrar Huellas</h2>
              <button onClick={cerrarEnroll} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-80px)]">
              <EnrollHuella empleado={empleadoSeleccionado} onAlert={onAlert} onClose={cerrarEnroll} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const Administracion = () => {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [usuarios, setUsuarios] = useState([])
  const [locales, setLocales] = useState([])
  const [alert, setAlert] = useState(null)
  const [vistaActual, setVistaActual] = useState('gestion-usuarios')
  const [usuarioActual, setUsuarioActual] = useState(null)
  
  // Modales
  const [modalAsignar, setModalAsignar] = useState(false)
  const [modalLocal, setModalLocal] = useState(false)
  const [modalEnroll, setModalEnroll] = useState(false)
  const [empleadoEnroll, setEmpleadoEnroll] = useState(null)
  const [usuarioSeleccionado, setUsuarioSeleccionado] = useState(null)
  
  // Formularios
  const [formAsignacion, setFormAsignacion] = useState({
    localId: ''
  })
  
  const [formLocal, setFormLocal] = useState({
    nombre: '',
    direccion: '',
    telefono: ''
  })

  useEffect(() => {
    verificarAcceso()
  }, [])

  const verificarAcceso = async () => {
    // Verificar que el usuario sea administrador
    const { authService } = await import('../services/authService')
    const userResult = await authService.getCurrentUser()
    
    if (!userResult.success || userResult.data.rol !== 'admin') {
      setAlert({ 
        type: 'error', 
        message: 'No tienes permisos para acceder a esta página' 
      })
      setTimeout(() => navigate('/dashboard'), 2000)
      return
    }
    
    setUsuarioActual(userResult.data)
    cargarDatos()
  }

  const cargarDatos = async () => {
    setLoading(true)
    try {
      const [usuariosResult, localesResult] = await Promise.all([
        adminService.getAllUsuarios(),
        adminService.getAllLocales()
      ])

      if (usuariosResult.success) {
        setUsuarios(usuariosResult.data)
      }

      if (localesResult.success) {
        setLocales(localesResult.data)
      }
    } catch (error) {
      setAlert({ type: 'error', message: 'Error al cargar datos' })
    } finally {
      setLoading(false)
    }
  }

  const handleAsignarLocal = async (e) => {
    e.preventDefault()
    setLoading(true)

    try {
      const result = await adminService.asignarUsuarioALocal(
        usuarioSeleccionado.id,
        formAsignacion.localId
      )

      if (result.success) {
        setAlert({ type: 'success', message: result.message })
        setModalAsignar(false)
        setFormAsignacion({ localId: '' })
        await cargarDatos()
      } else {
        setAlert({ type: 'error', message: result.error })
      }
    } catch (error) {
      setAlert({ type: 'error', message: 'Error al asignar local' })
    } finally {
      setLoading(false)
    }
  }

  const handleDesasignarLocal = async (usuarioLocalId, usuarioNombre, localNombre) => {
    if (!window.confirm(`¿Desasignar a ${usuarioNombre} del local ${localNombre}?`)) {
      return
    }

    setLoading(true)
    try {
      const result = await adminService.desasignarUsuarioDeLocal(usuarioLocalId)

      if (result.success) {
        setAlert({ type: 'success', message: result.message })
        await cargarDatos()
      } else {
        setAlert({ type: 'error', message: result.error })
      }
    } catch (error) {
      setAlert({ type: 'error', message: 'Error al desasignar local' })
    } finally {
      setLoading(false)
    }
  }

  const handleCrearLocal = async (e) => {
    e.preventDefault()
    setLoading(true)

    try {
      const result = await adminService.crearLocal(formLocal)

      if (result.success) {
        setAlert({ type: 'success', message: 'Local creado correctamente' })
        setModalLocal(false)
        setFormLocal({ nombre: '', direccion: '', telefono: '' })
        await cargarDatos()
      } else {
        setAlert({ type: 'error', message: result.error })
      }
    } catch (error) {
      setAlert({ type: 'error', message: 'Error al crear local' })
    } finally {
      setLoading(false)
    }
  }

  const abrirModalAsignar = (usuario) => {
    setUsuarioSeleccionado(usuario)
    setModalAsignar(true)
  }

  if (loading && usuarios.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="xl" text="Cargando..." />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header con navegación */}
      <div className="max-w-7xl mx-auto mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => navigate('/dashboard')}
              className="p-2 text-gray-600 hover:text-primary hover:bg-white rounded-lg transition-colors shadow-sm"
              title="Volver al Dashboard"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
            <div>
              <h1 className="text-3xl font-bold text-dark">Administración</h1>
              <p className="text-gray-600">Gestión de usuarios y locales</p>
            </div>
          </div>
          <button
            onClick={() => navigate('/dashboard')}
            className="btn-outline flex items-center space-x-2"
          >
            <Home className="w-5 h-5" />
            <span>Ir al Dashboard</span>
          </button>
        </div>
      </div>

      {/* Alert */}
      {alert && (
        <div className="max-w-7xl mx-auto mb-6">
          <Alert
            type={alert.type}
            message={alert.message}
            onClose={() => setAlert(null)}
          />
        </div>
      )}

      {/* Navegación */}
      <div className="max-w-7xl mx-auto mb-6">
        <div className="bg-white rounded-xl shadow-md">
          <div className="flex border-b border-gray-200">
            <button
              onClick={() => setVistaActual('gestion-usuarios')}
              className={`flex-1 px-6 py-4 font-medium transition-colors ${
                vistaActual === 'gestion-usuarios'
                  ? 'text-primary border-b-2 border-primary'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <div className="flex items-center justify-center space-x-2">
                <UserPlus className="w-5 h-5" />
                <span>Gestión de Usuarios</span>
              </div>
            </button>
            <button
              onClick={() => setVistaActual('usuarios')}
              className={`flex-1 px-6 py-4 font-medium transition-colors ${
                vistaActual === 'usuarios'
                  ? 'text-primary border-b-2 border-primary'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <div className="flex items-center justify-center space-x-2">
                <Users className="w-5 h-5" />
                <span>Asignaciones</span>
              </div>
            </button>
            <button
              onClick={() => setVistaActual('locales')}
              className={`flex-1 px-6 py-4 font-medium transition-colors ${
                vistaActual === 'locales'
                  ? 'text-primary border-b-2 border-primary'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <div className="flex items-center justify-center space-x-2">
                <Store className="w-5 h-5" />
                <span>Locales</span>
              </div>
            </button>
            <button
              onClick={() => setVistaActual('huellas')}
              className={`flex-1 px-6 py-4 font-medium transition-colors ${
                vistaActual === 'huellas'
                  ? 'text-primary border-b-2 border-primary'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <div className="flex items-center justify-center space-x-2">
                <Fingerprint className="w-5 h-5" />
                <span>Huellas</span>
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* Contenido */}
      <div className="max-w-7xl mx-auto">
        {/* Nueva vista: Gestión de Usuarios */}
        {vistaActual === 'gestion-usuarios' && (
          <div className="bg-white rounded-xl shadow-md p-6">
            <GestionUsuarios onAlert={setAlert} />
          </div>
        )}

        {vistaActual === 'usuarios' && (
          <div className="space-y-6">
            {/* Lista de usuarios */}
            <div className="grid grid-cols-1 gap-6">
              {usuarios.map(usuario => (
                <div key={usuario.id} className="card">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h3 className="text-xl font-bold text-dark">
                        {usuario.nombre} {usuario.apellido}
                      </h3>
                      <p className="text-gray-600">{usuario.email}</p>
                      {usuario.telefono && (
                        <p className="text-sm text-gray-500">Tel: {usuario.telefono}</p>
                      )}
                    </div>
                    <button
                      onClick={() => abrirModalAsignar(usuario)}
                      className="btn-primary flex items-center space-x-2"
                    >
                      <UserPlus className="w-4 h-4" />
                      <span>Asignar Local</span>
                    </button>
                  </div>

                  {/* Locales asignados */}
                  <div>
                    <h4 className="font-semibold text-dark mb-3">
                      Locales Asignados ({usuario.usuarios_locales?.length || 0})
                    </h4>
                    {usuario.usuarios_locales && usuario.usuarios_locales.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {usuario.usuarios_locales.map(asignacion => (
                          <div
                            key={asignacion.local.id}
                            className="bg-primary/5 rounded-lg p-3 flex items-center justify-between"
                          >
                            <div className="flex items-center space-x-2">
                              <Building2 className="w-4 h-4 text-primary" />
                              <span className="font-medium text-dark">
                                {asignacion.local.nombre}
                              </span>
                            </div>
                            <button
                              onClick={() => handleDesasignarLocal(
                                asignacion.id,
                                `${usuario.nombre} ${usuario.apellido}`,
                                asignacion.local.nombre
                              )}
                              className="text-red-500 hover:text-red-700 transition-colors"
                              title="Desasignar"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-gray-500 text-sm">
                        No tiene locales asignados
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {vistaActual === 'locales' && (
          <div className="space-y-6">
            {/* Botón crear local */}
            <div className="flex justify-end">
              <button
                onClick={() => setModalLocal(true)}
                className="btn-primary flex items-center space-x-2"
              >
                <Plus className="w-5 h-5" />
                <span>Crear Local</span>
              </button>
            </div>

            {/* Lista de locales */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {locales.map(local => (
                <div key={local.id} className="card hover:shadow-lg transition-shadow">
                  <div className="flex items-center space-x-3 mb-3">
                    <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                      <Store className="w-6 h-6 text-primary" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-bold text-dark">{local.nombre}</h3>
                    </div>
                  </div>
                  
                  {local.direccion && (
                    <p className="text-sm text-gray-600 mb-2">
                      📍 {local.direccion}
                    </p>
                  )}
                  
                  {local.telefono && (
                    <p className="text-sm text-gray-600">
                      📞 {local.telefono}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Vista Huellas ─────────────────────────────────────────────── */}
        {vistaActual === 'huellas' && (
          <HuellasEmpleados onAlert={setAlert} />
        )}
      </div>

      {/* Modal Enrollment Huella */}
      <Modal
        isOpen={modalEnroll}
        onClose={() => { setModalEnroll(false); setEmpleadoEnroll(null) }}
        title="Registrar Huellas Dactilares"
      >
        {empleadoEnroll && (
          <EnrollHuella
            empleado={empleadoEnroll}
            onAlert={setAlert}
            onClose={() => { setModalEnroll(false); setEmpleadoEnroll(null) }}
          />
        )}
      </Modal>

      {/* Modal Asignar Local */}
      <Modal
        isOpen={modalAsignar}
        onClose={() => setModalAsignar(false)}
        title={`Asignar Local a ${usuarioSeleccionado?.nombre} ${usuarioSeleccionado?.apellido}`}
      >
        <form onSubmit={handleAsignarLocal} className="space-y-4">
          <div>
            <label className="label">Seleccionar Local *</label>
            <select
              value={formAsignacion.localId}
              onChange={(e) => setFormAsignacion({ localId: e.target.value })}
              className="select-field"
              required
            >
              <option value="">Seleccione un local...</option>
              {locales
                .filter(local => {
                  // Filtrar locales ya asignados
                  const yaAsignado = usuarioSeleccionado?.usuarios_locales?.some(
                    a => a.local.id === local.id
                  )
                  return !yaAsignado
                })
                .map(local => (
                  <option key={local.id} value={local.id}>
                    {local.nombre}
                  </option>
                ))}
            </select>
          </div>

          <div className="flex space-x-3">
            <button
              type="button"
              onClick={() => setModalAsignar(false)}
              className="btn-outline flex-1"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="btn-primary flex-1"
              disabled={loading}
            >
              Asignar
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal Crear Local */}
      <Modal
        isOpen={modalLocal}
        onClose={() => setModalLocal(false)}
        title="Crear Nuevo Local"
      >
        <form onSubmit={handleCrearLocal} className="space-y-4">
          <div>
            <label className="label">Nombre del Local *</label>
            <input
              type="text"
              value={formLocal.nombre}
              onChange={(e) => setFormLocal({ ...formLocal, nombre: e.target.value })}
              className="input-field"
              placeholder="Ej: Restaurante Central"
              required
            />
          </div>

          <div>
            <label className="label">Dirección</label>
            <input
              type="text"
              value={formLocal.direccion}
              onChange={(e) => setFormLocal({ ...formLocal, direccion: e.target.value })}
              className="input-field"
              placeholder="Av. Principal 123"
            />
          </div>

          <div>
            <label className="label">Teléfono</label>
            <input
              type="tel"
              value={formLocal.telefono}
              onChange={(e) => setFormLocal({ ...formLocal, telefono: e.target.value })}
              className="input-field"
              placeholder="1234567890"
            />
          </div>

          <div className="flex space-x-3">
            <button
              type="button"
              onClick={() => setModalLocal(false)}
              className="btn-outline flex-1"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="btn-primary flex-1"
              disabled={loading}
            >
              Crear Local
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

export default Administracion

import React, { useState, useEffect } from 'react'
import { 
  UserPlus, 
  Mail, 
  Lock, 
  User, 
  Shield, 
  Eye, 
  EyeOff,
  Edit2,
  Trash2,
  Building,
  Save,
  X
} from 'lucide-react'
import { adminService } from '../../services/adminService'
import { localesService } from '../../services/catalogosService'
import LoadingSpinner from '../common/LoadingSpinner'
import Modal from '../common/Modal'

const GestionUsuarios = ({ onAlert }) => {
  const [loading, setLoading] = useState(true)
  const [usuarios, setUsuarios] = useState([])
  const [locales, setLocales] = useState([])
  const [modalCrear, setModalCrear] = useState(false)
  const [modalEditar, setModalEditar] = useState(false)
  const [modalAsignar, setModalAsignar] = useState(false)
  const [usuarioSeleccionado, setUsuarioSeleccionado] = useState(null)
  const [showPassword, setShowPassword] = useState(false)

  const [formCrear, setFormCrear] = useState({
    email: '',
    password: '',
    nombre: '',
    apellido: '',
    rol: 'encargado'
  })

  const [formEditar, setFormEditar] = useState({
    nombre: '',
    apellido: '',
    rol: '',
    activo: true
  })

  const [localesAsignados, setLocalesAsignados] = useState([])

  useEffect(() => {
    cargarDatos()
  }, [])

  const cargarDatos = async () => {
    setLoading(true)
    try {
      // Cargar usuarios
      const usuariosResult = await adminService.getUsuarios()
      if (usuariosResult.success) {
        setUsuarios(usuariosResult.data)
      } else {
        console.error('Error al cargar usuarios:', usuariosResult.error)
        onAlert({ type: 'error', message: 'Error al cargar usuarios: ' + usuariosResult.error })
      }

      // Cargar todos los locales
      const localesResult = await adminService.getLocales()
      if (localesResult.success) {
        setLocales(localesResult.data)
      } else {
        console.error('Error al cargar locales:', localesResult.error)
        onAlert({ type: 'error', message: 'Error al cargar locales: ' + localesResult.error })
      }
    } catch (error) {
      console.error('Error general al cargar datos:', error)
      onAlert({ type: 'error', message: 'Error al cargar datos: ' + error.message })
    } finally {
      setLoading(false)
    }
  }

  const handleCrearUsuario = async (e) => {
    e.preventDefault()
    setLoading(true)

    try {
      // Crear usuario
      const result = await adminService.crearUsuario(formCrear)

      if (result.success) {
        onAlert({ type: 'success', message: 'Usuario creado correctamente' })
        setModalCrear(false)
        setFormCrear({
          email: '',
          password: '',
          nombre: '',
          apellido: '',
          rol: 'encargado'
        })
        setShowPassword(false)
        await cargarDatos()
      } else {
        // Manejar errores específicos
        let errorMessage = result.error

        // Errores comunes en español
        if (typeof errorMessage === 'string') {
          if (errorMessage.includes('duplicate key') || errorMessage.includes('usuarios_pkey')) {
            errorMessage = 'El email ya está registrado. Por favor usa otro email.'
          } else if (errorMessage.includes('email')) {
            errorMessage = 'El email ya existe en el sistema.'
          } else if (errorMessage.includes('password')) {
            errorMessage = 'La contraseña es muy corta. Usa al menos 6 caracteres.'
          }
        }

        onAlert({ type: 'error', message: errorMessage })
      }
    } catch (error) {
      console.error('Error al crear usuario:', error)
      onAlert({ type: 'error', message: 'Error al crear usuario. Por favor intenta de nuevo.' })
    } finally {
      setLoading(false)
    }
  }

  const handleEditarUsuario = async (e) => {
    e.preventDefault()
    setLoading(true)

    try {
      const result = await adminService.actualizarUsuario(
        usuarioSeleccionado.id,
        formEditar
      )

      if (result.success) {
        onAlert({ type: 'success', message: 'Usuario actualizado correctamente' })
        setModalEditar(false)
        setUsuarioSeleccionado(null)
        await cargarDatos()
      } else {
        onAlert({ type: 'error', message: result.error })
      }
    } catch (error) {
      onAlert({ type: 'error', message: 'Error al actualizar usuario' })
    } finally {
      setLoading(false)
    }
  }

  const abrirModalEditar = (usuario) => {
    setUsuarioSeleccionado(usuario)
    setFormEditar({
      nombre: usuario.nombre,
      apellido: usuario.apellido,
      rol: usuario.rol,
      activo: usuario.activo
    })
    setModalEditar(true)
  }

  const abrirModalAsignar = async (usuario) => {
    setUsuarioSeleccionado(usuario)
    setLoading(true)

    try {
      // Cargar locales asignados al usuario
      const result = await adminService.getLocalesUsuario(usuario.id)
      if (result.success) {
        const asignados = result.data.map(l => l.id)
        setLocalesAsignados(asignados)
      }
    } catch (error) {
      onAlert({ type: 'error', message: 'Error al cargar locales' })
    } finally {
      setLoading(false)
      setModalAsignar(true)
    }
  }

  const toggleLocal = (localId) => {
    setLocalesAsignados(prev => {
      if (prev.includes(localId)) {
        return prev.filter(id => id !== localId)
      } else {
        return [...prev, localId]
      }
    })
  }

  const handleGuardarLocales = async () => {
    setLoading(true)

    try {
      const result = await adminService.asignarLocalesUsuario(
        usuarioSeleccionado.id,
        localesAsignados
      )

      if (result.success) {
        onAlert({ type: 'success', message: 'Locales asignados correctamente' })
        setModalAsignar(false)
        setUsuarioSeleccionado(null)
        setLocalesAsignados([])
      } else {
        onAlert({ type: 'error', message: result.error })
      }
    } catch (error) {
      onAlert({ type: 'error', message: 'Error al asignar locales' })
    } finally {
      setLoading(false)
    }
  }

  const handleEliminarUsuario = async (usuarioId) => {
    if (!window.confirm('¿Está seguro de eliminar este usuario? Esta acción no se puede deshacer.')) {
      return
    }

    setLoading(true)

    try {
      const result = await adminService.eliminarUsuario(usuarioId)

      if (result.success) {
        onAlert({ type: 'success', message: 'Usuario eliminado correctamente' })
        await cargarDatos()
      } else {
        onAlert({ type: 'error', message: result.error })
      }
    } catch (error) {
      onAlert({ type: 'error', message: 'Error al eliminar usuario' })
    } finally {
      setLoading(false)
    }
  }

  const getRolBadgeColor = (rol) => {
    switch (rol) {
      case 'administrador':
        return 'bg-red-100 text-red-800'
      case 'rrhh':
        return 'bg-purple-100 text-purple-800'
      case 'encargado':
        return 'bg-blue-100 text-blue-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getRolLabel = (rol) => {
    switch (rol) {
      case 'administrador':
        return 'Administrador'
      case 'rrhh':
        return 'RRHH'
      case 'encargado':
        return 'Encargado'
      default:
        return rol
    }
  }

  if (loading && usuarios.length === 0) {
    return <LoadingSpinner />
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-dark">Gestión de Usuarios</h2>
          <p className="text-gray-600 mt-1">
            Administra los usuarios y sus permisos de acceso
          </p>
        </div>
        <button
          onClick={() => setModalCrear(true)}
          className="btn-primary flex items-center gap-2"
        >
          <UserPlus className="w-5 h-5" />
          Crear Usuario
        </button>
      </div>

      {/* Lista de usuarios */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Usuario
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Email
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Rol
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Estado
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Locales
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {usuarios.map((usuario) => (
                <tr key={usuario.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-10 w-10 bg-primary/10 rounded-full flex items-center justify-center">
                        <User className="h-5 w-5 text-primary" />
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">
                          {usuario.nombre} {usuario.apellido}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{usuario.email}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getRolBadgeColor(usuario.rol)}`}>
                      {getRolLabel(usuario.rol)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      usuario.activo 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {usuario.activo ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {usuario.locales_count || 0} asignados
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => abrirModalAsignar(usuario)}
                        className="text-blue-600 hover:text-blue-900"
                        title="Asignar locales"
                      >
                        <Building className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => abrirModalEditar(usuario)}
                        className="text-primary hover:text-primary/80"
                        title="Editar"
                      >
                        <Edit2 className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => handleEliminarUsuario(usuario.id)}
                        className="text-red-600 hover:text-red-900"
                        title="Eliminar"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Crear Usuario */}
      <Modal
        isOpen={modalCrear}
        onClose={() => setModalCrear(false)}
        title="Crear Nuevo Usuario"
      >
        <form onSubmit={handleCrearUsuario} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Nombre *</label>
              <input
                type="text"
                value={formCrear.nombre}
                onChange={(e) => setFormCrear({...formCrear, nombre: e.target.value})}
                className="input-field"
                required
              />
            </div>
            <div>
              <label className="label">Apellido *</label>
              <input
                type="text"
                value={formCrear.apellido}
                onChange={(e) => setFormCrear({...formCrear, apellido: e.target.value})}
                className="input-field"
                required
              />
            </div>
          </div>

          <div>
            <label className="label">Email *</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="email"
                value={formCrear.email}
                onChange={(e) => setFormCrear({...formCrear, email: e.target.value})}
                className="input-field pl-10"
                placeholder="usuario@smartdom.io"
                required
              />
            </div>
          </div>

          <div>
            <label className="label">Contraseña *</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={formCrear.password}
                onChange={(e) => setFormCrear({...formCrear, password: e.target.value})}
                className="input-field pl-10 pr-10"
                placeholder="Mínimo 6 caracteres"
                minLength="6"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-1">Mínimo 6 caracteres</p>
          </div>

          <div>
            <label className="label">Rol *</label>
            <div className="relative">
              <Shield className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <select
                value={formCrear.rol}
                onChange={(e) => setFormCrear({...formCrear, rol: e.target.value})}
                className="select-field pl-10"
                required
              >
                <option value="encargado">Encargado</option>
                <option value="rrhh">RRHH</option>
                <option value="administrador">Administrador</option>
              </select>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-sm text-blue-800">
              <strong>Nota:</strong> El usuario recibirá un email de confirmación. 
              Después de crear el usuario, asígnale los locales correspondientes.
            </p>
          </div>

          <div className="flex space-x-3">
            <button
              type="button"
              onClick={() => setModalCrear(false)}
              className="btn-outline flex-1"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="btn-primary flex-1"
              disabled={loading}
            >
              {loading ? 'Creando...' : 'Crear Usuario'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal Editar Usuario */}
      <Modal
        isOpen={modalEditar}
        onClose={() => setModalEditar(false)}
        title="Editar Usuario"
      >
        <form onSubmit={handleEditarUsuario} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Nombre *</label>
              <input
                type="text"
                value={formEditar.nombre}
                onChange={(e) => setFormEditar({...formEditar, nombre: e.target.value})}
                className="input-field"
                required
              />
            </div>
            <div>
              <label className="label">Apellido *</label>
              <input
                type="text"
                value={formEditar.apellido}
                onChange={(e) => setFormEditar({...formEditar, apellido: e.target.value})}
                className="input-field"
                required
              />
            </div>
          </div>

          <div>
            <label className="label">Rol *</label>
            <select
              value={formEditar.rol}
              onChange={(e) => setFormEditar({...formEditar, rol: e.target.value})}
              className="select-field"
              required
            >
              <option value="encargado">Encargado</option>
              <option value="rrhh">RRHH</option>
              <option value="administrador">Administrador</option>
            </select>
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              id="activo"
              checked={formEditar.activo}
              onChange={(e) => setFormEditar({...formEditar, activo: e.target.checked})}
              className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
            />
            <label htmlFor="activo" className="ml-2 block text-sm text-gray-900">
              Usuario activo
            </label>
          </div>

          <div className="flex space-x-3">
            <button
              type="button"
              onClick={() => setModalEditar(false)}
              className="btn-outline flex-1"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="btn-primary flex-1"
              disabled={loading}
            >
              {loading ? 'Guardando...' : 'Guardar Cambios'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal Asignar Locales */}
      <Modal
        isOpen={modalAsignar}
        onClose={() => setModalAsignar(false)}
        title={`Asignar Locales - ${usuarioSeleccionado?.nombre} ${usuarioSeleccionado?.apellido}`}
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Selecciona los locales a los que tendrá acceso este usuario
          </p>

          <div className="space-y-2 max-h-96 overflow-y-auto">
            {locales.map((local) => (
              <label
                key={local.id}
                className="flex items-center p-3 border rounded-lg hover:bg-gray-50 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={localesAsignados.includes(local.id)}
                  onChange={() => toggleLocal(local.id)}
                  className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
                />
                <div className="ml-3 flex-1">
                  <p className="text-sm font-medium text-gray-900">{local.nombre}</p>
                  <p className="text-xs text-gray-500">{local.direccion}</p>
                </div>
              </label>
            ))}
          </div>

          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-sm text-gray-700">
              <strong>Locales seleccionados:</strong> {localesAsignados.length} de {locales.length}
            </p>
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
              onClick={handleGuardarLocales}
              className="btn-primary flex-1 flex items-center justify-center gap-2"
              disabled={loading}
            >
              <Save className="w-4 h-4" />
              {loading ? 'Guardando...' : 'Guardar Locales'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

export default GestionUsuarios

import React, { useState, useEffect } from 'react'
import { 
  UserPlus, 
  LogOut as LogOutIcon, 
  Clock, 
  Search, 
  Plus,
  Minus
} from 'lucide-react'
import { empleadosService } from '../../services/empleadosService'
import { registrosService } from '../../services/registrosService'
import { rolesService, valesService, ausenciasService, motivosAusenciaService, motivosValesService } from '../../services/catalogosService'
import LoadingSpinner from '../common/LoadingSpinner'
import Modal from '../common/Modal'
import { format } from 'date-fns'

const RegistroHorarios = ({ localId, onUpdate, onAlert }) => {
  const [loading, setLoading] = useState(true)
  const [empleados, setEmpleados] = useState([])
  const [registrosHoy, setRegistrosHoy] = useState([])
  const [roles, setRoles] = useState([])
  const [motivos, setMotivos] = useState([])
  const [motivosVales, setMotivosVales] = useState([])
  const [busqueda, setBusqueda] = useState('')
  
  // Modales
  const [modalEntrada, setModalEntrada] = useState(false)
  const [modalVale, setModalVale] = useState(false)
  const [modalAusencia, setModalAusencia] = useState(false)
  
  // Formularios
  const [formEntrada, setFormEntrada] = useState({
    empleadoId: '',
    rolId: '',
    observaciones: ''
  })
  
  const [formVale, setFormVale] = useState({
    empleadoId: '',
    motivoId: '',
    importe: '',
    concepto: ''
  })
  
  const [formAusencia, setFormAusencia] = useState({
    empleadoId: '',
    motivoId: '',
    observaciones: ''
  })

  useEffect(() => {
    cargarDatos()
  }, [localId])

  const cargarDatos = async () => {
    setLoading(true)
    try {
      // Cargar empleados del local
      const empResult = await empleadosService.getEmpleadosPorLocal(localId)
      if (empResult.success) {
        setEmpleados(empResult.data)
      }

      // Cargar registros del día
      await cargarRegistrosHoy()

      // Cargar roles
      const rolesResult = await rolesService.getRoles()
      if (rolesResult.success) {
        setRoles(rolesResult.data)
      }

      // Cargar motivos de ausencia
      const motivosResult = await motivosAusenciaService.getMotivos()
      if (motivosResult.success) {
        setMotivos(motivosResult.data)
      }

      // Cargar motivos de vales
      const motivosValesResult = await motivosValesService.getMotivos()
      if (motivosValesResult.success) {
        setMotivosVales(motivosValesResult.data)
      }
    } catch (error) {
      onAlert({ type: 'error', message: 'Error al cargar datos' })
    } finally {
      setLoading(false)
    }
  }

  const cargarRegistrosHoy = async () => {
    const result = await registrosService.getRegistrosDelDia(localId)
    if (result.success) {
      setRegistrosHoy(result.data)
    }
  }

  const handleRegistrarEntrada = async (e) => {
    e.preventDefault()
    setLoading(true)

    try {
      // Verificar que el empleado pueda registrar entrada
      const puedeResult = await registrosService.puedeRegistrarEntrada(formEntrada.empleadoId)
      
      if (!puedeResult.puede) {
        onAlert({ 
          type: 'warning', 
          message: `El empleado ya tiene un registro activo en ${puedeResult.registroActivo.local.nombre}` 
        })
        setLoading(false)
        return
      }

      const result = await registrosService.registrarEntrada(
        formEntrada.empleadoId,
        localId,
        formEntrada.rolId,
        formEntrada.observaciones
      )

      if (result.success) {
        onAlert({ type: 'success', message: 'Entrada registrada correctamente' })
        setModalEntrada(false)
        setFormEntrada({ empleadoId: '', rolId: '', observaciones: '' })
        await cargarRegistrosHoy()
        onUpdate()
      } else {
        onAlert({ type: 'error', message: result.error })
      }
    } catch (error) {
      onAlert({ type: 'error', message: 'Error al registrar entrada' })
    } finally {
      setLoading(false)
    }
  }

  const handleRegistrarSalida = async (registroId) => {
    if (!window.confirm('¿Confirmar salida del empleado?')) return

    setLoading(true)
    try {
      const result = await registrosService.registrarSalida(registroId)
      
      if (result.success) {
        onAlert({ type: 'success', message: 'Salida registrada correctamente' })
        await cargarRegistrosHoy()
        onUpdate()
      } else {
        onAlert({ type: 'error', message: result.error })
      }
    } catch (error) {
      onAlert({ type: 'error', message: 'Error al registrar salida' })
    } finally {
      setLoading(false)
    }
  }

  const handleRegistrarVale = async (e) => {
    e.preventDefault()
    setLoading(true)

    try {
      const result = await valesService.registrarVale({
        localId: localId,
        empleadoId: formVale.empleadoId,
        motivoId: formVale.motivoId,
        importe: parseFloat(formVale.importe),
        concepto: formVale.concepto
      })

      if (result.success) {
        onAlert({ type: 'success', message: 'Vale registrado correctamente' })
        setModalVale(false)
        setFormVale({ empleadoId: '', motivoId: '', importe: '', concepto: '' })
        onUpdate()
      } else {
        onAlert({ type: 'error', message: result.error })
      }
    } catch (error) {
      onAlert({ type: 'error', message: 'Error al registrar vale' })
    } finally {
      setLoading(false)
    }
  }

  const handleRegistrarAusencia = async (e) => {
    e.preventDefault()
    setLoading(true)

    try {
      const result = await ausenciasService.registrarAusencia({
        localId: localId,
        empleadoId: formAusencia.empleadoId,
        motivoId: formAusencia.motivoId,
        observaciones: formAusencia.observaciones
      })

      if (result.success) {
        onAlert({ type: 'success', message: 'Ausencia registrada correctamente' })
        setModalAusencia(false)
        setFormAusencia({ empleadoId: '', motivoId: '', observaciones: '' })
        onUpdate()
      } else {
        onAlert({ type: 'error', message: result.error })
      }
    } catch (error) {
      onAlert({ type: 'error', message: 'Error al registrar ausencia' })
    } finally {
      setLoading(false)
    }
  }

  const empleadosFiltrados = empleados.filter(emp => 
    `${emp.nombre} ${emp.apellido} ${emp.documento}`.toLowerCase().includes(busqueda.toLowerCase())
  )

  if (loading && empleados.length === 0) {
    return <LoadingSpinner text="Cargando registros..." />
  }

  return (
    <div className="space-y-6">
      {/* Acciones rápidas */}
      <div className="flex flex-wrap gap-4">
        <button
          onClick={() => setModalEntrada(true)}
          className="btn-primary flex items-center space-x-2"
        >
          <UserPlus className="w-5 h-5" />
          <span>Registrar Entrada</span>
        </button>
        
        <button
          onClick={() => setModalVale(true)}
          className="btn-secondary flex items-center space-x-2"
        >
          <Plus className="w-5 h-5" />
          <span>Registrar Vale</span>
        </button>
        
        <button
          onClick={() => setModalAusencia(true)}
          className="btn-outline flex items-center space-x-2"
        >
          <Minus className="w-5 h-5" />
          <span>Registrar Ausencia</span>
        </button>
      </div>

      {/* Lista de registros del día */}
      <div className="card">
        <h3 className="text-xl font-bold text-dark mb-4">Registros del Día</h3>
        
        {registrosHoy.length === 0 ? (
          <div className="text-center py-12">
            <Clock className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">No hay registros para hoy</p>
          </div>
        ) : (
          <div className="space-y-3">
            {registrosHoy.map(registro => (
              <div
                key={registro.id}
                className="bg-gray-50 rounded-lg p-4 flex items-center justify-between hover:bg-gray-100 transition-colors"
              >
                <div className="flex-1">
                  <div className="flex items-center space-x-3">
                    <div className={`w-3 h-3 rounded-full ${
                      registro.hora_salida ? 'bg-gray-400' : 'bg-green-500'
                    }`} />
                    <div>
                      <p className="font-semibold text-dark">
                        {registro.empleado.nombre} {registro.empleado.apellido}
                      </p>
                      <p className="text-sm text-gray-600">
                        {registro.rol.nombre} • Doc: {registro.empleado.documento}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-4">
                  <div className="text-right">
                    <p className="text-sm text-gray-600">Entrada</p>
                    <p className="font-medium text-dark">
                      {format(new Date(registro.hora_entrada), 'HH:mm')}
                    </p>
                  </div>

                  {registro.hora_salida ? (
                    <div className="text-right">
                      <p className="text-sm text-gray-600">Salida</p>
                      <p className="font-medium text-dark">
                        {format(new Date(registro.hora_salida), 'HH:mm')}
                      </p>
                    </div>
                  ) : (
                    <button
                      onClick={() => handleRegistrarSalida(registro.id)}
                      className="btn-outline flex items-center space-x-2"
                      disabled={loading}
                    >
                      <LogOutIcon className="w-4 h-4" />
                      <span>Registrar Salida</span>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal Registrar Entrada */}
      <Modal
        isOpen={modalEntrada}
        onClose={() => {
          setModalEntrada(false)
          setBusqueda('')
        }}
        title="Registrar Entrada"
      >
        <form onSubmit={handleRegistrarEntrada} className="space-y-4">
          {/* Buscador de empleados */}
          <div>
            <label className="label">Buscar Empleado</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                className="input-field pl-10"
                placeholder="Buscar por nombre, apellido o documento..."
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Total: {empleados.filter(emp => {
                if (!busqueda) return true
                const search = busqueda.toLowerCase()
                return (
                  emp.nombre.toLowerCase().includes(search) ||
                  emp.apellido.toLowerCase().includes(search) ||
                  emp.documento.includes(search)
                )
              }).length} empleados
            </p>
          </div>

          <div>
            <label className="label">Empleado *</label>
            <select
              value={formEntrada.empleadoId}
              onChange={(e) => setFormEntrada({...formEntrada, empleadoId: e.target.value})}
              className="select-field"
              required
              size="8"
              style={{ height: '200px' }}
            >
              <option value="">Seleccionar empleado...</option>
              {empleados
                .filter(emp => {
                  if (!busqueda) return true
                  const search = busqueda.toLowerCase()
                  return (
                    emp.nombre.toLowerCase().includes(search) ||
                    emp.apellido.toLowerCase().includes(search) ||
                    emp.documento.includes(search)
                  )
                })
                .sort((a, b) => {
                  // Ordenar por apellido, luego por nombre
                  const apellidoCompare = a.apellido.localeCompare(b.apellido, 'es', { sensitivity: 'base' })
                  if (apellidoCompare !== 0) return apellidoCompare
                  return a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' })
                })
                .map(emp => (
                  <option key={emp.id} value={emp.id}>
                    {emp.apellido}, {emp.nombre} - DNI: {emp.documento}
                  </option>
                ))}
            </select>
          </div>

          <div>
            <label className="label">Rol *</label>
            <select
              value={formEntrada.rolId}
              onChange={(e) => setFormEntrada({...formEntrada, rolId: e.target.value})}
              className="select-field"
              required
            >
              <option value="">Seleccionar rol...</option>
              {roles.map(rol => (
                <option key={rol.id} value={rol.id}>
                  {rol.nombre}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label">Observaciones</label>
            <textarea
              value={formEntrada.observaciones}
              onChange={(e) => setFormEntrada({...formEntrada, observaciones: e.target.value})}
              className="input-field"
              rows="3"
              placeholder="Observaciones opcionales..."
            />
          </div>

          <div className="flex space-x-3">
            <button
              type="button"
              onClick={() => {
                setModalEntrada(false)
                setBusqueda('')
              }}
              className="btn-outline flex-1"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="btn-primary flex-1"
              disabled={loading}
            >
              Registrar Entrada
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal Registrar Vale */}
      <Modal
        isOpen={modalVale}
        onClose={() => setModalVale(false)}
        title="Registrar Vale de Caja"
      >
        <form onSubmit={handleRegistrarVale} className="space-y-4">
          <div>
            <label className="label">Empleado *</label>
            <select
              value={formVale.empleadoId}
              onChange={(e) => setFormVale({...formVale, empleadoId: e.target.value})}
              className="select-field"
              required
            >
              <option value="">Seleccionar empleado...</option>
              {empleados
                .sort((a, b) => {
                  const apellidoCompare = a.apellido.localeCompare(b.apellido, 'es', { sensitivity: 'base' })
                  if (apellidoCompare !== 0) return apellidoCompare
                  return a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' })
                })
                .map(emp => (
                  <option key={emp.id} value={emp.id}>
                    {emp.apellido}, {emp.nombre}
                  </option>
                ))}
            </select>
          </div>

          <div>
            <label className="label">Motivo *</label>
            <select
              value={formVale.motivoId}
              onChange={(e) => setFormVale({...formVale, motivoId: e.target.value})}
              className="select-field"
              required
            >
              <option value="">Seleccionar motivo...</option>
              {motivosVales.map(motivo => (
                <option key={motivo.id} value={motivo.id}>
                  {motivo.motivo} {motivo.descuenta_sueldo ? '(Descuenta)' : '(No descuenta)'}
                </option>
              ))}
            </select>
            {formVale.motivoId && motivosVales.find(m => m.id === formVale.motivoId) && (
              <p className={`text-xs mt-1 ${
                motivosVales.find(m => m.id === formVale.motivoId).descuenta_sueldo 
                  ? 'text-red-600' 
                  : 'text-green-600'
              }`}>
                {motivosVales.find(m => m.id === formVale.motivoId).descuenta_sueldo 
                  ? '⚠️ Este vale se descontará del sueldo' 
                  : '✅ Este vale NO se descuenta (adicional al sueldo)'}
              </p>
            )}
          </div>

          <div>
            <label className="label">Importe *</label>
            <input
              type="number"
              step="0.01"
              value={formVale.importe}
              onChange={(e) => setFormVale({...formVale, importe: e.target.value})}
              className="input-field"
              placeholder="0.00"
              required
            />
          </div>

          <div>
            <label className="label">Observaciones</label>
            <textarea
              value={formVale.concepto}
              onChange={(e) => setFormVale({...formVale, concepto: e.target.value})}
              className="input-field"
              rows="3"
              placeholder="Observaciones adicionales (opcional)..."
            />
          </div>

          <div className="flex space-x-3">
            <button
              type="button"
              onClick={() => setModalVale(false)}
              className="btn-outline flex-1"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="btn-primary flex-1"
              disabled={loading}
            >
              Registrar Vale
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal Registrar Ausencia */}
      <Modal
        isOpen={modalAusencia}
        onClose={() => setModalAusencia(false)}
        title="Registrar Ausencia"
      >
        <form onSubmit={handleRegistrarAusencia} className="space-y-4">
          <div>
            <label className="label">Empleado *</label>
            <select
              value={formAusencia.empleadoId}
              onChange={(e) => setFormAusencia({...formAusencia, empleadoId: e.target.value})}
              className="select-field"
              required
            >
              <option value="">Seleccionar empleado...</option>
              {empleados
                .sort((a, b) => {
                  const apellidoCompare = a.apellido.localeCompare(b.apellido, 'es', { sensitivity: 'base' })
                  if (apellidoCompare !== 0) return apellidoCompare
                  return a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' })
                })
                .map(emp => (
                  <option key={emp.id} value={emp.id}>
                    {emp.apellido}, {emp.nombre}
                  </option>
                ))}
            </select>
          </div>

          <div>
            <label className="label">Motivo *</label>
            <select
              value={formAusencia.motivoId}
              onChange={(e) => setFormAusencia({...formAusencia, motivoId: e.target.value})}
              className="select-field"
              required
            >
              <option value="">Seleccionar motivo...</option>
              {motivos.map(motivo => (
                <option key={motivo.id} value={motivo.id}>
                  {motivo.motivo}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label">Observaciones</label>
            <textarea
              value={formAusencia.observaciones}
              onChange={(e) => setFormAusencia({...formAusencia, observaciones: e.target.value})}
              className="input-field"
              rows="3"
              placeholder="Detalles adicionales..."
            />
          </div>

          <div className="flex space-x-3">
            <button
              type="button"
              onClick={() => setModalAusencia(false)}
              className="btn-outline flex-1"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="btn-primary flex-1"
              disabled={loading}
            >
              Registrar Ausencia
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

export default RegistroHorarios

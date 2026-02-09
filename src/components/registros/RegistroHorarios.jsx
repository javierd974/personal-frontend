import React, { useState, useEffect, useRef } from 'react'
import { 
  UserPlus, 
  LogOut as LogOutIcon, 
  Clock, 
  Search, 
  Plus,
  Minus,
  FileText,
  DollarSign,
  UserMinus,
  X
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
  
  // Búsqueda directa
  const [busqueda, setBusqueda] = useState('')
  const [mostrarSugerencias, setMostrarSugerencias] = useState(false)
  const [empleadoSeleccionado, setEmpleadoSeleccionado] = useState(null)
  const [indiceSugerencia, setIndiceSugerencia] = useState(0)
  const inputBusquedaRef = useRef(null)
  
  // Modales
  const [modalRol, setModalRol] = useState(false)
  const [modalVale, setModalVale] = useState(false)
  const [modalAusencia, setModalAusencia] = useState(false)
  const [modalObservaciones, setModalObservaciones] = useState(false)
  
  // Formularios
  const [rolSeleccionado, setRolSeleccionado] = useState(null)
  const [indiceRol, setIndiceRol] = useState(0)
  const [observacionesGenerales, setObservacionesGenerales] = useState('')
  
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

  // Estados para búsqueda en modal de ausencias
  const [busquedaAusencia, setBusquedaAusencia] = useState('')
  const [mostrarSugerenciasAusencia, setMostrarSugerenciasAusencia] = useState(false)
  const [empleadoSeleccionadoAusencia, setEmpleadoSeleccionadoAusencia] = useState(null)

  // Estados para búsqueda en modal de vales
  const [busquedaVale, setBusquedaVale] = useState('')
  const [mostrarSugerenciasVale, setMostrarSugerenciasVale] = useState(false)
  const [empleadoSeleccionadoVale, setEmpleadoSeleccionadoVale] = useState(null)

  const modalRolRef = useRef(null)
  const botonIngresoRef = useRef(null)

  useEffect(() => {
    cargarDatos()
  }, [localId])

  // Dar foco al modal de rol cuando se abre
  useEffect(() => {
    if (modalRol && modalRolRef.current) {
      modalRolRef.current.focus()
    }
  }, [modalRol])

  // Formatear hora a HH:MM
  const formatearHora = (horaCompleta) => {
    if (!horaCompleta) return ''
    
    // Si es formato timestamp completo
    if (horaCompleta.includes('T')) {
      const fecha = new Date(horaCompleta)
      return fecha.toLocaleTimeString('es-AR', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: false 
      })
    }
    
    // Si ya es formato HH:MM:SS, tomar solo HH:MM
    if (horaCompleta.includes(':')) {
      return horaCompleta.substring(0, 5)
    }
    
    return horaCompleta
  }

  const cargarDatos = async () => {
    setLoading(true)
    try {
      // Cargar empleados del local
      const empResult = await empleadosService.getEmpleadosPorLocal(localId)
      if (empResult.success) {
        setEmpleados(empResult.data)
      }

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

      // Cargar registros de hoy
      await cargarRegistrosHoy()
    } catch (error) {
      console.error('Error al cargar datos:', error)
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

  // Filtrar empleados según búsqueda
  const empleadosFiltrados = empleados.filter(emp => {
    const nombreCompleto = `${emp.nombre} ${emp.apellido}`.toLowerCase()
    return nombreCompleto.includes(busqueda.toLowerCase())
  }).slice(0, 10) // Máximo 10 sugerencias

  // Manejar cambio en búsqueda
  const handleBusquedaChange = (e) => {
    const valor = e.target.value
    setBusqueda(valor)
    setMostrarSugerencias(valor.length > 0)
    setIndiceSugerencia(0)
  }

  // Manejar teclas en búsqueda
  const handleBusquedaKeyDown = (e) => {
    if (!mostrarSugerencias || empleadosFiltrados.length === 0) return

    switch(e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setIndiceSugerencia(prev => 
          prev < empleadosFiltrados.length - 1 ? prev + 1 : 0
        )
        break
      case 'ArrowUp':
        e.preventDefault()
        setIndiceSugerencia(prev => 
          prev > 0 ? prev - 1 : empleadosFiltrados.length - 1
        )
        break
      case 'Enter':
        e.preventDefault()
        if (empleadosFiltrados[indiceSugerencia]) {
          seleccionarEmpleado(empleadosFiltrados[indiceSugerencia])
        }
        break
      case 'Escape':
        setMostrarSugerencias(false)
        break
    }
  }

  // Seleccionar empleado de la lista
  const seleccionarEmpleado = (empleado) => {
    setEmpleadoSeleccionado(empleado)
    setBusqueda(`${empleado.nombre} ${empleado.apellido}`)
    setMostrarSugerencias(false)
    setModalRol(true)
    setIndiceRol(0)
  }

  // Manejar teclas en modal de rol
  const handleRolKeyDown = (e) => {
    switch(e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setIndiceRol(prev => prev < roles.length - 1 ? prev + 1 : 0)
        break
      case 'ArrowUp':
        e.preventDefault()
        setIndiceRol(prev => prev > 0 ? prev - 1 : roles.length - 1)
        break
      case 'Enter':
        e.preventDefault()
        if (roles[indiceRol]) {
          seleccionarRol(roles[indiceRol])
        }
        break
      case 'Escape':
        setModalRol(false)
        break
    }
  }

  // Seleccionar rol
  const seleccionarRol = (rol) => {
    setRolSeleccionado(rol)
    setModalRol(false)
    // Dar foco al botón de ingreso
    setTimeout(() => {
      botonIngresoRef.current?.focus()
    }, 100)
  }

  // Registrar entrada
  const registrarEntrada = async () => {
    if (!empleadoSeleccionado || !rolSeleccionado) {
      onAlert({ type: 'error', message: 'Selecciona empleado y rol' })
      return
    }

    setLoading(true)
    try {
      const result = await registrosService.registrarEntrada(
        empleadoSeleccionado.id,
        localId,
        rolSeleccionado.id,
        ''
      )

      if (result.success) {
        onAlert({ type: 'success', message: 'Entrada registrada correctamente' })
        // Limpiar formulario
        setBusqueda('')
        setEmpleadoSeleccionado(null)
        setRolSeleccionado(null)
        await cargarRegistrosHoy()
        if (onUpdate) onUpdate()
        inputBusquedaRef.current?.focus()
      } else {
        onAlert({ type: 'error', message: result.error })
      }
    } catch (error) {
      onAlert({ type: 'error', message: 'Error al registrar entrada' })
    } finally {
      setLoading(false)
    }
  }

  // Registrar salida
  const registrarSalida = async (registroId) => {
    if (!window.confirm('¿Confirmar salida del empleado?')) return

    setLoading(true)
    try {
      const result = await registrosService.registrarSalida(registroId)

      if (result.success) {
        onAlert({ type: 'success', message: 'Salida registrada correctamente' })
        await cargarRegistrosHoy()
        if (onUpdate) onUpdate()
      } else {
        onAlert({ type: 'error', message: result.error })
      }
    } catch (error) {
      onAlert({ type: 'error', message: 'Error al registrar salida' })
    } finally {
      setLoading(false)
    }
  }

  // Registrar vale
  const registrarVale = async () => {
    if (!empleadoSeleccionadoVale || !formVale.motivoId || !formVale.importe) {
      onAlert({ type: 'error', message: 'Completa empleado, motivo e importe' })
      return
    }

    setLoading(true)
    try {
      const result = await valesService.registrarVale({
        empleado_id: empleadoSeleccionadoVale.id,
        local_id: localId,
        motivo_id: formVale.motivoId,
        importe: parseFloat(formVale.importe),
        concepto: formVale.concepto
      })

      if (result.success) {
        onAlert({ type: 'success', message: 'Vale registrado correctamente' })
        setModalVale(false)
        setBusquedaVale('')
        setEmpleadoSeleccionadoVale(null)
        setFormVale({ empleadoId: '', motivoId: '', importe: '', concepto: '' })
        if (onUpdate) onUpdate()
      } else {
        onAlert({ type: 'error', message: result.error })
      }
    } catch (error) {
      onAlert({ type: 'error', message: 'Error al registrar vale' })
    } finally {
      setLoading(false)
    }
  }

  // Registrar ausencia
  const registrarAusencia = async () => {
    if (!empleadoSeleccionadoAusencia || !formAusencia.motivoId) {
      onAlert({ type: 'error', message: 'Selecciona empleado y motivo' })
      return
    }

    setLoading(true)
    try {
      const result = await ausenciasService.registrarAusencia({
        empleado_id: empleadoSeleccionadoAusencia.id,
        local_id: localId,
        motivo_id: formAusencia.motivoId,
        observaciones: formAusencia.observaciones
      })

      if (result.success) {
        onAlert({ type: 'success', message: 'Ausencia registrada correctamente' })
        setModalAusencia(false)
        setBusquedaAusencia('')
        setEmpleadoSeleccionadoAusencia(null)
        setFormAusencia({ empleadoId: '', motivoId: '', observaciones: '' })
        if (onUpdate) onUpdate()
      } else {
        onAlert({ type: 'error', message: result.error })
      }
    } catch (error) {
      onAlert({ type: 'error', message: 'Error al registrar ausencia' })
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <LoadingSpinner />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Sección superior: Búsqueda y botón de ingreso */}
      <div className="card">
        <h3 className="text-xl font-bold text-dark mb-4">Control de Horarios</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Búsqueda directa */}
          <div className="md:col-span-2 relative">
            <label className="label">Nombre y Apellido</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                ref={inputBusquedaRef}
                type="text"
                value={busqueda}
                onChange={handleBusquedaChange}
                onKeyDown={handleBusquedaKeyDown}
                onFocus={() => busqueda && setMostrarSugerencias(true)}
                className="input-field pl-10"
                placeholder="Buscar empleado..."
                autoFocus
              />
            </div>

            {/* Sugerencias desplegables */}
            {mostrarSugerencias && empleadosFiltrados.length > 0 && (
              <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                {empleadosFiltrados.map((emp, index) => (
                  <div
                    key={emp.id}
                    onClick={() => seleccionarEmpleado(emp)}
                    className={`px-4 py-3 cursor-pointer transition-colors ${
                      index === indiceSugerencia
                        ? 'bg-primary/10 text-primary'
                        : 'hover:bg-gray-50'
                    }`}
                  >
                    <p className="font-medium">{emp.nombre} {emp.apellido}</p>
                    <p className="text-sm text-gray-600">{emp.documento}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Empleado y rol seleccionados */}
            {empleadoSeleccionado && rolSeleccionado && (
              <div className="mt-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-sm text-green-900">
                  <span className="font-medium">{empleadoSeleccionado.nombre} {empleadoSeleccionado.apellido}</span>
                  {' '}- {rolSeleccionado.nombre}
                </p>
              </div>
            )}
          </div>

          {/* Botón INGRESO */}
          <div className="flex items-end">
            <button
              ref={botonIngresoRef}
              onClick={registrarEntrada}
              disabled={!empleadoSeleccionado || !rolSeleccionado || loading}
              className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-6 px-6 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg flex items-center justify-center gap-3 text-xl"
            >
              <UserPlus className="w-7 h-7" />
              <span>INGRESO</span>
            </button>
          </div>
        </div>
      </div>

      {/* Botones color #C9981D: Vales, Ausencias y Observaciones */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <button
          onClick={() => setModalVale(true)}
          className="font-bold py-4 px-6 rounded-lg transition-colors flex items-center justify-center gap-2 shadow-lg"
          style={{ backgroundColor: '#C9981D', color: '#1F2937' }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#B38819'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#C9981D'}
        >
          <DollarSign className="w-6 h-6" />
          <span>ENTREGA DE VALES</span>
        </button>

        <button
          onClick={() => setModalAusencia(true)}
          className="font-bold py-4 px-6 rounded-lg transition-colors flex items-center justify-center gap-2 shadow-lg"
          style={{ backgroundColor: '#C9981D', color: '#1F2937' }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#B38819'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#C9981D'}
        >
          <UserMinus className="w-6 h-6" />
          <span>REGISTRO DE AUSENTES</span>
        </button>

        <button
          onClick={() => setModalObservaciones(true)}
          className="font-bold py-4 px-6 rounded-lg transition-colors flex items-center justify-center gap-2 shadow-lg"
          style={{ backgroundColor: '#C9981D', color: '#1F2937' }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#B38819'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#C9981D'}
        >
          <FileText className="w-6 h-6" />
          <span>OBSERVACIONES</span>
        </button>
      </div>

      {/* Registros del día */}
      <div className="card">
        <h3 className="text-lg font-bold text-dark mb-4">Registros del Día</h3>
        
        {registrosHoy.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No hay registros hoy</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Empleado</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Rol</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Entrada</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Salida</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Horas</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-gray-600">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {registrosHoy.map((registro) => (
                  <tr key={registro.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm">
                      {registro.empleado.nombre} {registro.empleado.apellido}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {registro.rol.nombre}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-primary">
                      {formatearHora(registro.hora_entrada)}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {registro.hora_salida ? (
                        <span className="text-gray-900">{formatearHora(registro.hora_salida)}</span>
                      ) : (
                        <span className="text-green-600 font-medium">EN TURNO</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {registro.horas_trabajadas || '-'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {!registro.hora_salida && (
                        <button
                          onClick={() => registrarSalida(registro.id)}
                          className="btn-icon text-red-600 hover:bg-red-50"
                          title="Registrar salida"
                        >
                          <LogOutIcon className="w-5 h-5" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal de Rol */}
      <Modal
        isOpen={modalRol}
        onClose={() => setModalRol(false)}
        title="Seleccionar Rol"
      >
        <div 
          ref={modalRolRef}
          className="space-y-2 outline-none" 
          onKeyDown={handleRolKeyDown} 
          tabIndex={0}
        >
          <p className="text-sm text-gray-600 mb-4">
            Use las flechas ↑↓ y Enter para seleccionar
          </p>
          {roles.map((rol, index) => (
            <div
              key={rol.id}
              onClick={() => seleccionarRol(rol)}
              className={`p-3 rounded-lg cursor-pointer transition-colors ${
                index === indiceRol
                  ? 'bg-primary text-white'
                  : 'bg-gray-50 hover:bg-gray-100'
              }`}
            >
              <p className="font-medium">{rol.nombre}</p>
            </div>
          ))}
        </div>
      </Modal>

      {/* Modal de Vale */}
      <Modal
        isOpen={modalVale}
        onClose={() => {
          setModalVale(false)
          setBusquedaVale('')
          setEmpleadoSeleccionadoVale(null)
          setMostrarSugerenciasVale(false)
        }}
        title="Registrar Vale"
      >
        <div className="space-y-4">
          {/* Búsqueda de empleado con dropdown */}
          <div className="relative">
            <label className="label">Empleado</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={busquedaVale}
                onChange={(e) => {
                  setBusquedaVale(e.target.value)
                  setMostrarSugerenciasVale(e.target.value.length > 0)
                  if (!e.target.value) {
                    setEmpleadoSeleccionadoVale(null)
                  }
                }}
                onFocus={() => busquedaVale && setMostrarSugerenciasVale(true)}
                className="input-field pl-10"
                placeholder="Buscar por nombre o apellido..."
              />
            </div>

            {/* Sugerencias desplegables */}
            {mostrarSugerenciasVale && busquedaVale && (
              <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                {empleados
                  .filter(emp => {
                    const nombreCompleto = `${emp.nombre} ${emp.apellido}`.toLowerCase()
                    return nombreCompleto.includes(busquedaVale.toLowerCase())
                  })
                  .slice(0, 10)
                  .map((emp) => (
                    <div
                      key={emp.id}
                      onClick={() => {
                        setEmpleadoSeleccionadoVale(emp)
                        setBusquedaVale(`${emp.nombre} ${emp.apellido}`)
                        setMostrarSugerenciasVale(false)
                      }}
                      className="px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors"
                    >
                      <p className="font-medium">{emp.nombre} {emp.apellido}</p>
                      <p className="text-sm text-gray-600">{emp.documento}</p>
                    </div>
                  ))}
              </div>
            )}

            {/* Empleado seleccionado */}
            {empleadoSeleccionadoVale && (
              <div className="mt-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-sm text-green-900">
                  <span className="font-medium">
                    {empleadoSeleccionadoVale.nombre} {empleadoSeleccionadoVale.apellido}
                  </span>
                </p>
              </div>
            )}
          </div>

          <div>
            <label className="label">Motivo</label>
            <select
              value={formVale.motivoId}
              onChange={(e) => setFormVale({ ...formVale, motivoId: e.target.value })}
              className="select-field"
            >
              <option value="">Seleccionar motivo</option>
              {motivosVales.map(motivo => (
                <option key={motivo.id} value={motivo.id}>
                  {motivo.motivo}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label">Importe</label>
            <input
              type="number"
              value={formVale.importe}
              onChange={(e) => setFormVale({ ...formVale, importe: e.target.value })}
              className="input-field"
              placeholder="0.00"
            />
          </div>

          <div>
            <label className="label">Concepto (opcional)</label>
            <textarea
              value={formVale.concepto}
              onChange={(e) => setFormVale({ ...formVale, concepto: e.target.value })}
              className="input-field"
              rows="3"
              placeholder="Detalles adicionales..."
            />
          </div>

          <button
            onClick={registrarVale}
            disabled={loading}
            className="btn-primary w-full"
          >
            Registrar Vale
          </button>
        </div>
      </Modal>

      {/* Modal de Ausencia */}
      <Modal
        isOpen={modalAusencia}
        onClose={() => {
          setModalAusencia(false)
          setBusquedaAusencia('')
          setEmpleadoSeleccionadoAusencia(null)
          setMostrarSugerenciasAusencia(false)
        }}
        title="Registrar Ausencia"
      >
        <div className="space-y-4">
          {/* Búsqueda de empleado con dropdown */}
          <div className="relative">
            <label className="label">Empleado</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={busquedaAusencia}
                onChange={(e) => {
                  setBusquedaAusencia(e.target.value)
                  setMostrarSugerenciasAusencia(e.target.value.length > 0)
                  if (!e.target.value) {
                    setEmpleadoSeleccionadoAusencia(null)
                  }
                }}
                onFocus={() => busquedaAusencia && setMostrarSugerenciasAusencia(true)}
                className="input-field pl-10"
                placeholder="Buscar por nombre o apellido..."
              />
            </div>

            {/* Sugerencias desplegables */}
            {mostrarSugerenciasAusencia && busquedaAusencia && (
              <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                {empleados
                  .filter(emp => {
                    const nombreCompleto = `${emp.nombre} ${emp.apellido}`.toLowerCase()
                    return nombreCompleto.includes(busquedaAusencia.toLowerCase())
                  })
                  .slice(0, 10)
                  .map((emp) => (
                    <div
                      key={emp.id}
                      onClick={() => {
                        setEmpleadoSeleccionadoAusencia(emp)
                        setBusquedaAusencia(`${emp.nombre} ${emp.apellido}`)
                        setMostrarSugerenciasAusencia(false)
                      }}
                      className="px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors"
                    >
                      <p className="font-medium">{emp.nombre} {emp.apellido}</p>
                      <p className="text-sm text-gray-600">{emp.documento}</p>
                    </div>
                  ))}
              </div>
            )}

            {/* Empleado seleccionado */}
            {empleadoSeleccionadoAusencia && (
              <div className="mt-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-sm text-green-900">
                  <span className="font-medium">
                    {empleadoSeleccionadoAusencia.nombre} {empleadoSeleccionadoAusencia.apellido}
                  </span>
                </p>
              </div>
            )}
          </div>

          <div>
            <label className="label">Motivo</label>
            <select
              value={formAusencia.motivoId}
              onChange={(e) => setFormAusencia({ ...formAusencia, motivoId: e.target.value })}
              className="select-field"
            >
              <option value="">Seleccionar motivo</option>
              {motivos.map(motivo => (
                <option key={motivo.id} value={motivo.id}>
                  {motivo.motivo}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label">Observaciones (opcional)</label>
            <textarea
              value={formAusencia.observaciones}
              onChange={(e) => setFormAusencia({ ...formAusencia, observaciones: e.target.value })}
              className="input-field"
              rows="3"
              placeholder="Detalles adicionales..."
            />
          </div>

          <button
            onClick={registrarAusencia}
            disabled={loading}
            className="btn-primary w-full"
          >
            Registrar Ausencia
          </button>
        </div>
      </Modal>

      {/* Modal de Observaciones */}
      <Modal
        isOpen={modalObservaciones}
        onClose={() => setModalObservaciones(false)}
        title="Observaciones del Turno"
      >
        <div className="space-y-4">
          <div>
            <label className="label">Observaciones Generales</label>
            <textarea
              value={observacionesGenerales}
              onChange={(e) => setObservacionesGenerales(e.target.value)}
              className="input-field"
              rows="6"
              placeholder="Anota aquí cualquier observación relevante del turno..."
            />
            <p className="text-xs text-gray-500 mt-2">
              Estas observaciones se incluirán en el cierre de turno
            </p>
          </div>

          <button
            onClick={() => {
              onAlert({ type: 'success', message: 'Observaciones guardadas' })
              setModalObservaciones(false)
            }}
            className="btn-primary w-full"
          >
            Guardar Observaciones
          </button>
        </div>
      </Modal>
    </div>
  )
}

export default RegistroHorarios

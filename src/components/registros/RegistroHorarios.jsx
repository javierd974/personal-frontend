import React, { useState, useEffect, useRef } from 'react'
import { 
  UserPlus, 
  LogOut as LogOutIcon, 
  Clock, 
  Search, 
  FileText,
  DollarSign,
  UserMinus,
  Trash2,
  Lock,
  ToggleLeft,
  ToggleRight
} from 'lucide-react'
import { empleadosService } from '../../services/empleadosService'
import { registrosService } from '../../services/registrosService'
import { rolesService, valesService, ausenciasService, motivosAusenciaService, motivosValesService, observacionesTurnoService } from '../../services/catalogosService'
import LoadingSpinner from '../common/LoadingSpinner'
import Modal from '../common/Modal'
import IdentificacionBiometrica from './IdentificacionBiometrica'
import { format } from 'date-fns'

const RegistroHorarios = ({ localId, onUpdate, onAlert, observaciones, onObservacionesChange }) => {
  const [loading, setLoading] = useState(true)
  const [empleados, setEmpleados] = useState([])
  const [registrosHoy, setRegistrosHoy] = useState([])
  const [roles, setRoles] = useState([])
  const [motivos, setMotivos] = useState([])
  const [motivosVales, setMotivosVales] = useState([])

  // Listas del día para mostrar con opción de eliminar
  const [valesHoy, setValesHoy] = useState([])
  const [ausenciasHoy, setAusenciasHoy] = useState([])
  
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
  const [observacionesInternas, setObservacionesInternas] = useState('')
  
  const [formVale, setFormVale] = useState({ empleadoId: '', motivoId: '', importe: '', concepto: '' })
  const [formAusencia, setFormAusencia] = useState({ empleadoId: '', motivoId: '', observaciones: '' })

  // Búsqueda en modales
  const [busquedaAusencia, setBusquedaAusencia] = useState('')
  const [mostrarSugerenciasAusencia, setMostrarSugerenciasAusencia] = useState(false)
  const [empleadoSeleccionadoAusencia, setEmpleadoSeleccionadoAusencia] = useState(null)
  const [busquedaVale, setBusquedaVale] = useState('')
  const [mostrarSugerenciasVale, setMostrarSugerenciasVale] = useState(false)
  const [empleadoSeleccionadoVale, setEmpleadoSeleccionadoVale] = useState(null)

  const modalRolRef = useRef(null)
  const botonIngresoRef = useRef(null)

  useEffect(() => { cargarDatos() }, [localId])

  useEffect(() => {
    if (observaciones !== undefined) setObservacionesInternas(observaciones)
  }, [observaciones])

  useEffect(() => {
    if (modalRol && modalRolRef.current) modalRolRef.current.focus()
  }, [modalRol])

  const formatearHora = (horaCompleta) => {
    if (!horaCompleta) return ''
    if (horaCompleta.includes('T')) {
      return new Date(horaCompleta).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false })
    }
    if (horaCompleta.includes(':')) return horaCompleta.substring(0, 5)
    return horaCompleta
  }

  const cargarDatos = async () => {
    setLoading(true)
    try {
      const [empResult, rolesResult, motivosResult, motivosValesResult] = await Promise.all([
        empleadosService.getEmpleadosPorLocal(localId),
        rolesService.getRoles(),
        motivosAusenciaService.getMotivos(),
        motivosValesService.getMotivos()
      ])
      if (empResult.success) setEmpleados(empResult.data)
      if (rolesResult.success) setRoles(rolesResult.data)
      if (motivosResult.success) setMotivos(motivosResult.data)
      if (motivosValesResult.success) setMotivosVales(motivosValesResult.data)
      await cargarRegistrosHoy()
      await cargarValesYAusenciasHoy()
    } catch (error) {
      console.error('Error al cargar datos:', error)
    } finally {
      setLoading(false)
    }
  }

  const cargarRegistrosHoy = async () => {
    const result = await registrosService.getRegistrosDelDia(localId)
    if (result.success) setRegistrosHoy(result.data)
  }

  const cargarValesYAusenciasHoy = async () => {
    const [valesResult, ausenciasResult] = await Promise.all([
      valesService.getValesDelDia(localId),
      ausenciasService.getAusenciasDelDia(localId)
    ])
    if (valesResult.success) setValesHoy(valesResult.data)
    if (ausenciasResult.success) setAusenciasHoy(ausenciasResult.data)
  }

  // ── Filtrado de sugerencias ───────────────────────────────────────────────
  const empleadosFiltrados = empleados.filter(emp =>
    `${emp.nombre} ${emp.apellido}`.toLowerCase().includes(busqueda.toLowerCase())
  ).slice(0, 10)

  const handleBusquedaChange = (e) => {
    setBusqueda(e.target.value)
    setMostrarSugerencias(e.target.value.length > 0)
    setIndiceSugerencia(0)
  }

  const handleBusquedaKeyDown = (e) => {
    if (!mostrarSugerencias || empleadosFiltrados.length === 0) return
    switch(e.key) {
      case 'ArrowDown': e.preventDefault(); setIndiceSugerencia(p => p < empleadosFiltrados.length - 1 ? p + 1 : 0); break
      case 'ArrowUp':   e.preventDefault(); setIndiceSugerencia(p => p > 0 ? p - 1 : empleadosFiltrados.length - 1); break
      case 'Enter':     e.preventDefault(); if (empleadosFiltrados[indiceSugerencia]) seleccionarEmpleado(empleadosFiltrados[indiceSugerencia]); break
      case 'Escape':    setMostrarSugerencias(false); break
    }
  }

  const seleccionarEmpleado = (empleado) => {
    setEmpleadoSeleccionado(empleado)
    setBusqueda(`${empleado.nombre} ${empleado.apellido}`)
    setMostrarSugerencias(false)
    setModalRol(true)
    setIndiceRol(0)
  }

  const handleRolKeyDown = (e) => {
    switch(e.key) {
      case 'ArrowDown': e.preventDefault(); setIndiceRol(p => p < roles.length - 1 ? p + 1 : 0); break
      case 'ArrowUp':   e.preventDefault(); setIndiceRol(p => p > 0 ? p - 1 : roles.length - 1); break
      case 'Enter':     e.preventDefault(); if (roles[indiceRol]) seleccionarRol(roles[indiceRol]); break
      case 'Escape':    setModalRol(false); break
    }
  }

  const seleccionarRol = (rol) => {
    setRolSeleccionado(rol)
    setModalRol(false)
    setTimeout(() => botonIngresoRef.current?.focus(), 100)
  }

  // ── Acciones ─────────────────────────────────────────────────────────────
  const registrarEntrada = async () => {
    if (!empleadoSeleccionado || !rolSeleccionado) {
      onAlert({ type: 'error', message: 'Selecciona empleado y rol' }); return
    }
    setLoading(true)
    try {
      const result = await registrosService.registrarEntrada(empleadoSeleccionado.id, localId, rolSeleccionado.id, '')
      if (result.success) {
        onAlert({ type: 'success', message: 'Entrada registrada correctamente' })
        setBusqueda(''); setEmpleadoSeleccionado(null); setRolSeleccionado(null)
        await cargarRegistrosHoy()
        if (onUpdate) onUpdate()
        inputBusquedaRef.current?.focus()
      } else {
        onAlert({ type: 'error', message: result.error })
      }
    } catch { onAlert({ type: 'error', message: 'Error al registrar entrada' }) }
    finally { setLoading(false) }
  }

  const registrarSalida = async (registroId) => {
    if (!window.confirm('¿Confirmar salida del empleado?')) return
    setLoading(true)
    try {
      const result = await registrosService.registrarSalida(registroId)
      if (result.success) {
        onAlert({ type: 'success', message: 'Salida registrada correctamente' })
        await cargarRegistrosHoy()
        if (onUpdate) onUpdate()
      } else { onAlert({ type: 'error', message: result.error }) }
    } catch { onAlert({ type: 'error', message: 'Error al registrar salida' }) }
    finally { setLoading(false) }
  }

  const [modalFranco, setModalFranco] = useState(null) // { registroId, empleadoNombre, valorActual }

  const marcarFranco = (registroId, valorActual, empleadoNombre) => {
    if (valorActual) {
      // Si ya está marcado, desmarcar directo sin confirmar
      ejecutarMarcarFranco(registroId, false)
    } else {
      // Si va a marcarse, pedir confirmación
      setModalFranco({ registroId, empleadoNombre, valorActual })
    }
  }

  const ejecutarMarcarFranco = async (registroId, nuevoValor) => {
    const valorActual = !nuevoValor
    setModalFranco(null)
    // Optimistic update local
    setRegistrosHoy(prev => prev.map(r =>
      r.id === registroId ? { ...r, es_franco: nuevoValor } : r
    ))
    const result = await registrosService.marcarFrancoTrabajado(registroId, nuevoValor)
    if (!result.success) {
      // Revertir si falló
      setRegistrosHoy(prev => prev.map(r =>
        r.id === registroId ? { ...r, es_franco: valorActual } : r
      ))
      onAlert({ type: 'error', message: 'Error al actualizar estado de franco' })
    } else {
      onAlert({
        type: nuevoValor ? 'success' : 'info',
        message: nuevoValor ? '🗓️ Franco trabajado marcado correctamente' : 'Franco trabajado desmarcado'
      })
    }
  }

  const imprimirVale = (valeData) => {
    const { empleado, importe, motivo, concepto, localNombre, fecha } = valeData
    const fechaFormateada = new Date(fecha + 'T12:00:00').toLocaleDateString('es-AR', {
      day: '2-digit', month: '2-digit', year: 'numeric'
    })
    const importeFormateado = `$${Math.round(importe).toLocaleString('es-AR')}`

    const ventana = window.open('', '', 'width=340,height=600')
    ventana.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Vale</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;600;700&display=swap');
    @page { size: 80mm auto; margin: 0; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'IBM Plex Mono', 'Courier New', monospace;
      width: 72mm;
      padding: 4mm 3mm;
      background: #fff;
      color: #000;
      font-size: 9pt;
      font-weight: 700;
      line-height: 1.35;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .encabezado {
      text-align: center;
      border-bottom: 2px solid #000;
      padding-bottom: 3mm;
      margin-bottom: 3mm;
    }
    .titulo {
      font-size: 13pt;
      font-weight: 700;
      letter-spacing: 0.12em;
      text-transform: uppercase;
    }
    .subtitulo {
      font-size: 8pt;
      font-weight: 700;
      letter-spacing: 0.08em;
      color: #000;
      margin-top: 1mm;
    }
    .local-nombre {
      font-size: 9pt;
      font-weight: 700;
      letter-spacing: 0.05em;
      margin-top: 1.5mm;
    }
    .fecha-linea {
      font-size: 11pt;
      font-weight: 700;
      color: #000;
      margin-top: 1mm;
    }
    .separador {
      border: none;
      border-top: 1px dashed #999;
      margin: 2.5mm 0;
    }
    .separador-solido {
      border: none;
      border-top: 2px solid #000;
      margin: 2.5mm 0;
    }
    .campo-label {
      font-size: 7.5pt;
      font-weight: 700;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: #000;
      margin-bottom: 0.5mm;
    }
    .campo-valor {
      font-size: 13pt;
      font-weight: 700;
      letter-spacing: -0.01em;
      line-height: 1.2;
      word-break: break-word;
    }
    .campo-valor.motivo {
      font-size: 11pt;
    }
    .campo-bloque {
      margin-bottom: 3mm;
    }
    .importe-bloque {
      background: #fff;
      color: #000;
      text-align: center;
      padding: 3mm 2mm;
      border: 2px solid #000;
      border-radius: 1mm;
      margin: 3mm 0;
    }
    .importe-label {
      font-size: 7.5pt;
      font-weight: 700;
      letter-spacing: 0.15em;
      text-transform: uppercase;
      margin-bottom: 1mm;
    }
    .importe-valor {
      font-size: 26pt;
      font-weight: 700;
      letter-spacing: -0.02em;
      line-height: 1;
    }
    .obs-bloque {
      margin-top: 3mm;
    }
    .obs-valor {
      font-size: 8.5pt;
      font-weight: 700;
      color: #000;
      word-break: break-word;
      line-height: 1.4;
    }
    .firma-zona {
      margin-top: 18mm;
      text-align: center;
    }
    .firma-linea {
      border-top: 1px solid #000;
      width: 55mm;
      margin: 0 auto 1.5mm;
    }
    .firma-label {
      font-size: 7.5pt;
      font-weight: 700;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: #000;
    }
    .pie {
      text-align: center;
      margin-top: 4mm;
      padding-top: 2.5mm;
      border-top: 1px dashed #999;
      font-size: 7pt;
      font-weight: 700;
      color: #333;
      letter-spacing: 0.08em;
    }
  </style>
</head>
<body>
  <div class="encabezado">
    <div class="titulo">VALE DE CAJA</div>
    <div class="subtitulo">COMPROBANTE INTERNO</div>
    <div class="local-nombre">${localNombre.toUpperCase()}</div>
    <div class="fecha-linea">${fechaFormateada}</div>
  </div>

  <div class="campo-bloque">
    <div class="campo-label">Empleado</div>
    <div class="campo-valor">${empleado}</div>
  </div>

  <hr class="separador"/>

  <div class="campo-bloque">
    <div class="campo-label">Motivo</div>
    <div class="campo-valor motivo">${motivo}</div>
  </div>

  ${concepto ? `
  <div style="border-top:1px dashed #bbb;margin:2.5mm 0;"></div>
  <div class="obs-bloque">
    <div class="campo-label">Observaciones</div>
    <div class="obs-valor">${concepto}</div>
  </div>` : ''}

  <hr class="separador-solido"/>

  <div class="importe-bloque">
    <div class="importe-label">Importe recibido</div>
    <div class="importe-valor">${importeFormateado}</div>
  </div>

  <div class="firma-zona">
    <div class="firma-linea"></div>
    <div class="firma-label">Firma y aclaración</div>
  </div>

  <div class="pie">SmartDom · smartdom.io</div>
</body>
</html>`)
    ventana.document.close()
    setTimeout(() => { ventana.print(); ventana.close() }, 350)
  }

  const registrarVale = async () => {
    if (!empleadoSeleccionadoVale || !formVale.motivoId || !formVale.importe) {
      onAlert({ type: 'error', message: 'Completá empleado, motivo e importe' }); return
    }
    setLoading(true)
    try {
      const motivoObj = motivosVales.find(m => m.id === formVale.motivoId)
      const result = await valesService.registrarVale({
        empleado_id: empleadoSeleccionadoVale.id,
        local_id: localId,
        motivo_id: formVale.motivoId,
        importe: parseInt(formVale.importe),
        concepto: formVale.concepto
      })
      if (result.success) {
        onAlert({ type: 'success', message: 'Vale registrado correctamente' })
        // Imprimir vale
        const { localesService } = await import('../../services/catalogosService')
        const localResult = await localesService.getLocalById(localId)
        imprimirVale({
          empleado: `${empleadoSeleccionadoVale.nombre} ${empleadoSeleccionadoVale.apellido}`,
          importe: parseInt(formVale.importe),
          motivo: motivoObj?.motivo || '',
          concepto: formVale.concepto,
          localNombre: localResult.success ? localResult.data.nombre : '',
          fecha: new Date().toISOString().split('T')[0]
        })
        setModalVale(false)
        setBusquedaVale(''); setEmpleadoSeleccionadoVale(null)
        setFormVale({ empleadoId: '', motivoId: '', importe: '', concepto: '' })
        await cargarValesYAusenciasHoy()
        if (onUpdate) onUpdate()
      } else { onAlert({ type: 'error', message: result.error }) }
    } catch { onAlert({ type: 'error', message: 'Error al registrar vale' }) }
    finally { setLoading(false) }
  }

  const registrarAusencia = async () => {
    if (!empleadoSeleccionadoAusencia || !formAusencia.motivoId) {
      onAlert({ type: 'error', message: 'Seleccioná empleado y motivo' }); return
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
        setBusquedaAusencia(''); setEmpleadoSeleccionadoAusencia(null)
        setFormAusencia({ empleadoId: '', motivoId: '', observaciones: '' })
        await cargarValesYAusenciasHoy()
        if (onUpdate) onUpdate()
      } else { onAlert({ type: 'error', message: result.error }) }
    } catch { onAlert({ type: 'error', message: 'Error al registrar ausencia' }) }
    finally { setLoading(false) }
  }

  // ── Eliminar vale (solo si es eliminable) ────────────────────────────────
  const handleEliminarVale = async (vale) => {
    if (!vale.eliminable) return
    if (!window.confirm(`¿Eliminar el vale de $${Math.round(vale.importe).toLocaleString('es-AR')} de ${vale.empleado.nombre} ${vale.empleado.apellido}?`)) return
    setLoading(true)
    try {
      const result = await valesService.eliminarVale(vale.id)
      if (result.success) {
        onAlert({ type: 'success', message: 'Vale eliminado correctamente' })
        await cargarValesYAusenciasHoy()
        if (onUpdate) onUpdate()
      } else { onAlert({ type: 'error', message: result.error }) }
    } catch { onAlert({ type: 'error', message: 'Error al eliminar vale' }) }
    finally { setLoading(false) }
  }

  // ── Eliminar ausencia (solo si es eliminable) ────────────────────────────
  const handleEliminarAusencia = async (ausencia) => {
    if (!ausencia.eliminable) return
    if (!window.confirm(`¿Eliminar la ausencia de ${ausencia.empleado.nombre} ${ausencia.empleado.apellido}?`)) return
    setLoading(true)
    try {
      const result = await ausenciasService.eliminarAusencia(ausencia.id)
      if (result.success) {
        onAlert({ type: 'success', message: 'Ausencia eliminada correctamente' })
        await cargarValesYAusenciasHoy()
        if (onUpdate) onUpdate()
      } else { onAlert({ type: 'error', message: result.error }) }
    } catch { onAlert({ type: 'error', message: 'Error al eliminar ausencia' }) }
    finally { setLoading(false) }
  }

  const handleGuardarObservaciones = async () => {
    const result = await observacionesTurnoService.guardarObservacion(localId, observacionesInternas)
    if (result.success) {
      if (onObservacionesChange) onObservacionesChange(observacionesInternas)
      onAlert({ type: 'success', message: 'Observaciones guardadas' })
      setModalObservaciones(false)
    } else {
      onAlert({ type: 'error', message: 'Error al guardar observaciones' })
    }
  }

  if (loading) {
    return <div className="flex justify-center items-center py-12"><LoadingSpinner /></div>
  }

  return (
    <div className="space-y-6">
      {/* ── Búsqueda e ingreso ────────────────────────────────────────────── */}
      <div className="card">
        <h3 className="text-xl font-bold text-dark mb-4">Control de Horarios</h3>

        {/* ── Identificación biométrica ─────────────────────────────────── */}
        <div className="mb-4">
          <IdentificacionBiometrica
            localId={localId}
            onRegistrado={async () => {
              await cargarRegistrosHoy()
              if (onUpdate) onUpdate()
            }}
            onAlert={onAlert}
          />
          <div className="flex items-center gap-3 my-4">
            <div className="flex-1 border-t border-gray-200" />
            <span className="text-xs text-gray-400 font-medium uppercase tracking-wide">o búsqueda manual</span>
            <div className="flex-1 border-t border-gray-200" />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2 relative">
            <label className="label">Nombre y Apellido</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                ref={inputBusquedaRef} type="text" value={busqueda}
                onChange={handleBusquedaChange} onKeyDown={handleBusquedaKeyDown}
                onFocus={() => busqueda && setMostrarSugerencias(true)}
                className="input-field pl-10" placeholder="Buscar empleado..." autoFocus
              />
            </div>
            {mostrarSugerencias && empleadosFiltrados.length > 0 && (
              <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                {empleadosFiltrados.map((emp, index) => (
                  <div key={emp.id} onClick={() => seleccionarEmpleado(emp)}
                    className={`px-4 py-3 cursor-pointer transition-colors ${index === indiceSugerencia ? 'bg-primary/10 text-primary' : 'hover:bg-gray-50'}`}>
                    <p className="font-medium">{emp.nombre} {emp.apellido}</p>
                    <p className="text-sm text-gray-600">{emp.documento}</p>
                  </div>
                ))}
              </div>
            )}
            {empleadoSeleccionado && rolSeleccionado && (
              <div className="mt-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-sm text-green-900">
                  <span className="font-medium">{empleadoSeleccionado.nombre} {empleadoSeleccionado.apellido}</span>
                  {' '}- {rolSeleccionado.nombre}
                </p>
              </div>
            )}
          </div>
          <div className="flex items-end">
            <button ref={botonIngresoRef} onClick={registrarEntrada}
              disabled={!empleadoSeleccionado || !rolSeleccionado || loading}
              className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-6 px-6 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg flex items-center justify-center gap-3 text-xl">
              <UserPlus className="w-7 h-7" /><span>INGRESO</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── Botones de acción ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: 'ENTREGA DE VALES', icon: DollarSign, onClick: () => setModalVale(true) },
          { label: 'REGISTRO DE AUSENTES', icon: UserMinus, onClick: () => setModalAusencia(true) },
          { label: 'OBSERVACIONES', icon: FileText, onClick: () => setModalObservaciones(true), badge: observaciones?.trim() }
        ].map(({ label, icon: Icon, onClick, badge }) => (
          <button key={label} onClick={onClick}
            className="font-bold py-4 px-6 rounded-lg transition-colors flex items-center justify-center gap-2 shadow-lg relative"
            style={{ backgroundColor: '#C9981D', color: '#1F2937' }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#B38819'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#C9981D'}>
            <Icon className="w-6 h-6" /><span>{label}</span>
            {badge && (
              <span className="absolute -top-2 -right-2 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center text-white text-xs font-bold">✓</span>
            )}
          </button>
        ))}
      </div>

      {observaciones?.trim() && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-2 flex items-start gap-2">
          <FileText className="w-4 h-4 text-yellow-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-yellow-800">
            <span className="font-semibold">Observaciones guardadas:</span>{' '}
            {observaciones.length > 100 ? observaciones.substring(0, 100) + '…' : observaciones}
          </p>
        </div>
      )}

      {/* ── Registros del día ─────────────────────────────────────────────── */}
      <div className="card">
        <h3 className="text-lg font-bold text-dark mb-4">Registros del Día</h3>
        {registrosHoy.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No hay registros hoy</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-gray-50">
                <tr>
                  {['Empleado','Rol','Entrada','Salida','Horas','Franco Trabajado','Acción'].map(h => (
                    <th key={h} className={`px-4 py-3 text-sm font-medium text-gray-600 ${h === 'Acción' || h === 'Franco Trabajado' ? 'text-center' : 'text-left'}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {registrosHoy.map((registro) => (
                  <tr key={registro.id} className={`transition-colors ${registro.es_franco ? 'bg-rose-50 hover:bg-rose-100/60' : 'hover:bg-gray-50'}`}>
                    <td className="px-4 py-3 text-sm">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium">{registro.empleado.nombre} {registro.empleado.apellido}</span>
                        {registro.es_franco && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-semibold bg-[#7B1C2E] text-white border border-[#5a1221]">
                            🗓️ Franco Trabajado
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{registro.rol.nombre}</td>
                    <td className="px-4 py-3 text-sm font-medium text-primary">{formatearHora(registro.hora_entrada)}</td>
                    <td className="px-4 py-3 text-sm">
                      {registro.hora_salida
                        ? <span className="text-gray-900">{formatearHora(registro.hora_salida)}</span>
                        : <span className="text-green-600 font-medium">EN TURNO</span>}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{registro.horas_trabajadas || '-'}</td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => marcarFranco(registro.id, registro.es_franco || false, `${registro.empleado.nombre} ${registro.empleado.apellido}`)}
                        title={registro.es_franco ? 'Quitar Franco Trabajado' : 'Marcar como Franco Trabajado'}
                        className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
                          registro.es_franco
                            ? 'bg-[#7B1C2E] border-[#5a1221] text-white hover:bg-[#6a1828]'
                            : 'bg-gray-100 border-gray-200 text-gray-400 hover:bg-gray-200 hover:text-gray-600'
                        }`}
                      >
                        {registro.es_franco
                          ? <><ToggleRight className="w-4 h-4" /> Franco Trabajado</>
                          : <><ToggleLeft className="w-4 h-4" /> Franco Trabajado</>
                        }
                      </button>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {!registro.hora_salida && (
                        <button onClick={() => registrarSalida(registro.id)} className="btn-icon text-red-600 hover:bg-red-50" title="Registrar salida">
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

      {/* ── Vales del día ─────────────────────────────────────────────────── */}
      <div className="card">
        <h3 className="text-lg font-bold text-dark mb-4 flex items-center gap-2">
          <DollarSign className="w-5 h-5 text-secondary" />
          Vales del Día
          <span className="ml-auto text-sm font-normal text-gray-500">
            {valesHoy.length} vale{valesHoy.length !== 1 ? 's' : ''}
            {valesHoy.length > 0 && (
              <span className="ml-2 font-semibold text-secondary">
                — Total: ${valesHoy.reduce((s, v) => s + parseInt(v.importe, 10), 0).toLocaleString('es-AR')}
              </span>
            )}
          </span>
        </h3>
        {valesHoy.length === 0 ? (
          <p className="text-gray-400 text-sm text-center py-4">Sin vales registrados en el turno actual</p>
        ) : (
          <div className="space-y-2">
            {valesHoy.map((vale) => (
              <div key={vale.id} className={`flex items-center justify-between p-3 rounded-lg border ${vale.eliminable ? 'bg-white border-gray-200' : 'bg-gray-50 border-gray-100'}`}>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-dark truncate">{vale.empleado.nombre} {vale.empleado.apellido}</p>
                  <p className="text-xs text-gray-500">{vale.motivo?.motivo || vale.concepto}</p>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0 ml-3">
                  <span className="text-sm font-bold text-secondary">${Math.round(vale.importe).toLocaleString('es-AR')}</span>
                  {vale.eliminable ? (
                    <button onClick={() => handleEliminarVale(vale)} disabled={loading}
                      className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="Eliminar vale">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  ) : (
                    <span className="p-1.5 text-gray-300" title="No se puede eliminar: ya fue incluido en un reporte">
                      <Lock className="w-4 h-4" />
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
        {valesHoy.some(v => !v.eliminable) && (
          <p className="text-xs text-gray-400 mt-3 flex items-center gap-1">
            <Lock className="w-3 h-3" /> Los vales bloqueados ya fueron incluidos en un reporte anterior y no pueden modificarse.
          </p>
        )}
      </div>

      {/* ── Ausencias del día ─────────────────────────────────────────────── */}
      <div className="card">
        <h3 className="text-lg font-bold text-dark mb-4 flex items-center gap-2">
          <UserMinus className="w-5 h-5 text-red-500" />
          Ausencias del Día
          <span className="ml-auto text-sm font-normal text-gray-500">
            {ausenciasHoy.length} ausencia{ausenciasHoy.length !== 1 ? 's' : ''}
          </span>
        </h3>
        {ausenciasHoy.length === 0 ? (
          <p className="text-gray-400 text-sm text-center py-4">Sin ausencias registradas en el turno actual</p>
        ) : (
          <div className="space-y-2">
            {ausenciasHoy.map((ausencia) => (
              <div key={ausencia.id} className={`flex items-center justify-between p-3 rounded-lg border ${ausencia.eliminable ? 'bg-white border-gray-200' : 'bg-gray-50 border-gray-100'}`}>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-dark truncate">{ausencia.empleado.nombre} {ausencia.empleado.apellido}</p>
                  <p className="text-xs text-gray-500">{ausencia.motivo.motivo}</p>
                  {ausencia.observaciones && <p className="text-xs text-gray-400 mt-0.5">{ausencia.observaciones}</p>}
                </div>
                <div className="flex items-center gap-3 flex-shrink-0 ml-3">
                  {ausencia.eliminable ? (
                    <button onClick={() => handleEliminarAusencia(ausencia)} disabled={loading}
                      className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="Eliminar ausencia">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  ) : (
                    <span className="p-1.5 text-gray-300" title="No se puede eliminar: ya fue incluida en un reporte">
                      <Lock className="w-4 h-4" />
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
        {ausenciasHoy.some(a => !a.eliminable) && (
          <p className="text-xs text-gray-400 mt-3 flex items-center gap-1">
            <Lock className="w-3 h-3" /> Las ausencias bloqueadas ya fueron incluidas en un reporte anterior y no pueden modificarse.
          </p>
        )}
      </div>

      {/* ── Modal Rol ─────────────────────────────────────────────────────── */}
      <Modal isOpen={modalRol} onClose={() => setModalRol(false)} title="Seleccionar Rol">
        <div ref={modalRolRef} className="space-y-2 outline-none" onKeyDown={handleRolKeyDown} tabIndex={0}>
          <p className="text-sm text-gray-600 mb-4">Use las flechas ↑↓ y Enter para seleccionar</p>
          {roles.map((rol, index) => (
            <div key={rol.id} onClick={() => seleccionarRol(rol)}
              className={`p-3 rounded-lg cursor-pointer transition-colors ${index === indiceRol ? 'bg-primary text-white' : 'bg-gray-50 hover:bg-gray-100'}`}>
              <p className="font-medium">{rol.nombre}</p>
            </div>
          ))}
        </div>
      </Modal>

      {/* ── Modal Vale ────────────────────────────────────────────────────── */}
      <Modal isOpen={modalVale}
        onClose={() => { setModalVale(false); setBusquedaVale(''); setEmpleadoSeleccionadoVale(null); setMostrarSugerenciasVale(false) }}
        title="Registrar Vale">
        <div className="space-y-4">
          <div className="relative">
            <label className="label">Empleado</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input type="text" value={busquedaVale}
                onChange={(e) => { setBusquedaVale(e.target.value); setMostrarSugerenciasVale(e.target.value.length > 0); if (!e.target.value) setEmpleadoSeleccionadoVale(null) }}
                onFocus={() => busquedaVale && setMostrarSugerenciasVale(true)}
                className="input-field pl-10" placeholder="Buscar por nombre o apellido..." />
            </div>
            {mostrarSugerenciasVale && busquedaVale && (
              <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                {empleados.filter(emp => `${emp.nombre} ${emp.apellido}`.toLowerCase().includes(busquedaVale.toLowerCase())).slice(0, 10).map(emp => (
                  <div key={emp.id} onClick={() => { setEmpleadoSeleccionadoVale(emp); setBusquedaVale(`${emp.nombre} ${emp.apellido}`); setMostrarSugerenciasVale(false) }}
                    className="px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors">
                    <p className="font-medium">{emp.nombre} {emp.apellido}</p>
                    <p className="text-sm text-gray-600">{emp.documento}</p>
                  </div>
                ))}
              </div>
            )}
            {empleadoSeleccionadoVale && (
              <div className="mt-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-sm text-green-900 font-medium">{empleadoSeleccionadoVale.nombre} {empleadoSeleccionadoVale.apellido}</p>
              </div>
            )}
          </div>
          <div>
            <label className="label">Motivo</label>
            <select value={formVale.motivoId} onChange={(e) => setFormVale({ ...formVale, motivoId: e.target.value })} className="select-field">
              <option value="">Seleccionar motivo</option>
              {motivosVales.map(m => <option key={m.id} value={m.id}>{m.motivo}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Importe</label>
            <input type="number" step="1" min="1" value={formVale.importe}
              onChange={(e) => setFormVale({ ...formVale, importe: Math.trunc(Number(e.target.value)) || '' })}
              className="input-field" placeholder="0" />
          </div>
          <div>
            <label className="label">Concepto (opcional)</label>
            <textarea value={formVale.concepto} onChange={(e) => setFormVale({ ...formVale, concepto: e.target.value })}
              className="input-field" rows="3" placeholder="Detalles adicionales..." />
          </div>
          <button onClick={registrarVale} disabled={loading} className="btn-primary w-full">Registrar Vale</button>
        </div>
      </Modal>

      {/* ── Modal Ausencia ────────────────────────────────────────────────── */}
      <Modal isOpen={modalAusencia}
        onClose={() => { setModalAusencia(false); setBusquedaAusencia(''); setEmpleadoSeleccionadoAusencia(null); setMostrarSugerenciasAusencia(false) }}
        title="Registrar Ausencia">
        <div className="space-y-4">
          <div className="relative">
            <label className="label">Empleado</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input type="text" value={busquedaAusencia}
                onChange={(e) => { setBusquedaAusencia(e.target.value); setMostrarSugerenciasAusencia(e.target.value.length > 0); if (!e.target.value) setEmpleadoSeleccionadoAusencia(null) }}
                onFocus={() => busquedaAusencia && setMostrarSugerenciasAusencia(true)}
                className="input-field pl-10" placeholder="Buscar por nombre o apellido..." />
            </div>
            {mostrarSugerenciasAusencia && busquedaAusencia && (
              <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                {empleados.filter(emp => `${emp.nombre} ${emp.apellido}`.toLowerCase().includes(busquedaAusencia.toLowerCase())).slice(0, 10).map(emp => (
                  <div key={emp.id} onClick={() => { setEmpleadoSeleccionadoAusencia(emp); setBusquedaAusencia(`${emp.nombre} ${emp.apellido}`); setMostrarSugerenciasAusencia(false) }}
                    className="px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors">
                    <p className="font-medium">{emp.nombre} {emp.apellido}</p>
                    <p className="text-sm text-gray-600">{emp.documento}</p>
                  </div>
                ))}
              </div>
            )}
            {empleadoSeleccionadoAusencia && (
              <div className="mt-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-sm text-green-900 font-medium">{empleadoSeleccionadoAusencia.nombre} {empleadoSeleccionadoAusencia.apellido}</p>
              </div>
            )}
          </div>
          <div>
            <label className="label">Motivo</label>
            <select value={formAusencia.motivoId} onChange={(e) => setFormAusencia({ ...formAusencia, motivoId: e.target.value })} className="select-field">
              <option value="">Seleccionar motivo</option>
              {motivos.map(m => <option key={m.id} value={m.id}>{m.motivo}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Observaciones (opcional)</label>
            <textarea value={formAusencia.observaciones} onChange={(e) => setFormAusencia({ ...formAusencia, observaciones: e.target.value })}
              className="input-field" rows="3" placeholder="Detalles adicionales..." />
          </div>
          <button onClick={registrarAusencia} disabled={loading} className="btn-primary w-full">Registrar Ausencia</button>
        </div>
      </Modal>

      {/* ── Modal Observaciones ───────────────────────────────────────────── */}
      <Modal isOpen={modalObservaciones} onClose={() => setModalObservaciones(false)} title="Observaciones del Turno">
        <div className="space-y-4">
          <div>
            <label className="label">Observaciones Generales</label>
            <textarea value={observacionesInternas} onChange={(e) => setObservacionesInternas(e.target.value)}
              className="input-field" rows="6" placeholder="Anota aquí cualquier observación relevante del turno..." />
            <p className="text-xs text-gray-500 mt-2">Estas observaciones se incluirán en el cierre de turno</p>
          </div>
          <button onClick={handleGuardarObservaciones} className="btn-primary w-full">Guardar Observaciones</button>
        </div>
      </Modal>

      {/* ── Modal Confirmación Franco Trabajado ───────────────────────────── */}
      {modalFranco && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4"
          onClick={() => setModalFranco(null)}>
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full animate-slide-in"
            onClick={e => e.stopPropagation()}>
            {/* Header bordó */}
            <div className="flex items-center gap-3 px-6 py-5 rounded-t-xl" style={{ backgroundColor: '#7B1C2E' }}>
              <span className="text-2xl">🗓️</span>
              <h2 className="text-lg font-bold text-white">Franco Trabajado</h2>
            </div>
            {/* Cuerpo */}
            <div className="px-6 py-6 space-y-4">
              <p className="text-gray-700 text-sm leading-relaxed">
                Usted está confirmando que el empleado:
              </p>
              <div className="bg-rose-50 border border-rose-200 rounded-lg px-4 py-3">
                <p className="font-bold text-gray-900 text-base">{modalFranco.empleadoNombre}</p>
              </div>
              <p className="text-gray-700 text-sm leading-relaxed">
                está trabajando en su <span className="font-semibold text-gray-900">día de franco</span>. Esta acción quedará registrada en el sistema y se verá reflejada en los reportes de RRHH.
              </p>
            </div>
            {/* Botones */}
            <div className="flex gap-3 px-6 pb-6">
              <button
                onClick={() => setModalFranco(null)}
                className="flex-1 btn-outline"
              >
                Cancelar
              </button>
              <button
                onClick={() => ejecutarMarcarFranco(modalFranco.registroId, true)}
                className="flex-1 text-white font-bold py-3 px-6 rounded-lg transition-colors"
                style={{ backgroundColor: '#7B1C2E' }}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = '#6a1828'}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = '#7B1C2E'}
              >
                Confirmar Franco Trabajado
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default RegistroHorarios

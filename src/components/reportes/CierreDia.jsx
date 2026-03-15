import React, { useState, useEffect } from 'react'
import { FileText, Download, Eye, CheckCircle, AlertCircle, ClipboardList, Users } from 'lucide-react'
import { cierreDiaService } from '../../services/cierreDiaService'
import { reporteEstadoService } from '../../services/reporteEstadoService'
import { registrosService } from '../../services/registrosService'
import LoadingSpinner from '../common/LoadingSpinner'
import Modal from '../common/Modal'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

const CierreDia = ({ localId, localNombre, onAlert, onCierreExitoso, observacionesIniciales = '' }) => {
  const [loading, setLoading] = useState(false)
  const [datosReporte, setDatosReporte] = useState(null)
  const [observaciones, setObservaciones] = useState(observacionesIniciales)
  const [cierresAnteriores, setCierresAnteriores] = useState([])
  const [modalConfirmacion, setModalConfirmacion] = useState(false)

  // Estados de validación previas al cierre
  const [validaciones, setValidaciones] = useState({
    reporteGenerado: false,
    sinPersonalActivo: false,
    cargando: true
  })

  useEffect(() => {
    cargarCierresAnteriores()
    verificarCondicionesCierre()
  }, [localId])

  useEffect(() => {
    setObservaciones(observacionesIniciales)
  }, [observacionesIniciales])

  const verificarCondicionesCierre = async () => {
    setValidaciones(prev => ({ ...prev, cargando: true }))
    try {
      const hoy = format(new Date(), 'yyyy-MM-dd')

      // 1. Verificar si existe al menos un reporte de estado generado hoy
      const reportesResult = await reporteEstadoService.getReportes(localId, hoy, hoy)
      const tieneReporte = reportesResult.success && reportesResult.data.length > 0

      // 2. Verificar si hay personal sin registrar salida
      const turnoResult = await registrosService.getEmpleadosEnTurno(localId)
      const personalActivo = turnoResult.success ? turnoResult.data.length : 0

      setValidaciones({
        reporteGenerado: tieneReporte,
        sinPersonalActivo: personalActivo === 0,
        personalActivoCount: personalActivo,
        cargando: false
      })
    } catch (error) {
      setValidaciones({ reporteGenerado: false, sinPersonalActivo: false, personalActivoCount: 0, cargando: false })
    }
  }

  const cargarCierresAnteriores = async () => {
    const result = await cierreDiaService.getCierres(localId)
    if (result.success) {
      setCierresAnteriores(result.data.slice(0, 5))
    }
  }

  const generarVistaPrevia = async () => {
    // Verificar condiciones antes de proceder
    await verificarCondicionesCierre()

    if (!validaciones.reporteGenerado) {
      onAlert({ type: 'error', message: '⚠️ Debés generar el Reporte de Estado antes de realizar el cierre del día.' })
      return
    }

    if (!validaciones.sinPersonalActivo) {
      onAlert({ 
        type: 'error', 
        message: `⚠️ Hay ${validaciones.personalActivoCount} empleado(s) sin registrar salida. Registrá la salida de todos antes de cerrar el día.` 
      })
      return
    }

    setLoading(true)
    try {
      const result = await cierreDiaService.generarDatosCierre(localId)
      
      if (result.success) {
        setDatosReporte(result.data)
        onAlert({ type: 'success', message: 'Vista previa generada correctamente' })
      } else {
        onAlert({ type: 'error', message: result.error })
      }
    } catch (error) {
      onAlert({ type: 'error', message: 'Error al generar vista previa' })
    } finally {
      setLoading(false)
    }
  }

  const abrirConfirmacion = () => {
    if (!datosReporte) {
      onAlert({ type: 'warning', message: 'Primero generá la vista previa del cierre' })
      return
    }
    setModalConfirmacion(true)
  }

  const confirmarCierre = async () => {
    setLoading(true)
    try {
      const result = await cierreDiaService.cerrarDia(localId, observaciones)
      
      if (result.success) {
        onAlert({ type: 'success', message: '✅ Día cerrado correctamente. Los valores se han reiniciado.' })
        setDatosReporte(null)
        setObservaciones('')
        setModalConfirmacion(false)
        await cargarCierresAnteriores()
        
        if (onCierreExitoso) {
          onCierreExitoso()
        }
      } else {
        onAlert({ type: 'error', message: result.error })
      }
    } catch (error) {
      onAlert({ type: 'error', message: 'Error al cerrar día' })
    } finally {
      setLoading(false)
    }
  }

  const descargarReporte = (cierre) => {
    const contenido = generarContenidoReporte(cierre)
    const blob = new Blob([contenido], { type: 'text/plain;charset=utf-8' })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `cierre_dia_${format(new Date(cierre.fecha), 'yyyy-MM-dd')}.txt`
    link.click()
    window.URL.revokeObjectURL(url)
  }

  const generarContenidoReporte = (cierre) => {
    const datos = cierre.reporte_json || cierre
    const ancho = 42
    const centrar = (texto) => {
      const espacios = Math.max(0, Math.floor((ancho - texto.length) / 2))
      return ' '.repeat(espacios) + texto
    }
    const linea = (char = '-') => char.repeat(ancho)
    const formatoPrecio = (valor) => `$${Math.round(valor).toLocaleString('es-AR')}`
    
    let contenido = `
${centrar('═══════════════════════════════════')}
${centrar('CIERRE DEL DÍA')}
${centrar('SmartDom')}
${centrar('═══════════════════════════════════')}

${centrar(localNombre.toUpperCase())}
${centrar(format(new Date(datos.fecha), "dd/MM/yyyy", { locale: es }))}
${centrar(`Cierre: ${format(new Date(cierre.hora_cierre), 'HH:mm')}`)}

${linea('=')}

RESUMEN DEL DÍA
${linea()}
Personal total: ${datos.personal.length}
Activos: ${datos.personalActivo}
Finalizados: ${datos.personalFinalizado}

${linea('=')}

PERSONAL DEL DÍA
${linea()}

${datos.personal.map((p, i) => {
  const entrada = p.horaEntrada.includes('T') ? 
    format(new Date(p.horaEntrada), 'HH:mm') : 
    p.horaEntrada.substring(0, 5)
  const salida = p.horaSalida === 'EN TURNO' ? 
    'EN TURNO' : 
    p.horaSalida.includes('T') ? 
      format(new Date(p.horaSalida), 'HH:mm') : 
      p.horaSalida.substring(0, 5)
  return `${i + 1}. ${p.empleado}
   ${p.rol}
   E: ${entrada} | S: ${salida}${p.observaciones ? `\n   Obs: ${p.observaciones}` : ''}`
}).join('\n\n')}

${linea('=')}

VALES DE CAJA
${linea()}
Cantidad: ${datos.cantidadVales}
TOTAL: ${formatoPrecio(datos.totalVales)}

${datos.vales.length > 0 ? datos.vales.map((v, i) => 
  `${i + 1}. ${v.empleado}\n   ${formatoPrecio(v.importe)} - ${v.motivo || v.concepto}`
).join('\n\n') : 'Sin vales registrados'}

${linea('=')}

AUSENCIAS
${linea()}
Total: ${datos.cantidadAusencias}

${datos.ausencias.length > 0 ? datos.ausencias.map((a, i) => 
  `${i + 1}. ${a.empleado}\n   ${a.motivo}${a.observaciones ? `\n   Obs: ${a.observaciones}` : ''}`
).join('\n\n') : 'Sin ausencias registradas'}

${linea('=')}

OBSERVACIONES GENERALES
${linea()}
${cierre.observaciones_generales || 'Sin observaciones'}

${linea('=')}

Cerrado por: ${cierre.usuario?.nombre} ${cierre.usuario?.apellido}

${centrar('─────────────────────────')}
${centrar('Desarrollado por SmartDom')}
${centrar('smartdom.io')}
${centrar('─────────────────────────')}


`
    return contenido
  }

  // ─── Panel de estado de condiciones ──────────────────────────────────────────
  const puedeGenerarVistaPrevia = validaciones.reporteGenerado && validaciones.sinPersonalActivo

  return (
    <div className="space-y-6">
      {/* Información importante */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-2">
          <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-blue-900">Información del Cierre del Día</p>
            <p className="text-sm text-blue-700 mt-1">
              El cierre del día puede realizarse desde la <strong>01:00 AM hasta las 04:00 AM</strong>.
            </p>
            <p className="text-sm text-blue-700 mt-1">
              El día de trabajo inicia a las <strong>05:00 AM</strong> y puede extenderse hasta las <strong>04:00 AM</strong> del día siguiente.
            </p>
          </div>
        </div>
      </div>

      {/* ── Checklist de condiciones previas al cierre ── */}
      <div className="card">
        <h3 className="text-lg font-bold text-dark mb-4 flex items-center gap-2">
          <CheckCircle className="w-5 h-5 text-gray-400" />
          Condiciones para el Cierre
        </h3>

        {validaciones.cargando ? (
          <div className="flex justify-center py-4">
            <LoadingSpinner size="sm" text="Verificando condiciones..." />
          </div>
        ) : (
          <div className="space-y-3">
            {/* Condición 1: Horario */}
            <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-50">
              <div className="w-6 h-6 flex-shrink-0 flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-gray-400" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-700">Horario permitido</p>
                <p className="text-xs text-gray-500">Entre las 01:00 AM y las 04:00 AM</p>
              </div>
              <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-500 font-medium">
                Se valida al confirmar
              </span>
            </div>

            {/* Condición 2: Reporte generado */}
            <div className={`flex items-center gap-3 p-3 rounded-lg ${
              validaciones.reporteGenerado ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
            }`}>
              <div className="w-6 h-6 flex-shrink-0 flex items-center justify-center">
                {validaciones.reporteGenerado
                  ? <CheckCircle className="w-5 h-5 text-green-500" />
                  : <AlertCircle className="w-5 h-5 text-red-500" />
                }
              </div>
              <div className="flex-1">
                <p className={`text-sm font-medium ${validaciones.reporteGenerado ? 'text-green-800' : 'text-red-800'}`}>
                  Reporte de Estado generado
                </p>
                <p className={`text-xs ${validaciones.reporteGenerado ? 'text-green-600' : 'text-red-600'}`}>
                  {validaciones.reporteGenerado
                    ? 'El reporte de estado fue generado correctamente'
                    : 'Debés generar el Reporte de Estado antes de cerrar el día'
                  }
                </p>
              </div>
              {!validaciones.reporteGenerado && (
                <ClipboardList className="w-5 h-5 text-red-400 flex-shrink-0" />
              )}
            </div>

            {/* Condición 3: Sin personal activo */}
            <div className={`flex items-center gap-3 p-3 rounded-lg ${
              validaciones.sinPersonalActivo ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
            }`}>
              <div className="w-6 h-6 flex-shrink-0 flex items-center justify-center">
                {validaciones.sinPersonalActivo
                  ? <CheckCircle className="w-5 h-5 text-green-500" />
                  : <AlertCircle className="w-5 h-5 text-red-500" />
                }
              </div>
              <div className="flex-1">
                <p className={`text-sm font-medium ${validaciones.sinPersonalActivo ? 'text-green-800' : 'text-red-800'}`}>
                  Todo el personal con salida registrada
                </p>
                <p className={`text-xs ${validaciones.sinPersonalActivo ? 'text-green-600' : 'text-red-600'}`}>
                  {validaciones.sinPersonalActivo
                    ? 'No hay empleados con turno abierto'
                    : `Hay ${validaciones.personalActivoCount} empleado(s) sin registrar salida`
                  }
                </p>
              </div>
              {!validaciones.sinPersonalActivo && (
                <Users className="w-5 h-5 text-red-400 flex-shrink-0" />
              )}
            </div>

            {/* Botón actualizar */}
            <button
              onClick={verificarCondicionesCierre}
              className="text-xs text-primary hover:underline mt-1"
            >
              ↻ Actualizar estado
            </button>
          </div>
        )}
      </div>

      {/* Configuración del cierre */}
      <div className="card">
        <h3 className="text-xl font-bold text-dark mb-4">Generar Cierre del Día</h3>
        
        <div className="space-y-4">
          <div>
            <label className="label">Observaciones Generales del Día</label>
            <textarea
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              className="input-field"
              rows="4"
              placeholder="Ingrese observaciones generales sobre el día de trabajo..."
            />
            {observacionesIniciales && (
              <p className="text-xs text-green-600 mt-1">
                ✓ Observaciones cargadas desde el registro del turno
              </p>
            )}
          </div>

          <div className="flex space-x-3">
            <button
              onClick={generarVistaPrevia}
              className={`flex items-center space-x-2 flex-1 ${
                puedeGenerarVistaPrevia
                  ? 'btn-outline'
                  : 'btn-outline opacity-60 cursor-not-allowed'
              }`}
              disabled={loading || !puedeGenerarVistaPrevia}
              title={!puedeGenerarVistaPrevia ? 'Debés cumplir todas las condiciones previas' : ''}
            >
              <Eye className="w-5 h-5" />
              <span>Vista Previa</span>
            </button>
            
            {datosReporte && (
              <button
                onClick={abrirConfirmacion}
                className="bg-red-600 hover:bg-red-700 text-white font-medium py-3 px-6 rounded-lg transition-colors flex items-center space-x-2 flex-1"
                disabled={loading}
              >
                <CheckCircle className="w-5 h-5" />
                <span>Cerrar Día</span>
              </button>
            )}
          </div>

          {!puedeGenerarVistaPrevia && !validaciones.cargando && (
            <p className="text-sm text-red-600 text-center">
              Completá todas las condiciones marcadas en rojo para poder generar el cierre.
            </p>
          )}
        </div>
      </div>

      {/* Vista previa del reporte */}
      {datosReporte && (
        <div className="card bg-gray-50">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-bold text-dark">Vista Previa del Cierre</h3>
            <button
              onClick={() => descargarReporte({ 
                ...datosReporte, 
                hora_cierre: new Date().toISOString(),
                observaciones_generales: observaciones,
                usuario: { nombre: 'Usuario', apellido: 'Actual' }
              })}
              className="btn-icon"
            >
              <Download className="w-5 h-5" />
            </button>
          </div>

          <div className="bg-white rounded-lg p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-primary/10 rounded-lg p-4">
                <p className="text-sm text-gray-600 mb-1">Personal Total</p>
                <p className="text-2xl font-bold text-primary">{datosReporte.personal.length}</p>
                <p className="text-xs text-gray-500">
                  {datosReporte.personalActivo} en turno • {datosReporte.personalFinalizado} finalizados
                </p>
              </div>

              <div className="bg-secondary/10 rounded-lg p-4">
                <p className="text-sm text-gray-600 mb-1">Vales de Caja</p>
                <p className="text-2xl font-bold text-secondary">${Math.round(datosReporte.totalVales).toLocaleString('es-AR')}</p>
                <p className="text-xs text-gray-500">{datosReporte.cantidadVales} vales</p>
              </div>

              <div className="bg-red-100 rounded-lg p-4">
                <p className="text-sm text-gray-600 mb-1">Ausencias</p>
                <p className="text-2xl font-bold text-red-600">{datosReporte.cantidadAusencias}</p>
                <p className="text-xs text-gray-500">empleados ausentes</p>
              </div>
            </div>

            <div>
              <h4 className="font-semibold text-dark mb-3">Personal del Día</h4>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {datosReporte.personal.map((p, i) => (
                  <div key={i} className="bg-gray-50 rounded p-3 text-sm">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium text-dark">{p.empleado}</p>
                        <p className="text-gray-600">{p.rol} • Doc: {p.documento}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-gray-600">
                          {format(new Date(p.horaEntrada), 'HH:mm')} - {p.horaSalida === 'EN TURNO' ? 'EN TURNO' : format(new Date(p.horaSalida), 'HH:mm')}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Cierres anteriores */}
      {cierresAnteriores.length > 0 && (
        <div className="card">
          <h3 className="text-xl font-bold text-dark mb-4">Cierres Anteriores</h3>
          <div className="space-y-3">
            {cierresAnteriores.map(cierre => (
              <div
                key={cierre.id}
                className="bg-gray-50 rounded-lg p-4 flex items-center justify-between hover:bg-gray-100 transition-colors"
              >
                <div>
                  <p className="font-semibold text-dark">
                    {format(new Date(cierre.fecha), "dd 'de' MMMM 'de' yyyy", { locale: es })}
                  </p>
                  <p className="text-sm text-gray-600">
                    Cerrado por: {cierre.usuario.nombre} {cierre.usuario.apellido}
                  </p>
                  <p className="text-sm text-gray-500">
                    Total vales: ${Math.round(parseFloat(cierre.total_vales)).toLocaleString('es-AR')}
                  </p>
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => descargarReporte(cierre)}
                    className="btn-icon"
                    title="Descargar reporte"
                  >
                    <Download className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal de Confirmación */}
      <Modal
        isOpen={modalConfirmacion}
        onClose={() => setModalConfirmacion(false)}
        title="⚠️ Confirmar Cierre del Día"
      >
        <div className="space-y-4">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-900 font-medium mb-2">
              Esta acción cerrará el día de trabajo actual
            </p>
            <p className="text-red-700 text-sm">
              Al confirmar, se realizarán los siguientes cambios:
            </p>
            <ul className="list-disc list-inside text-red-700 text-sm mt-2 space-y-1">
              <li>Se generará el reporte de cierre del día</li>
              <li>Los contadores de la pantalla se reiniciarán a 0</li>
              <li>El sistema quedará listo para el siguiente día de trabajo</li>
              <li>Esta acción NO se puede deshacer</li>
            </ul>
          </div>

          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-sm text-gray-700">
              <strong>Resumen del día:</strong>
            </p>
            <ul className="text-sm text-gray-600 mt-2 space-y-1">
              <li>• Personal: {datosReporte?.personal.length || 0} registros</li>
              <li>• Vales: ${Math.round(datosReporte?.totalVales || 0).toLocaleString('es-AR')} ({datosReporte?.cantidadVales || 0} vales)</li>
              <li>• Ausencias: {datosReporte?.cantidadAusencias || 0}</li>
            </ul>
          </div>

          <div className="flex space-x-3">
            <button
              onClick={() => setModalConfirmacion(false)}
              className="btn-outline flex-1"
            >
              Cancelar
            </button>
            <button
              onClick={confirmarCierre}
              className="bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-6 rounded-lg transition-colors flex-1"
              disabled={loading}
            >
              {loading ? 'Cerrando...' : 'Confirmar Cierre'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

export default CierreDia

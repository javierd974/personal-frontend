import React, { useState, useEffect } from 'react'
import { FileText, Download, Eye, CheckCircle, AlertCircle } from 'lucide-react'
import { cierreDiaService } from '../../services/cierreDiaService'
import LoadingSpinner from '../common/LoadingSpinner'
import Modal from '../common/Modal'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

const CierreDia = ({ localId, localNombre, onAlert, onCierreExitoso }) => {
  const [loading, setLoading] = useState(false)
  const [datosReporte, setDatosReporte] = useState(null)
  const [observaciones, setObservaciones] = useState('')
  const [cierresAnteriores, setCierresAnteriores] = useState([])
  const [modalConfirmacion, setModalConfirmacion] = useState(false)

  useEffect(() => {
    cargarCierresAnteriores()
  }, [localId])

  const cargarCierresAnteriores = async () => {
    const result = await cierreDiaService.getCierres(localId)
    if (result.success) {
      setCierresAnteriores(result.data.slice(0, 5)) // Últimos 5 cierres
    }
  }

  const generarVistaPrevia = async () => {
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
      onAlert({ type: 'warning', message: 'Primero genera la vista previa del cierre' })
      return
    }
    setModalConfirmacion(true)
  }

  const confirmarCierre = async () => {
    setLoading(true)
    try {
      const result = await cierreDiaService.cerrarDia(
        localId,
        observaciones
      )
      
      if (result.success) {
        onAlert({ type: 'success', message: '✅ Día cerrado correctamente. Los valores se han reiniciado.' })
        setDatosReporte(null)
        setObservaciones('')
        setModalConfirmacion(false)
        await cargarCierresAnteriores()
        
        // Notificar al Dashboard que se cerró el día
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
    // Generar contenido del reporte
    const contenido = generarContenidoReporte(cierre)
    
    // Crear blob y descargar
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
    const ancho = 42 // Caracteres por línea en 80mm
    
    const centrar = (texto) => {
      const espacios = Math.max(0, Math.floor((ancho - texto.length) / 2))
      return ' '.repeat(espacios) + texto
    }
    
    const linea = (char = '-') => char.repeat(ancho)
    
    const formatoPrecio = (valor) => {
      return `$${Math.round(valor).toLocaleString('es-AR')}`
    }
    
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
   E: ${entrada} | S: ${salida}${p.observaciones ? `
   Obs: ${p.observaciones}` : ''}`
}).join('\n\n')}

${linea('=')}

VALES DE CAJA
${linea()}
Cantidad: ${datos.cantidadVales}
TOTAL: ${formatoPrecio(datos.totalVales)}

${datos.vales.length > 0 ? datos.vales.map((v, i) => {
  return `${i + 1}. ${v.empleado}
   ${formatoPrecio(v.importe)} - ${v.motivo || v.concepto}`
}).join('\n\n') : 'Sin vales registrados'}

${linea('=')}

AUSENCIAS
${linea()}
Total: ${datos.cantidadAusencias}

${datos.ausencias.length > 0 ? datos.ausencias.map((a, i) => {
  return `${i + 1}. ${a.empleado}
   ${a.motivo}${a.observaciones ? `
   Obs: ${a.observaciones}` : ''}`
}).join('\n\n') : 'Sin ausencias registradas'}

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

  return (
    <div className="space-y-6">
      {/* Información importante */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-2">
          <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-blue-900">Información del Cierre del Día</p>
            <p className="text-sm text-blue-700 mt-1">
              El cierre del día solo puede realizarse entre las <strong>03:00 AM y 04:00 AM</strong>.
              Este cierre reiniciará todos los contadores y preparará el sistema para el nuevo día.
            </p>
            <p className="text-sm text-blue-700 mt-1">
              El día de trabajo inicia a las <strong>05:00 AM</strong> y puede extenderse hasta las <strong>04:00 AM</strong> del día siguiente.
            </p>
          </div>
        </div>
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
          </div>

          <div className="flex space-x-3">
            <button
              onClick={generarVistaPrevia}
              className="btn-outline flex items-center space-x-2 flex-1"
              disabled={loading}
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
            {/* Resumen */}
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

            {/* Personal */}
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

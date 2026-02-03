import React, { useState, useEffect } from 'react'
import { FileText, Download, Eye, CheckCircle, AlertCircle } from 'lucide-react'
import { cierreTurnoService } from '../../services/cierreTurnoService'
import LoadingSpinner from '../common/LoadingSpinner'
import Modal from '../common/Modal'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

const CierreTurno = ({ localId, localNombre, onAlert }) => {
  const [loading, setLoading] = useState(false)
  const [datosReporte, setDatosReporte] = useState(null)
  const [observaciones, setObservaciones] = useState('')
  const [turno, setTurno] = useState('general')
  const [modalReporte, setModalReporte] = useState(false)
  const [reporteActual, setReporteActual] = useState(null)
  const [cierresAnteriores, setCierresAnteriores] = useState([])

  useEffect(() => {
    cargarCierresAnteriores()
  }, [localId])

  const cargarCierresAnteriores = async () => {
    const result = await cierreTurnoService.getCierres(localId)
    if (result.success) {
      setCierresAnteriores(result.data.slice(0, 5)) // Últimos 5 cierres
    }
  }

  const generarVistaPrevia = async () => {
    setLoading(true)
    try {
      const result = await cierreTurnoService.generarDatosCierre(localId, null, turno)
      
      if (result.success) {
        setDatosReporte(result.data)
        onAlert({ type: 'success', message: 'Reporte generado correctamente' })
      } else {
        onAlert({ type: 'error', message: result.error })
      }
    } catch (error) {
      onAlert({ type: 'error', message: 'Error al generar reporte' })
    } finally {
      setLoading(false)
    }
  }

  const confirmarCierre = async () => {
    if (!window.confirm('¿Confirmar el cierre de turno? Esta acción no se puede deshacer.')) {
      return
    }

    setLoading(true)
    try {
      const result = await cierreTurnoService.cerrarTurno(
        localId,
        observaciones,
        turno
      )
      
      if (result.success) {
        onAlert({ type: 'success', message: 'Turno cerrado correctamente' })
        setDatosReporte(null)
        setObservaciones('')
        await cargarCierresAnteriores()
      } else {
        onAlert({ type: 'error', message: result.error })
      }
    } catch (error) {
      onAlert({ type: 'error', message: 'Error al cerrar turno' })
    } finally {
      setLoading(false)
    }
  }

  const verReporte = async (cierreId) => {
    setLoading(true)
    try {
      const result = await cierreTurnoService.getCierreById(cierreId)
      
      if (result.success) {
        setReporteActual(result.data)
        setModalReporte(true)
      } else {
        onAlert({ type: 'error', message: result.error })
      }
    } catch (error) {
      onAlert({ type: 'error', message: 'Error al cargar reporte' })
    } finally {
      setLoading(false)
    }
  }

  const descargarReporte = (reporte) => {
    // Generar contenido del reporte
    const contenido = generarContenidoReporte(reporte)
    
    // Crear blob y descargar
    const blob = new Blob([contenido], { type: 'text/plain;charset=utf-8' })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `reporte_turno_${format(new Date(reporte.fecha), 'yyyy-MM-dd')}_${reporte.turno}.txt`
    link.click()
    window.URL.revokeObjectURL(url)
  }

  const generarContenidoReporte = (reporte) => {
    const datos = reporte.reporte_json || reporte
    
    let contenido = `
╔════════════════════════════════════════════════════════╗
║           REPORTE DE CIERRE DE TURNO                  ║
║                    SmartDom                            ║
╚════════════════════════════════════════════════════════╝

Local: ${localNombre}
Fecha: ${format(new Date(datos.fecha), "dd 'de' MMMM 'de' yyyy", { locale: es })}
Turno: ${datos.turno.toUpperCase()}
Hora de Cierre: ${format(new Date(reporte.hora_cierre), 'HH:mm')}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

PERSONAL EN TURNO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Total de Personal: ${datos.personal.length}
En Turno: ${datos.personalActivo}
Finalizados: ${datos.personalFinalizado}

${datos.personal.map((p, i) => `
${i + 1}. ${p.empleado}
   Documento: ${p.documento}
   Rol: ${p.rol}
   Entrada: ${format(new Date(p.horaEntrada), 'HH:mm')}
   Salida: ${p.horaSalida === 'EN TURNO' ? 'EN TURNO' : format(new Date(p.horaSalida), 'HH:mm')}
   ${p.observaciones ? `Obs: ${p.observaciones}` : ''}
`).join('')}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

VALES DE CAJA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Cantidad de Vales: ${datos.cantidadVales}
Total en Vales: $${datos.totalVales.toFixed(2)}

${datos.vales.length > 0 ? datos.vales.map((v, i) => `
${i + 1}. ${v.empleado}
   Importe: $${v.importe.toFixed(2)}
   Concepto: ${v.concepto || 'N/A'}
`).join('') : 'No se registraron vales en este turno.'}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

AUSENCIAS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Total de Ausencias: ${datos.cantidadAusencias}

${datos.ausencias.length > 0 ? datos.ausencias.map((a, i) => `
${i + 1}. ${a.empleado}
   Motivo: ${a.motivo}
   ${a.observaciones ? `Obs: ${a.observaciones}` : ''}
`).join('') : 'No se registraron ausencias en este turno.'}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

OBSERVACIONES GENERALES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${reporte.observaciones_generales || 'Sin observaciones'}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Cerrado por: ${reporte.usuario?.nombre} ${reporte.usuario?.apellido}

╔════════════════════════════════════════════════════════╗
║              Desarrollado por SmartDom                 ║
╚════════════════════════════════════════════════════════╝
`
    return contenido
  }

  return (
    <div className="space-y-6">
      {/* Configuración del cierre */}
      <div className="card">
        <h3 className="text-xl font-bold text-dark mb-4">Generar Cierre de Turno</h3>
        
        <div className="space-y-4">
          <div>
            <label className="label">Tipo de Turno</label>
            <select
              value={turno}
              onChange={(e) => setTurno(e.target.value)}
              className="select-field"
            >
              <option value="general">General</option>
              <option value="mañana">Mañana</option>
              <option value="tarde">Tarde</option>
              <option value="noche">Noche</option>
            </select>
          </div>

          <div>
            <label className="label">Observaciones Generales del Turno</label>
            <textarea
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              className="input-field"
              rows="4"
              placeholder="Ingrese observaciones generales sobre el turno..."
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
                onClick={confirmarCierre}
                className="btn-primary flex items-center space-x-2 flex-1"
                disabled={loading}
              >
                <CheckCircle className="w-5 h-5" />
                <span>Confirmar Cierre</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Vista previa del reporte */}
      {datosReporte && (
        <div className="card bg-gray-50">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-bold text-dark">Vista Previa del Reporte</h3>
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
                <p className="text-2xl font-bold text-secondary">${datosReporte.totalVales.toFixed(2)}</p>
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
              <h4 className="font-semibold text-dark mb-3">Personal del Turno</h4>
              <div className="space-y-2">
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

            {/* Vales */}
            {datosReporte.vales.length > 0 && (
              <div>
                <h4 className="font-semibold text-dark mb-3">Vales de Caja</h4>
                <div className="space-y-2">
                  {datosReporte.vales.map((v, i) => (
                    <div key={i} className="bg-secondary/5 rounded p-3 text-sm">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-medium text-dark">{v.empleado}</p>
                          <p className="text-gray-600">{v.concepto}</p>
                        </div>
                        <p className="font-bold text-secondary">${v.importe.toFixed(2)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Ausencias */}
            {datosReporte.ausencias.length > 0 && (
              <div>
                <h4 className="font-semibold text-dark mb-3">Ausencias</h4>
                <div className="space-y-2">
                  {datosReporte.ausencias.map((a, i) => (
                    <div key={i} className="bg-red-50 rounded p-3 text-sm">
                      <p className="font-medium text-dark">{a.empleado}</p>
                      <p className="text-gray-600">{a.motivo}</p>
                      {a.observaciones && <p className="text-gray-500 text-xs mt-1">{a.observaciones}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}
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
                    {format(new Date(cierre.fecha), "dd 'de' MMMM 'de' yyyy", { locale: es })} - {cierre.turno.toUpperCase()}
                  </p>
                  <p className="text-sm text-gray-600">
                    Cerrado por: {cierre.usuario.nombre} {cierre.usuario.apellido}
                  </p>
                  <p className="text-sm text-gray-500">
                    Total vales: ${parseFloat(cierre.total_vales).toFixed(2)}
                  </p>
                </div>

                <div className="flex space-x-2">
                  <button
                    onClick={() => verReporte(cierre.id)}
                    className="btn-icon"
                    title="Ver reporte"
                  >
                    <Eye className="w-5 h-5" />
                  </button>
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

      {/* Modal Reporte Completo */}
      <Modal
        isOpen={modalReporte}
        onClose={() => setModalReporte(false)}
        title="Reporte de Cierre de Turno"
        size="lg"
      >
        {reporteActual && (
          <div className="space-y-4">
            <div className="bg-gray-50 rounded-lg p-4">
              <pre className="text-sm whitespace-pre-wrap font-mono">
                {generarContenidoReporte(reporteActual)}
              </pre>
            </div>
            
            <button
              onClick={() => descargarReporte(reporteActual)}
              className="btn-primary w-full flex items-center justify-center space-x-2"
            >
              <Download className="w-5 h-5" />
              <span>Descargar Reporte</span>
            </button>
          </div>
        )}
      </Modal>
    </div>
  )
}

export default CierreTurno

import React, { useState, useEffect } from 'react'
import { FileText, Download, Eye, Printer, Save } from 'lucide-react'
import { reporteEstadoService } from '../../services/reporteEstadoService'
import LoadingSpinner from '../common/LoadingSpinner'
import Modal from '../common/Modal'
import { format } from 'date-fns'

const ReporteEstado = ({ localId, localNombre, onAlert, observacionesInicial = '' }) => {
  const [loading, setLoading] = useState(false)
  const [datosReporte, setDatosReporte] = useState(null)
  const [observaciones, setObservaciones] = useState(observacionesInicial)
  const [reportesAnteriores, setReportesAnteriores] = useState([])
  const [modalVistaPrevia, setModalVistaPrevia] = useState(false)
  const [reporteGuardado, setReporteGuardado] = useState(null)

  // Sincronizar observaciones cuando cambien desde el Dashboard
  useEffect(() => {
    setObservaciones(observacionesInicial)
  }, [observacionesInicial])

  useEffect(() => {
    cargarReportesAnteriores()
  }, [localId])

  const cargarReportesAnteriores = async () => {
    const result = await reporteEstadoService.getReportes(localId)
    if (result.success) {
      setReportesAnteriores(result.data.slice(0, 10)) // Últimos 10 reportes
    }
  }

  const generarReporte = async () => {
    setLoading(true)
    try {
      const result = await reporteEstadoService.generarDatosReporte(localId, observaciones)
      
      if (result.success) {
        setDatosReporte(result.data)
        setModalVistaPrevia(true)
        onAlert({ type: 'success', message: 'Reporte generado. Revisa la vista previa.' })
      } else {
        onAlert({ type: 'error', message: result.error })
      }
    } catch (error) {
      onAlert({ type: 'error', message: 'Error al generar reporte' })
    } finally {
      setLoading(false)
    }
  }

  const guardarYImprimir = async () => {
    setLoading(true)
    try {
      const result = await reporteEstadoService.guardarReporte(localId, observaciones)
      
      if (result.success) {
        setReporteGuardado(result.data)
        onAlert({ 
          type: 'success', 
          message: `✅ Reporte guardado con N° ${result.data.numero_reporte}. Listo para imprimir.` 
        })
        
        // Generar impresión
        imprimirReporte(result.data)
        
        // Limpiar y cerrar
        setObservaciones('')
        setModalVistaPrevia(false)
        await cargarReportesAnteriores()
      } else {
        onAlert({ type: 'error', message: result.error })
      }
    } catch (error) {
      onAlert({ type: 'error', message: 'Error al guardar reporte' })
    } finally {
      setLoading(false)
    }
  }

  const imprimirReporte = (reporte) => {
    const contenido = reporteEstadoService.generarContenidoImpresion(reporte, localNombre)
    
    // Crear ventana de impresión
    const ventanaImpresion = window.open('', '', 'width=300,height=600')
    ventanaImpresion.document.write(`
      <html>
        <head>
          <title>Reporte ${reporte.numero_reporte}</title>
          <style>
            @media print {
              @page { 
                size: 80mm auto;
                margin: 0;
              }
              body {
                margin: 0;
                padding: 2mm;
              }
            }
            body {
              font-family: 'Courier New', monospace;
              font-size: 10pt;
              line-height: 1.2;
              white-space: pre-wrap;
              word-wrap: break-word;
              max-width: 72mm;
            }
          </style>
        </head>
        <body>
          ${contenido}
        </body>
      </html>
    `)
    ventanaImpresion.document.close()
    
    // Esperar a que cargue y luego imprimir
    setTimeout(() => {
      ventanaImpresion.print()
      ventanaImpresion.close()
    }, 250)
  }

  const descargarReporte = (reporte) => {
    const contenido = reporteEstadoService.generarContenidoImpresion(reporte, localNombre)
    
    const blob = new Blob([contenido], { type: 'text/plain;charset=utf-8' })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `reporte_${reporte.numero_reporte}.txt`
    link.click()
    window.URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      {/* Información */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-2">
          <FileText className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-blue-900">Reporte de Estado - Cambio de Encargado</p>
            <p className="text-sm text-blue-700 mt-1">
              Este reporte captura el estado actual del personal, vales y ausencias en este momento.
              Es útil para el cambio de turno entre encargados.
            </p>
          </div>
        </div>
      </div>

      {/* Generar nuevo reporte */}
      <div className="card">
        <h3 className="text-xl font-bold text-dark mb-4">Generar Reporte de Estado</h3>
        
        <div className="space-y-4">
          <div>
            <label className="label">Observaciones (opcional)</label>
            <textarea
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              className="input-field"
              rows="3"
              placeholder="Notas sobre el estado actual del turno..."
            />
          </div>

          <button
            onClick={generarReporte}
            className="btn-primary w-full flex items-center justify-center space-x-2"
            disabled={loading}
          >
            <Eye className="w-5 h-5" />
            <span>Generar Reporte</span>
          </button>
        </div>
      </div>

      {/* Reportes anteriores */}
      {reportesAnteriores.length > 0 && (
        <div className="card">
          <h3 className="text-xl font-bold text-dark mb-4">Reportes Anteriores</h3>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {reportesAnteriores.map(reporte => (
              <div
                key={reporte.id}
                className="bg-gray-50 rounded-lg p-4 flex items-center justify-between hover:bg-gray-100 transition-colors"
              >
                <div>
                  <p className="font-semibold text-dark">
                    N° {reporte.numero_reporte}
                  </p>
                  <p className="text-sm text-gray-600">
                    {format(new Date(reporte.created_at), "dd/MM/yyyy HH:mm")}
                  </p>
                  <p className="text-sm text-gray-600">
                    Por: {reporte.usuario.nombre} {reporte.usuario.apellido}
                  </p>
                  <p className="text-sm text-gray-500">
                    Vales: ${Math.round(parseFloat(reporte.total_vales)).toLocaleString('es-AR')}
                  </p>
                </div>

                <div className="flex space-x-2">
                  <button
                    onClick={() => imprimirReporte(reporte)}
                    className="btn-icon text-primary"
                    title="Imprimir"
                  >
                    <Printer className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => descargarReporte(reporte)}
                    className="btn-icon"
                    title="Descargar"
                  >
                    <Download className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal Vista Previa */}
      <Modal
        isOpen={modalVistaPrevia}
        onClose={() => setModalVistaPrevia(false)}
        title="Vista Previa - Reporte de Estado"
        size="lg"
      >
        {datosReporte && (
          <div className="space-y-4">
            {/* Resumen */}
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-primary/10 rounded-lg p-3">
                <p className="text-xs text-gray-600">Personal Activo</p>
                <p className="text-xl font-bold text-primary">{datosReporte.personalActivo}</p>
              </div>
              <div className="bg-secondary/10 rounded-lg p-3">
                <p className="text-xs text-gray-600">Vales</p>
                <p className="text-xl font-bold text-secondary">
                  ${Math.round(datosReporte.totalVales).toLocaleString('es-AR')}
                </p>
              </div>
              <div className="bg-red-100 rounded-lg p-3">
                <p className="text-xs text-gray-600">Ausencias</p>
                <p className="text-xl font-bold text-red-600">{datosReporte.cantidadAusencias}</p>
              </div>
            </div>

            {/* Personal en Turno */}
            <div>
              <h4 className="font-semibold text-dark mb-2">Personal en Turno ({datosReporte.personalActivo})</h4>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {datosReporte.empleadosEnTurno.map((emp, i) => (
                  <div key={i} className="bg-gray-50 rounded p-2 text-sm">
                    <p className="font-medium text-dark">{emp.empleado}</p>
                    <p className="text-gray-600">{emp.rol} - Entrada: {format(new Date(emp.horaEntrada), 'HH:mm')}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Vales */}
            {datosReporte.vales.length > 0 && (
              <div>
                <h4 className="font-semibold text-dark mb-2">Vales del Día ({datosReporte.cantidadVales})</h4>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {datosReporte.vales.map((vale, i) => (
                    <div key={i} className="bg-secondary/5 rounded p-2 text-sm flex justify-between">
                      <div>
                        <p className="font-medium text-dark">{vale.empleado}</p>
                        <p className="text-gray-600">{vale.motivo}</p>
                      </div>
                      <p className="font-bold text-secondary">${Math.round(vale.importe).toLocaleString('es-AR')}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Ausencias */}
            {datosReporte.ausencias.length > 0 && (
              <div>
                <h4 className="font-semibold text-dark mb-2">Ausencias ({datosReporte.cantidadAusencias})</h4>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {datosReporte.ausencias.map((ausencia, i) => (
                    <div key={i} className="bg-red-50 rounded p-2 text-sm">
                      <p className="font-medium text-dark">{ausencia.empleado}</p>
                      <p className="text-gray-600">{ausencia.motivo}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Observaciones */}
            <div>
              <h4 className="font-semibold text-dark mb-2">Observaciones del Turno</h4>
              <div className="bg-yellow-50 border border-yellow-200 rounded p-3 text-sm">
                <p className="text-gray-700 whitespace-pre-wrap">
                  {datosReporte.observaciones || <span className="text-gray-400 italic">Sin observaciones</span>}
                </p>
              </div>
            </div>

            {/* Botones de acción */}
            <div className="flex space-x-3 pt-4 border-t">
              <button
                onClick={() => setModalVistaPrevia(false)}
                className="btn-outline flex-1"
              >
                Cancelar
              </button>
              <button
                onClick={guardarYImprimir}
                className="btn-primary flex-1 flex items-center justify-center space-x-2"
                disabled={loading}
              >
                <Save className="w-5 h-5" />
                <span>{loading ? 'Guardando...' : 'Guardar e Imprimir'}</span>
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

export default ReporteEstado

import { supabase, handleSupabaseError, getCurrentUser } from './supabase'
import { format } from 'date-fns'
import { registrosService } from './registrosService'
import { valesService, ausenciasService } from './catalogosService'

export const cierreTurnoService = {
  // Generar datos para el reporte de cierre de turno
  async generarDatosCierre(localId, fecha = null, turno = 'general') {
    try {
      const fechaBusqueda = fecha || format(new Date(), 'yyyy-MM-dd')
      
      // Obtener registros del día
      const registrosResult = await registrosService.getRegistrosDelDia(localId, fechaBusqueda)
      if (!registrosResult.success) throw new Error(registrosResult.error)
      
      // Obtener vales del día
      const valesResult = await valesService.getValesDelDia(localId, fechaBusqueda)
      if (!valesResult.success) throw new Error(valesResult.error)
      
      // Obtener total de vales
      const totalValesResult = await valesService.getTotalValesDelDia(localId, fechaBusqueda)
      if (!totalValesResult.success) throw new Error(totalValesResult.error)
      
      // Obtener ausencias del día
      const ausenciasResult = await ausenciasService.getAusenciasDelDia(localId, fechaBusqueda)
      if (!ausenciasResult.success) throw new Error(ausenciasResult.error)
      
      // Formatear datos del reporte
      const reporte = {
        fecha: fechaBusqueda,
        turno: turno,
        personal: registrosResult.data.map(registro => ({
          id: registro.id,
          empleado: `${registro.empleado.nombre} ${registro.empleado.apellido}`,
          documento: registro.empleado.documento,
          rol: registro.rol.nombre,
          horaEntrada: registro.hora_entrada,
          horaSalida: registro.hora_salida || 'EN TURNO',
          observaciones: registro.observaciones
        })),
        vales: valesResult.data.map(vale => ({
          id: vale.id,
          empleado: `${vale.empleado.nombre} ${vale.empleado.apellido}`,
          importe: parseFloat(vale.importe),
          concepto: vale.concepto
        })),
        totalVales: totalValesResult.total,
        cantidadVales: totalValesResult.cantidad,
        ausencias: ausenciasResult.data.map(ausencia => ({
          id: ausencia.id,
          empleado: `${ausencia.empleado.nombre} ${ausencia.empleado.apellido}`,
          motivo: ausencia.motivo.motivo,
          observaciones: ausencia.observaciones
        })),
        cantidadAusencias: ausenciasResult.data.length,
        personalActivo: registrosResult.data.filter(r => !r.hora_salida).length,
        personalFinalizado: registrosResult.data.filter(r => r.hora_salida).length
      }
      
      return { success: true, data: reporte }
    } catch (error) {
      return { success: false, error: error.message || handleSupabaseError(error) }
    }
  },

  // Cerrar turno y guardar reporte
  async cerrarTurno(localId, observacionesGenerales, turno = 'general', fecha = null) {
    try {
      const user = await getCurrentUser()
      const fechaCierre = fecha || format(new Date(), 'yyyy-MM-dd')
      
      // Generar datos del reporte
      const reporteResult = await this.generarDatosCierre(localId, fechaCierre, turno)
      if (!reporteResult.success) throw new Error(reporteResult.error)
      
      // Guardar cierre de turno
      const { data, error } = await supabase
        .from('cierres_turno')
        .insert({
          local_id: localId,
          fecha: fechaCierre,
          turno: turno,
          hora_cierre: new Date().toISOString(),
          total_vales: reporteResult.data.totalVales,
          observaciones_generales: observacionesGenerales,
          cerrado_por: user.id,
          reporte_json: reporteResult.data
        })
        .select(`
          *,
          local:locales(nombre),
          usuario:usuarios(nombre, apellido)
        `)
        .single()
      
      if (error) throw error
      
      return { success: true, data }
    } catch (error) {
      return { success: false, error: handleSupabaseError(error) }
    }
  },

  // Obtener cierres de turno
  async getCierres(localId, desde = null, hasta = null) {
    try {
      let query = supabase
        .from('cierres_turno')
        .select(`
          *,
          local:locales(nombre),
          usuario:usuarios(nombre, apellido)
        `)
        .eq('local_id', localId)
      
      if (desde) {
        query = query.gte('fecha', desde)
      }
      
      if (hasta) {
        query = query.lte('fecha', hasta)
      }
      
      query = query.order('fecha', { ascending: false })
        .order('hora_cierre', { ascending: false })
      
      const { data, error } = await query
      
      if (error) throw error
      
      return { success: true, data }
    } catch (error) {
      return { success: false, error: handleSupabaseError(error) }
    }
  },

  // Obtener un cierre específico
  async getCierreById(cierreId) {
    try {
      const { data, error } = await supabase
        .from('cierres_turno')
        .select(`
          *,
          local:locales(nombre, direccion),
          usuario:usuarios(nombre, apellido, email)
        `)
        .eq('id', cierreId)
        .single()
      
      if (error) throw error
      
      return { success: true, data }
    } catch (error) {
      return { success: false, error: handleSupabaseError(error) }
    }
  },

  // Verificar si ya existe un cierre para la fecha y turno
  async existeCierre(localId, fecha, turno) {
    try {
      const { data, error } = await supabase
        .from('cierres_turno')
        .select('id')
        .eq('local_id', localId)
        .eq('fecha', fecha)
        .eq('turno', turno)
        .maybeSingle()
      
      if (error) throw error
      
      return { success: true, existe: !!data }
    } catch (error) {
      return { success: false, error: handleSupabaseError(error) }
    }
  }
}

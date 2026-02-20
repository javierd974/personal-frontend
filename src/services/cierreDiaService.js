import { supabase, handleSupabaseError, getCurrentUser } from './supabase'
import { format } from 'date-fns'
import { registrosService } from './registrosService'
import { valesService, ausenciasService } from './catalogosService'

export const cierreDiaService = {
  // Validar horario de cierre del día
  validarHorarioCierre() {
    const ahora = new Date()
    const horaLocal = ahora.getHours()
    const minutosLocal = ahora.getMinutes()
    const horaDecimal = horaLocal + (minutosLocal / 60)

    // El cierre puede realizarse desde la 01:00 AM hasta las 04:00 AM (hora local)
    if (horaLocal < 1) {
      // Entre 00:00 y 00:59 - Demasiado temprano
      return {
        valido: false,
        mensaje: 'El cierre del día solo puede realizarse desde la 01:00 AM hasta las 04:00 AM.'
      }
    }

    if (horaLocal >= 4 && horaLocal < 24) {
      // Entre las 04:00 y las 23:59 - NO puede cerrar, debe esperar
      const horaFaltante = 24 + 1 - Math.ceil(horaDecimal) // Hasta la 1 AM del día siguiente
      return {
        valido: false,
        mensaje: `El cierre del día solo puede realizarse desde la 01:00 AM hasta las 04:00 AM. Faltan aproximadamente ${horaFaltante} horas.`
      }
    }

    return { valido: true }
  },

  // Verificar si ya existe un cierre para la fecha
  async existeCierre(localId, fecha) {
    try {
      const { data, error } = await supabase
        .from('cierres_dia')
        .select('id')
        .eq('local_id', localId)
        .eq('fecha', fecha)
        .maybeSingle()
      
      if (error) throw error
      
      return { success: true, existe: !!data }
    } catch (error) {
      return { success: false, error: handleSupabaseError(error) }
    }
  },

  // Obtener fecha del día de trabajo actual
  getFechaDiaTrabajo() {
    const ahora = new Date()
    const horaActual = ahora.getHours()
    
    // Si es antes de las 5 AM, el día de trabajo es del día anterior
    if (horaActual < 5) {
      const ayer = new Date(ahora)
      ayer.setDate(ayer.getDate() - 1)
      return format(ayer, 'yyyy-MM-dd')
    }
    
    // Después de las 5 AM, es el día actual
    return format(ahora, 'yyyy-MM-dd')
  },

  // Generar datos para el cierre del día
  async generarDatosCierre(localId, fecha = null) {
    try {
      const fechaBusqueda = fecha || this.getFechaDiaTrabajo()
      
      // Verificar si ya existe un cierre
      const verificacion = await this.existeCierre(localId, fechaBusqueda)
      if (verificacion.existe) {
        return {
          success: false,
          error: 'Ya existe un cierre para este día. No se puede cerrar dos veces el mismo día.'
        }
      }
      
      // Obtener todos los registros del día
      const registrosResult = await registrosService.getRegistrosDelDia(localId, fechaBusqueda)
      if (!registrosResult.success) throw new Error(registrosResult.error)
      
      // Obtener vales del día
      const valesResult = await valesService.getValesDelDia(localId, fechaBusqueda)
      if (!valesResult.success) throw new Error(valesResult.error)
      
      // Calcular total de vales
      const totalVales = valesResult.data.reduce((sum, vale) => {
        const importeCentavos = Math.round(parseFloat(vale.importe) * 100)
        return sum + importeCentavos
      }, 0) / 100
      
      // Obtener ausencias del día
      const ausenciasResult = await ausenciasService.getAusenciasDelDia(localId, fechaBusqueda)
      if (!ausenciasResult.success) throw new Error(ausenciasResult.error)
      
      // Formatear datos del reporte
      const reporte = {
        fecha: fechaBusqueda,
        horaInicio: '05:00',
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
          motivo: vale.motivo?.motivo || vale.concepto,
          concepto: vale.concepto
        })),
        totalVales: totalVales,
        cantidadVales: valesResult.data.length,
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

  // Cerrar día y guardar reporte
  async cerrarDia(localId, observacionesGenerales, fecha = null) {
    try {
      const user = await getCurrentUser()
      const fechaCierre = fecha || this.getFechaDiaTrabajo()
      
      // VALIDAR HORARIO DE CIERRE
      const validacion = this.validarHorarioCierre()
      if (!validacion.valido) {
        return { 
          success: false, 
          error: validacion.mensaje 
        }
      }
      
      // Verificar si ya existe un cierre
      const verificacion = await this.existeCierre(localId, fechaCierre)
      if (verificacion.existe) {
        return {
          success: false,
          error: 'Ya existe un cierre para este día.'
        }
      }
      
      // Generar datos del reporte
      const reporteResult = await this.generarDatosCierre(localId, fechaCierre)
      if (!reporteResult.success) throw new Error(reporteResult.error)
      
      // Guardar cierre del día
      const { data, error } = await supabase
        .from('cierres_dia')
        .insert({
          local_id: localId,
          fecha: fechaCierre,
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

  // Obtener cierres de día
  async getCierres(localId, desde = null, hasta = null) {
    try {
      let query = supabase
        .from('cierres_dia')
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
        .from('cierres_dia')
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
  }
}

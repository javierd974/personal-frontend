import { supabase, handleSupabaseError, getCurrentUser } from './supabase'
import { format } from 'date-fns'
import { registrosService } from './registrosService'
import { valesService, ausenciasService } from './catalogosService'

export const cierreTurnoService = {
  // NUEVA FUNCIÓN: Validar horario de cierre según el turno
  validarHorarioCierre(turno) {
    const ahora = new Date()
    const horaLocal = ahora.getHours()
    const minutosLocal = ahora.getMinutes()
    const horaDecimal = horaLocal + (minutosLocal / 60)
    
    // PRIMER TURNO: No puede cerrarse antes de las 17:00 (20:00 GMT)
    if (turno === 'primer_turno') {
      if (horaDecimal < 17) {
        const horaFaltante = Math.floor(17 - horaDecimal)
        const minutosFaltantes = Math.round((17 - horaDecimal - horaFaltante) * 60)
        return {
          valido: false,
          mensaje: `El primer turno no puede cerrarse antes de las 17:00 hs. Faltan ${horaFaltante}h ${minutosFaltantes}m aproximadamente.`
        }
      }
    }
    
    // SEGUNDO TURNO: No puede cerrarse antes de las 00:00 (03:00 GMT)
    if (turno === 'segundo_turno') {
      // Si es después de medianoche pero antes de las 3 AM, está bien (es madrugada del turno)
      if (horaLocal >= 3 && horaLocal < 24) {
        // Entre las 3 AM y las 23:59, verificar que no cierre antes de medianoche
        const horaFaltante = 24 - Math.ceil(horaDecimal)
        return {
          valido: false,
          mensaje: `El segundo turno no puede cerrarse antes de las 00:00 hs. Faltan aproximadamente ${horaFaltante} horas.`
        }
      }
    }
    
    return { valido: true }
  },

  // MODIFICADO: Identificar turno actual basado en cierres anteriores con validaciones horarias
  async identificarTurnoActual(localId, fecha = null) {
    try {
      const fechaBusqueda = fecha || format(new Date(), 'yyyy-MM-dd')
      const ahora = new Date()
      const horaActual = ahora.getHours()
      
      // Si es antes de las 5 AM, no hay turno activo
      if (horaActual < 5) {
        return { turno: null, mensaje: 'Aún no es hora de abrir turno (antes de 5:00 AM)' }
      }
      
      // Obtener cierres del día
      const { data: cierres, error } = await supabase
        .from('cierres_turno')
        .select('turno, hora_cierre')
        .eq('local_id', localId)
        .eq('fecha', fechaBusqueda)
        .order('hora_cierre', { ascending: true })
      
      if (error) throw error
      
      // Si no hay cierres, es el primer turno
      if (!cierres || cierres.length === 0) {
        return { turno: 'primer_turno', numero: 1, mensaje: 'Primer turno del día (puede cerrarse después de las 17:00 hs)' }
      }
      
      // Si ya hay un cierre del primer turno, verificar horario para segundo turno
      if (cierres.length === 1) {
        // Verificar que ya pasaron las 17:00 para permitir segundo turno
        if (horaActual < 17) {
          return { 
            turno: null, 
            mensaje: 'El segundo turno solo puede iniciarse después de las 17:00 hs. El primer turno ya fue cerrado.' 
          }
        }
        return { turno: 'segundo_turno', numero: 2, mensaje: 'Segundo turno del día (puede cerrarse después de las 00:00 hs)' }
      }
      
      // Si ya hay dos cierres, no se pueden hacer más turnos ese día
      if (cierres.length >= 2) {
        return { turno: null, mensaje: 'Ya se cerraron los dos turnos del día' }
      }
      
      return { turno: 'primer_turno', numero: 1, mensaje: 'Primer turno del día' }
    } catch (error) {
      console.error('Error al identificar turno:', error)
      return { turno: 'primer_turno', numero: 1, mensaje: 'Primer turno del día (default)' }
    }
  },

  // Obtener hora del último cierre del día
  async getHoraUltimoCierre(localId, fecha) {
    try {
      const { data, error } = await supabase
        .from('cierres_turno')
        .select('hora_cierre')
        .eq('local_id', localId)
        .eq('fecha', fecha)
        .order('hora_cierre', { ascending: false })
        .limit(1)
        .maybeSingle()
      
      if (error) throw error
      return data?.hora_cierre || null
    } catch (error) {
      console.error('Error al obtener último cierre:', error)
      return null
    }
  },

  // Filtrar registros por turno (después del último cierre)
  async filtrarPorTurnoSecuencial(registros, localId, fecha, turno) {
    // Si es turno general o primer turno sin cierre previo, incluir todo
    if (turno === 'general' || turno === 'primer_turno') {
      const horaUltimoCierre = await this.getHoraUltimoCierre(localId, fecha)
      
      // Si no hay cierre previo, es el primer turno - incluir todo desde las 5 AM
      if (!horaUltimoCierre) {
        return registros.filter(r => {
          if (!r.hora_entrada) return false
          const horaEntrada = r.hora_entrada.substring(0, 5)
          return horaEntrada >= '05:00'
        })
      }
      
      // Si hay cierre previo y es segundo turno, incluir solo después del cierre
      const horaCierre = new Date(horaUltimoCierre).toLocaleTimeString('en-US', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit'
      })
      
      return registros.filter(r => {
        if (!r.hora_entrada) return false
        const horaEntrada = r.hora_entrada.substring(0, 5)
        return horaEntrada > horaCierre
      })
    }
    
    return registros
  },

  // Filtrar vales por turno secuencial
  async filtrarValesPorTurno(vales, localId, fecha, turno) {
    if (turno === 'general') return vales
    
    const horaUltimoCierre = await this.getHoraUltimoCierre(localId, fecha)
    
    // Primer turno: desde las 5 AM (o desde inicio del día si no hay cierre previo)
    if (!horaUltimoCierre) {
      return vales.filter(v => {
        if (!v.created_at) return true
        const horaCreacion = new Date(v.created_at).toLocaleTimeString('en-US', {
          hour12: false,
          hour: '2-digit',
          minute: '2-digit'
        })
        return horaCreacion >= '05:00'
      })
    }
    
    // Segundo turno: después del cierre del primer turno
    const horaCierre = new Date(horaUltimoCierre).toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit'
    })
    
    return vales.filter(v => {
      if (!v.created_at) return false
      const horaCreacion = new Date(v.created_at).toLocaleTimeString('en-US', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit'
      })
      return horaCreacion > horaCierre
    })
  },

  // Filtrar ausencias por turno secuencial
  async filtrarAusenciasPorTurno(ausencias, localId, fecha, turno) {
    if (turno === 'general') return ausencias
    
    const horaUltimoCierre = await this.getHoraUltimoCierre(localId, fecha)
    
    if (!horaUltimoCierre) {
      return ausencias.filter(a => {
        if (!a.created_at) return true
        const horaCreacion = new Date(a.created_at).toLocaleTimeString('en-US', {
          hour12: false,
          hour: '2-digit',
          minute: '2-digit'
        })
        return horaCreacion >= '05:00'
      })
    }
    
    const horaCierre = new Date(horaUltimoCierre).toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit'
    })
    
    return ausencias.filter(a => {
      if (!a.created_at) return false
      const horaCreacion = new Date(a.created_at).toLocaleTimeString('en-US', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit'
      })
      return horaCreacion > horaCierre
    })
  },

  // Generar datos para el reporte de cierre de turno
  async generarDatosCierre(localId, fecha = null, turno = 'general') {
    try {
      const fechaBusqueda = fecha || format(new Date(), 'yyyy-MM-dd')
      
      // Obtener información del turno actual
      const infoTurno = await this.identificarTurnoActual(localId, fechaBusqueda)
      
      // Obtener registros del día
      const registrosResult = await registrosService.getRegistrosDelDia(localId, fechaBusqueda)
      if (!registrosResult.success) throw new Error(registrosResult.error)
      
      // FILTRAR registros por turno secuencial
      const registrosFiltrados = await this.filtrarPorTurnoSecuencial(
        registrosResult.data, 
        localId, 
        fechaBusqueda, 
        infoTurno.turno || turno
      )
      
      // Obtener vales del día
      const valesResult = await valesService.getValesDelDia(localId, fechaBusqueda)
      if (!valesResult.success) throw new Error(valesResult.error)
      
      // FILTRAR vales por turno secuencial
      const valesFiltrados = await this.filtrarValesPorTurno(
        valesResult.data,
        localId,
        fechaBusqueda,
        infoTurno.turno || turno
      )
      
      // Calcular total de vales FILTRADOS
      const totalValesFiltrados = valesFiltrados.reduce((sum, vale) => {
        const importeCentavos = Math.round(parseFloat(vale.importe) * 100)
        return sum + importeCentavos
      }, 0) / 100
      
      // Obtener ausencias del día
      const ausenciasResult = await ausenciasService.getAusenciasDelDia(localId, fechaBusqueda)
      if (!ausenciasResult.success) throw new Error(ausenciasResult.error)
      
      // FILTRAR ausencias por turno secuencial
      const ausenciasFiltradas = await this.filtrarAusenciasPorTurno(
        ausenciasResult.data,
        localId,
        fechaBusqueda,
        infoTurno.turno || turno
      )
      
      // Obtener hora del último cierre (si existe)
      const horaUltimoCierre = await this.getHoraUltimoCierre(localId, fechaBusqueda)
      
      // Formatear datos del reporte
      const reporte = {
        fecha: fechaBusqueda,
        turno: infoTurno.turno || turno,
        numeroTurno: infoTurno.numero || null,
        mensajeTurno: infoTurno.mensaje,
        horaInicio: horaUltimoCierre ? 
          new Date(horaUltimoCierre).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }) : 
          '05:00',
        personal: registrosFiltrados.map(registro => ({
          id: registro.id,
          empleado: `${registro.empleado.nombre} ${registro.empleado.apellido}`,
          documento: registro.empleado.documento,
          rol: registro.rol.nombre,
          horaEntrada: registro.hora_entrada,
          horaSalida: registro.hora_salida || 'EN TURNO',
          observaciones: registro.observaciones
        })),
        vales: valesFiltrados.map(vale => ({
          id: vale.id,
          empleado: `${vale.empleado.nombre} ${vale.empleado.apellido}`,
          importe: parseFloat(vale.importe),
          motivo: vale.motivo?.motivo || vale.concepto,
          concepto: vale.concepto
        })),
        totalVales: totalValesFiltrados,
        cantidadVales: valesFiltrados.length,
        ausencias: ausenciasFiltradas.map(ausencia => ({
          id: ausencia.id,
          empleado: `${ausencia.empleado.nombre} ${ausencia.empleado.apellido}`,
          motivo: ausencia.motivo.motivo,
          observaciones: ausencia.observaciones
        })),
        cantidadAusencias: ausenciasFiltradas.length,
        personalActivo: registrosFiltrados.filter(r => !r.hora_salida).length,
        personalFinalizado: registrosFiltrados.filter(r => r.hora_salida).length
      }
      
      return { success: true, data: reporte }
    } catch (error) {
      return { success: false, error: error.message || handleSupabaseError(error) }
    }
  },

  // MODIFICADO: Cerrar turno con validación horaria
  async cerrarTurno(localId, observacionesGenerales, turno = 'general', fecha = null) {
    try {
      const user = await getCurrentUser()
      const fechaCierre = fecha || format(new Date(), 'yyyy-MM-dd')
      
      // VALIDAR HORARIO DE CIERRE
      const validacion = this.validarHorarioCierre(turno)
      if (!validacion.valido) {
        return { 
          success: false, 
          error: validacion.mensaje 
        }
      }
      
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

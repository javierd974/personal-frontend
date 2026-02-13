import { supabase, handleSupabaseError, getCurrentUser } from './supabase'
import { format } from 'date-fns'

export const registrosService = {
  // NUEVO: Obtener fecha del turno activo (considera turnos que cruzan medianoche)
  async getFechaTurnoActivo(localId) {
    try {
      const ahora = new Date()
      const horaActual = ahora.getHours()
      
      // Si es antes de las 7 AM, el turno activo es del día anterior
      if (horaActual < 7) {
        const ayer = new Date(ahora)
        ayer.setDate(ayer.getDate() - 1)
        return format(ayer, 'yyyy-MM-dd')
      }
      
      // Después de las 7 AM, es el día actual
      return format(ahora, 'yyyy-MM-dd')
    } catch (error) {
      return format(new Date(), 'yyyy-MM-dd')
    }
  },

  // Registrar entrada de empleado
  async registrarEntrada(empleadoId, localId, rolId, observaciones = '') {
    try {
      const user = await getCurrentUser()
      
      // Verificar que el empleado no tenga una entrada sin salida EN CUALQUIER LOCAL
      const { data: registroActivo, error: checkError } = await supabase
        .from('registros_horarios')
        .select(`
          *,
          local:locales(nombre)
        `)
        .eq('empleado_id', empleadoId)
        .is('hora_salida', null)
        .maybeSingle()
      
      if (checkError) throw checkError
      
      if (registroActivo) {
        const localNombre = registroActivo.local?.nombre || 'otro local'
        return { 
          success: false, 
          error: `El empleado ya tiene un turno abierto en: ${localNombre}. Debe registrar salida primero.`
        }
      }
      
      // Usar la fecha del turno activo (puede ser día anterior si es madrugada)
      const fechaTurno = await this.getFechaTurnoActivo(localId)
      
      const { data, error } = await supabase
        .from('registros_horarios')
        .insert({
          empleado_id: empleadoId,
          local_id: localId,
          rol_id: rolId,
          fecha: fechaTurno,
          hora_entrada: new Date().toISOString(),
          registrado_por_entrada: user.id,
          metodo_registro: 'manual',
          observaciones: observaciones
        })
        .select(`
          *,
          empleado:empleados(nombre, apellido, documento),
          rol:roles(nombre),
          local:locales(nombre)
        `)
        .single()
      
      if (error) throw error
      
      return { success: true, data }
    } catch (error) {
      return { success: false, error: handleSupabaseError(error) }
    }
  },

  // Registrar salida de empleado
  async registrarSalida(registroId, observaciones = '') {
    try {
      const user = await getCurrentUser()
      
      const { data, error } = await supabase
        .from('registros_horarios')
        .update({
          hora_salida: new Date().toISOString(),
          registrado_por_salida: user.id,
          observaciones: observaciones
        })
        .eq('id', registroId)
        .select(`
          *,
          empleado:empleados(nombre, apellido, documento),
          rol:roles(nombre),
          local:locales(nombre)
        `)
        .single()
      
      if (error) throw error
      
      return { success: true, data }
    } catch (error) {
      return { success: false, error: handleSupabaseError(error) }
    }
  },

  // MODIFICADO: Obtener registros del turno activo (no solo del día)
  async getRegistrosDelDia(localId, fecha = null) {
    try {
      let fechaBusqueda
      
      if (fecha) {
        fechaBusqueda = fecha
      } else {
        fechaBusqueda = await this.getFechaTurnoActivo(localId)
      }
      
      // CRÍTICO: Obtener el último cierre del local para esta fecha
      const { data: ultimoCierre } = await supabase
        .from('cierres_turno')
        .select('hora_cierre')
        .eq('local_id', localId)
        .eq('fecha', fechaBusqueda)
        .order('hora_cierre', { ascending: false })
        .limit(1)
        .maybeSingle()
      
      let query = supabase
        .from('registros_horarios')
        .select(`
          *,
          empleado:empleados(nombre, apellido, documento),
          rol:roles(nombre),
          local:locales(nombre)
        `)
        .eq('local_id', localId)
        .eq('fecha', fechaBusqueda)
      
      // Si hay un cierre previo, solo mostrar registros posteriores al cierre
      if (ultimoCierre) {
        query = query.gt('hora_entrada', ultimoCierre.hora_cierre)
      }
      
      const { data, error } = await query.order('hora_entrada', { ascending: false })
      
      if (error) throw error
      
      return { success: true, data }
    } catch (error) {
      return { success: false, error: handleSupabaseError(error) }
    }
  },

  // MODIFICADO: Obtener empleados activos en turno (sin salida registrada)
  async getEmpleadosEnTurno(localId) {
    try {
      const fechaTurno = await this.getFechaTurnoActivo(localId)
      
      // CRÍTICO: Buscar empleados sin salida en el turno actual (después del último cierre)
      const { data: ultimoCierre } = await supabase
        .from('cierres_turno')
        .select('hora_cierre')
        .eq('local_id', localId)
        .eq('fecha', fechaTurno)
        .order('hora_cierre', { ascending: false })
        .limit(1)
        .maybeSingle()
      
      let query = supabase
        .from('registros_horarios')
        .select(`
          *,
          empleado:empleados(nombre, apellido, documento),
          rol:roles(nombre)
        `)
        .eq('local_id', localId)
        .eq('fecha', fechaTurno)
        .is('hora_salida', null)
      
      // Si hay cierre previo, solo mostrar registros después del cierre
      if (ultimoCierre) {
        query = query.gt('hora_entrada', ultimoCierre.hora_cierre)
      }
      
      const { data, error } = await query.order('hora_entrada', { ascending: true })
      
      if (error) throw error
      
      return { success: true, data }
    } catch (error) {
      return { success: false, error: handleSupabaseError(error) }
    }
  },

  // Obtener historial de registros de un empleado
  async getHistorialEmpleado(empleadoId, localId, desde, hasta) {
    try {
      let query = supabase
        .from('registros_horarios')
        .select(`
          *,
          empleado:empleados(nombre, apellido, documento),
          rol:roles(nombre),
          local:locales(nombre)
        `)
        .eq('empleado_id', empleadoId)
      
      if (localId) {
        query = query.eq('local_id', localId)
      }
      
      if (desde) {
        query = query.gte('fecha', desde)
      }
      
      if (hasta) {
        query = query.lte('fecha', hasta)
      }
      
      query = query.order('fecha', { ascending: false })
        .order('hora_entrada', { ascending: false })
      
      const { data, error } = await query
      
      if (error) throw error
      
      return { success: true, data }
    } catch (error) {
      return { success: false, error: handleSupabaseError(error) }
    }
  },

  // Modificar registro (solo para correcciones)
  async modificarRegistro(registroId, updates) {
    try {
      const { data, error } = await supabase
        .from('registros_horarios')
        .update(updates)
        .eq('id', registroId)
        .select(`
          *,
          empleado:empleados(nombre, apellido, documento),
          rol:roles(nombre),
          local:locales(nombre)
        `)
        .single()
      
      if (error) throw error
      
      return { success: true, data }
    } catch (error) {
      return { success: false, error: handleSupabaseError(error) }
    }
  },

  // Verificar si un empleado puede registrar entrada
  async puedeRegistrarEntrada(empleadoId) {
    try {
      const { data, error } = await supabase
        .from('registros_horarios')
        .select('id, local:locales(nombre), hora_entrada')
        .eq('empleado_id', empleadoId)
        .is('hora_salida', null)
        .maybeSingle()
      
      if (error) throw error
      
      return { 
        success: true, 
        puede: !data,
        registroActivo: data 
      }
    } catch (error) {
      return { success: false, error: handleSupabaseError(error) }
    }
  }
}
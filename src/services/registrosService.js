import { supabase, handleSupabaseError, getCurrentUser } from './supabase'
import { format } from 'date-fns'

// Minutos que deben pasar entre dos marcaciones (entrada o salida) del MISMO
// empleado. Es el mismo valor que aplica el trigger validar_cooldown_marcacion
// en la base: aca se pre-valida solo para dar un mensaje claro antes de escribir.
// Si se cambia uno hay que cambiar el otro.
export const COOLDOWN_MINUTOS = 5

export const registrosService = {
  // Obtener fecha del turno activo (considera turnos que cruzan medianoche)
  async getFechaTurnoActivo(localId) {
    try {
      const ahora = new Date()
      const horaActual = ahora.getHours()
      
      // Si es antes de las 5 AM, el turno activo es del día anterior
      if (horaActual < 5) {
        const ayer = new Date(ahora)
        ayer.setDate(ayer.getDate() - 1)
        return format(ayer, 'yyyy-MM-dd')
      }
      
      // Después de las 5 AM, es el día actual
      return format(ahora, 'yyyy-MM-dd')
    } catch (error) {
      return format(new Date(), 'yyyy-MM-dd')
    }
  },

  // Registrar entrada de empleado
  async registrarEntrada(empleadoId, localId, rolId, observaciones = '', metodo = 'manual') {
    try {
      const user = await getCurrentUser()
      
      // Verificar que el empleado no tenga una entrada sin salida EN CUALQUIER
      // LOCAL y de CUALQUIER FECHA (un turno abierto de otro dia tambien bloquea).
      // Se usa limit(1) en vez de maybeSingle(): si por un arrastre historico hay
      // mas de un turno abierto, maybeSingle() reventaba con un error de multiples
      // filas en lugar de avisar que hay un turno abierto.
      const { data: abiertos, error: checkError } = await supabase
        .from('registros_horarios')
        .select(`
          *,
          local:locales(nombre)
        `)
        .eq('empleado_id', empleadoId)
        .is('hora_salida', null)
        .order('hora_entrada', { ascending: false })
        .limit(1)
      
      if (checkError) throw checkError
      const registroActivo = abiertos && abiertos[0]
      
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
          metodo_registro: metodo,
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

  // CORREGIDO: Obtener registros del turno activo con filtro de cierre mejorado
  async getRegistrosDelDia(localId, fecha = null) {
    try {
      let fechaBusqueda
      
      if (fecha) {
        fechaBusqueda = fecha
      } else {
        fechaBusqueda = await this.getFechaTurnoActivo(localId)
      }
      
      // Obtener registros de la fecha del turno
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
      
      const { data: registros, error } = await query.order('hora_entrada', { ascending: false })
      
      if (error) throw error
      
      // FILTRO MEJORADO: Obtener último cierre y filtrar en JavaScript
      const { data: ultimoCierre } = await supabase
        .from('cierres_turno')
        .select('hora_cierre')
        .eq('local_id', localId)
        .eq('fecha', fechaBusqueda)
        .order('hora_cierre', { ascending: false })
        .limit(1)
        .maybeSingle()
      
      // Si hay cierre, filtrar registros POSTERIORES al cierre
      if (ultimoCierre) {
        const horaCierre = new Date(ultimoCierre.hora_cierre)
        const registrosFiltrados = registros.filter(r => {
          const horaEntrada = new Date(r.hora_entrada)
          return horaEntrada > horaCierre
        })
        return { success: true, data: registrosFiltrados }
      }
      
      return { success: true, data: registros }
    } catch (error) {
      return { success: false, error: handleSupabaseError(error) }
    }
  },

  // CORREGIDO: Obtener empleados activos en turno con filtro mejorado
  async getEmpleadosEnTurno(localId) {
    try {
      const fechaTurno = await this.getFechaTurnoActivo(localId)
      
      // Obtener todos los registros sin salida de la fecha del turno
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
      
      const { data: registros, error } = await query.order('hora_entrada', { ascending: true })
      
      if (error) throw error
      
      // FILTRO MEJORADO: Obtener último cierre y filtrar en JavaScript
      const { data: ultimoCierre } = await supabase
        .from('cierres_turno')
        .select('hora_cierre')
        .eq('local_id', localId)
        .eq('fecha', fechaTurno)
        .order('hora_cierre', { ascending: false })
        .limit(1)
        .maybeSingle()
      
      // Si hay cierre, filtrar registros POSTERIORES al cierre
      if (ultimoCierre) {
        const horaCierre = new Date(ultimoCierre.hora_cierre)
        const registrosFiltrados = registros.filter(r => {
          const horaEntrada = new Date(r.hora_entrada)
          return horaEntrada > horaCierre
        })
        return { success: true, data: registrosFiltrados }
      }
      
      return { success: true, data: registros }
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

  // Marcar / desmarcar un registro como franco trabajado
  async marcarFrancoTrabajado(registroId, esFranco) {
    try {
      const { data, error } = await supabase
        .from('registros_horarios')
        .update({ es_franco: esFranco })
        .eq('id', registroId)
        .select('id, es_franco')
        .single()
      if (error) throw error
      return { success: true, data }
    } catch (error) {
      return { success: false, error: handleSupabaseError(error) }
    }
  },

  // Control anti-abuso: registros MANUALES con IP/dispositivo del que los cargó
  // (solo admin/rrhh, por la RPC). soloSospechosos = manual desde celular.
  async getControlRegistros(desde = null, soloSospechosos = false) {
    try {
      const params = { p_solo_sospechosos: soloSospechosos }
      if (desde) params.p_desde = desde
      const { data, error } = await supabase.rpc('control_registros', params)
      if (error) throw error
      return { success: true, data }
    } catch (error) {
      return { success: false, error: handleSupabaseError(error) }
    }
  },

  // Verificar si un empleado puede registrar entrada
  async puedeRegistrarEntrada(empleadoId) {
    const result = await this.getRegistroAbierto(empleadoId)
    if (!result.success) return result
    return { success: true, puede: !result.data, registroActivo: result.data }
  },

  // Turno abierto del empleado en CUALQUIER local y de CUALQUIER fecha.
  // Sin filtro por fecha a proposito: un ingreso que quedo abierto de otro dia
  // igual impide una entrada nueva, y lo que corresponde es cerrarlo (salida).
  // Devuelve data = null si no tiene ninguno.
  async getRegistroAbierto(empleadoId) {
    try {
      const { data, error } = await supabase
        .from('registros_horarios')
        .select('id, fecha, hora_entrada, local_id, local:locales(nombre), rol:roles(nombre)')
        .eq('empleado_id', empleadoId)
        .is('hora_salida', null)
        .order('hora_entrada', { ascending: false })
        .limit(1)
      
      if (error) throw error
      
      return { success: true, data: (data && data[0]) || null }
    } catch (error) {
      return { success: false, error: handleSupabaseError(error) }
    }
  },

  // Pre-validacion del cooldown: replica lo que hace el trigger
  // validar_cooldown_marcacion, mirando la ultima marcacion (entrada O salida)
  // del empleado en las ultimas 24 hs. Es solo para avisar antes de escribir;
  // la base sigue siendo la autoridad final.
  async verificarCooldown(empleadoId) {
    try {
      const ahora = Date.now()
      const desde = new Date(ahora - 24 * 60 * 60 * 1000).toISOString()
      const { data, error } = await supabase
        .from('registros_horarios')
        .select('hora_entrada, hora_salida')
        .eq('empleado_id', empleadoId)
        .gte('hora_entrada', desde)
      
      if (error) throw error
      
      let ultima = null
      for (const r of data || []) {
        for (const t of [r.hora_entrada, r.hora_salida]) {
          if (!t) continue
          const ms = new Date(t).getTime()
          if (ms > ahora) continue          // marcaciones futuras no cuentan
          if (ultima === null || ms > ultima) ultima = ms
        }
      }
      
      if (ultima === null) return { success: true, puede: true }
      
      const cooldownMs = COOLDOWN_MINUTOS * 60 * 1000
      const transcurrido = ahora - ultima
      if (transcurrido >= cooldownMs) return { success: true, puede: true }
      
      return {
        success: true,
        puede: false,
        faltan: Math.max(Math.ceil((cooldownMs - transcurrido) / 60000), 1),
        ultima: new Date(ultima)
      }
    } catch (error) {
      return { success: false, error: handleSupabaseError(error) }
    }
  }
}

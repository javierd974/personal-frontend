import { supabase, handleSupabaseError, getCurrentUser } from './supabase'
import { format } from 'date-fns'

// Helper para obtener fecha del turno activo
const getFechaTurnoActivo = () => {
  const ahora = new Date()
  const horaActual = ahora.getHours()
  if (horaActual < 7) {
    const ayer = new Date(ahora)
    ayer.setDate(ayer.getDate() - 1)
    return format(ayer, 'yyyy-MM-dd')
  }
  return format(ahora, 'yyyy-MM-dd')
}

// Helper: obtener created_at del último reporte de estado del día para un local
const getHoraUltimoReporte = async (localId) => {
  try {
    const fecha = getFechaTurnoActivo()
    const { data } = await supabase
      .from('reportes_estado')
      .select('created_at')
      .eq('local_id', localId)
      .eq('fecha', fecha)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    return data ? new Date(data.created_at) : null
  } catch {
    return null
  }
}

export const localesService = {
  async getLocalesUsuario() {
    try {
      const user = await getCurrentUser()
      const { data, error } = await supabase
        .from('locales')
        .select(`*, usuarios_locales!inner(usuario_id)`)
        .eq('usuarios_locales.usuario_id', user.id)
        .eq('usuarios_locales.activo', true)
        .eq('activo', true)
        .order('nombre', { ascending: true })
      if (error) throw error
      return { success: true, data }
    } catch (error) {
      return { success: false, error: handleSupabaseError(error) }
    }
  },

  async getLocalById(localId) {
    try {
      const { data, error } = await supabase
        .from('locales').select('*').eq('id', localId).single()
      if (error) throw error
      return { success: true, data }
    } catch (error) {
      return { success: false, error: handleSupabaseError(error) }
    }
  }
}

export const observacionesTurnoService = {
  async getObservacion(localId) {
    try {
      const fecha = getFechaTurnoActivo()
      const { data, error } = await supabase
        .from('observaciones_turno')
        .select('*').eq('local_id', localId).eq('fecha', fecha).maybeSingle()
      if (error) throw error
      return { success: true, data: data?.contenido || '' }
    } catch (error) {
      return { success: false, error: handleSupabaseError(error) }
    }
  },

  async guardarObservacion(localId, contenido) {
    try {
      const user = await getCurrentUser()
      const fecha = getFechaTurnoActivo()
      const { data, error } = await supabase
        .from('observaciones_turno')
        .upsert(
          { local_id: localId, fecha, contenido, actualizado_por: user.id, actualizado_at: new Date().toISOString() },
          { onConflict: 'local_id,fecha' }
        ).select().single()
      if (error) throw error
      return { success: true, data }
    } catch (error) {
      return { success: false, error: handleSupabaseError(error) }
    }
  }
}

export const valesService = {
  async registrarVale(valeData) {
    try {
      const user = await getCurrentUser()
      const fechaTurno = getFechaTurnoActivo()
      const { data, error } = await supabase
        .from('vales_caja')
        .insert({
          local_id: valeData.local_id,
          empleado_id: valeData.empleado_id,
          motivo_id: valeData.motivo_id,
          fecha: fechaTurno,
          importe: valeData.importe,
          concepto: valeData.concepto || null,
          registrado_por: user.id
        })
        .select(`*, empleado:empleados(nombre, apellido), motivo:motivos_vales(motivo, descuenta_sueldo)`)
        .single()
      if (error) throw error
      return { success: true, data }
    } catch (error) {
      return { success: false, error: handleSupabaseError(error) }
    }
  },

  async getValesDelDia(localId, fecha = null) {
    try {
      const fechaBusqueda = fecha || getFechaTurnoActivo()

      // Hora del último cierre de turno (para filtrar qué mostrar)
      const { data: ultimoCierre } = await supabase
        .from('cierres_turno')
        .select('hora_cierre')
        .eq('local_id', localId).eq('fecha', fechaBusqueda)
        .order('hora_cierre', { ascending: false }).limit(1).maybeSingle()

      let query = supabase
        .from('vales_caja')
        .select(`*, empleado:empleados(nombre, apellido, documento), motivo:motivos_vales(motivo, descuenta_sueldo)`)
        .eq('local_id', localId).eq('fecha', fechaBusqueda)

      if (ultimoCierre) {
        query = query.gt('created_at', ultimoCierre.hora_cierre)
      }

      const { data, error } = await query.order('created_at', { ascending: false })
      if (error) throw error

      // Marcar cada vale como eliminable según el último reporte
      const horaUltimoReporte = await getHoraUltimoReporte(localId)
      const valesConFlag = data.map(vale => ({
        ...vale,
        eliminable: horaUltimoReporte === null || new Date(vale.created_at) > horaUltimoReporte
      }))

      return { success: true, data: valesConFlag }
    } catch (error) {
      return { success: false, error: handleSupabaseError(error) }
    }
  },

  async getTotalValesDelDia(localId, fecha = null) {
    try {
      const fechaBusqueda = fecha || getFechaTurnoActivo()
      const { data: ultimoCierre } = await supabase
        .from('cierres_turno')
        .select('hora_cierre')
        .eq('local_id', localId).eq('fecha', fechaBusqueda)
        .order('hora_cierre', { ascending: false }).limit(1).maybeSingle()

      let query = supabase
        .from('vales_caja').select('importe')
        .eq('local_id', localId).eq('fecha', fechaBusqueda)

      if (ultimoCierre) {
        query = query.gt('created_at', ultimoCierre.hora_cierre)
      }

      const { data, error } = await query
      if (error) throw error

      const total = data.reduce((sum, vale) => sum + parseInt(vale.importe, 10), 0)
      return { success: true, total, cantidad: data.length }
    } catch (error) {
      return { success: false, error: handleSupabaseError(error) }
    }
  },

  async eliminarVale(valeId) {
    try {
      const { error } = await supabase.from('vales_caja').delete().eq('id', valeId)
      if (error) throw error
      return { success: true }
    } catch (error) {
      return { success: false, error: handleSupabaseError(error) }
    }
  }
}

export const ausenciasService = {
  async registrarAusencia(ausenciaData) {
    try {
      const user = await getCurrentUser()
      const fechaTurno = getFechaTurnoActivo()
      const { data, error } = await supabase
        .from('ausencias')
        .insert({
          empleado_id: ausenciaData.empleado_id,
          local_id: ausenciaData.local_id,
          fecha: fechaTurno,
          motivo_id: ausenciaData.motivo_id,
          observaciones: ausenciaData.observaciones,
          registrado_por: user.id
        })
        .select(`*, empleado:empleados(nombre, apellido, documento), motivo:motivos_ausencia(motivo)`)
        .single()
      if (error) throw error
      return { success: true, data }
    } catch (error) {
      return { success: false, error: handleSupabaseError(error) }
    }
  },

  async getAusenciasDelDia(localId, fecha = null) {
    try {
      const fechaBusqueda = fecha || getFechaTurnoActivo()
      const { data: ultimoCierre } = await supabase
        .from('cierres_turno')
        .select('hora_cierre')
        .eq('local_id', localId).eq('fecha', fechaBusqueda)
        .order('hora_cierre', { ascending: false }).limit(1).maybeSingle()

      let query = supabase
        .from('ausencias')
        .select(`*, empleado:empleados(nombre, apellido, documento), motivo:motivos_ausencia(motivo, requiere_justificacion)`)
        .eq('local_id', localId).eq('fecha', fechaBusqueda)

      if (ultimoCierre) {
        query = query.gt('created_at', ultimoCierre.hora_cierre)
      }

      const { data, error } = await query.order('created_at', { ascending: false })
      if (error) throw error

      // Marcar cada ausencia como eliminable según el último reporte
      const horaUltimoReporte = await getHoraUltimoReporte(localId)
      const ausenciasConFlag = data.map(ausencia => ({
        ...ausencia,
        eliminable: horaUltimoReporte === null || new Date(ausencia.created_at) > horaUltimoReporte
      }))

      return { success: true, data: ausenciasConFlag }
    } catch (error) {
      return { success: false, error: handleSupabaseError(error) }
    }
  },

  async eliminarAusencia(ausenciaId) {
    try {
      const { error } = await supabase.from('ausencias').delete().eq('id', ausenciaId)
      if (error) throw error
      return { success: true }
    } catch (error) {
      return { success: false, error: handleSupabaseError(error) }
    }
  }
}

export const rolesService = {
  async getRoles() {
    try {
      const { data, error } = await supabase
        .from('roles').select('*').eq('activo', true).order('nombre', { ascending: true })
      if (error) throw error
      return { success: true, data }
    } catch (error) {
      return { success: false, error: handleSupabaseError(error) }
    }
  }
}

export const motivosAusenciaService = {
  async getMotivos() {
    try {
      const { data, error } = await supabase
        .from('motivos_ausencia').select('*').eq('activo', true).order('motivo', { ascending: true })
      if (error) throw error
      return { success: true, data }
    } catch (error) {
      return { success: false, error: handleSupabaseError(error) }
    }
  }
}

export const motivosValesService = {
  async getMotivos() {
    try {
      const { data, error } = await supabase
        .from('motivos_vales').select('*').eq('activo', true)
        .order('descuenta_sueldo', { ascending: false })
        .order('motivo', { ascending: true })
      if (error) throw error
      return { success: true, data }
    } catch (error) {
      return { success: false, error: handleSupabaseError(error) }
    }
  }
}

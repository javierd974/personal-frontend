import { supabase, handleSupabaseError, getCurrentUser } from './supabase'
import { format } from 'date-fns'

export const localesService = {
  // Obtener locales del usuario actual
  async getLocalesUsuario() {
    try {
      const user = await getCurrentUser()
      
      const { data, error } = await supabase
        .from('locales')
        .select(`
          *,
          usuarios_locales!inner(usuario_id)
        `)
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

  // Obtener un local por ID
  async getLocalById(localId) {
    try {
      const { data, error } = await supabase
        .from('locales')
        .select('*')
        .eq('id', localId)
        .single()
      
      if (error) throw error
      
      return { success: true, data }
    } catch (error) {
      return { success: false, error: handleSupabaseError(error) }
    }
  }
}

export const valesService = {
  // Registrar un vale de caja
  async registrarVale(valeData) {
    try {
      const user = await getCurrentUser()
      
      const { data, error } = await supabase
        .from('vales_caja')
        .insert({
          local_id: valeData.local_id,
          empleado_id: valeData.empleado_id,
          motivo_id: valeData.motivo_id,
          fecha: valeData.fecha || format(new Date(), 'yyyy-MM-dd'),
          importe: valeData.importe,
          concepto: valeData.concepto || null,
          registrado_por: user.id
        })
        .select(`
          *,
          empleado:empleados(nombre, apellido),
          motivo:motivos_vales(motivo, descuenta_sueldo)
        `)
        .single()
      
      if (error) throw error
      
      return { success: true, data }
    } catch (error) {
      return { success: false, error: handleSupabaseError(error) }
    }
  },

  // Obtener vales del día por local (del turno actual)
  async getValesDelDia(localId, fecha = null) {
    try {
      const fechaBusqueda = fecha || format(new Date(), 'yyyy-MM-dd')
      
      // Obtener hora del último cierre
      const { data: ultimoCierre } = await supabase
        .from('cierres_turno')
        .select('hora_cierre')
        .eq('local_id', localId)
        .eq('fecha', fechaBusqueda)
        .order('numero_turno', { ascending: false })
        .limit(1)
        .maybeSingle()
      
      let query = supabase
        .from('vales_caja')
        .select(`
          *,
          empleado:empleados(nombre, apellido, documento),
          motivo:motivos_vales(motivo, descuenta_sueldo)
        `)
        .eq('local_id', localId)
        .eq('fecha', fechaBusqueda)
      
      // Si hay un cierre previo, solo mostrar vales posteriores
      if (ultimoCierre) {
        query = query.gt('created_at', ultimoCierre.hora_cierre)
      }
      
      const { data, error } = await query.order('created_at', { ascending: false })
      
      if (error) throw error
      
      return { success: true, data }
    } catch (error) {
      return { success: false, error: handleSupabaseError(error) }
    }
  },

  // Obtener total de vales del día (del turno actual)
  async getTotalValesDelDia(localId, fecha = null) {
    try {
      const fechaBusqueda = fecha || format(new Date(), 'yyyy-MM-dd')
      
      // Obtener hora del último cierre
      const { data: ultimoCierre } = await supabase
        .from('cierres_turno')
        .select('hora_cierre')
        .eq('local_id', localId)
        .eq('fecha', fechaBusqueda)
        .order('numero_turno', { ascending: false })
        .limit(1)
        .maybeSingle()
      
      let query = supabase
        .from('vales_caja')
        .select('importe')
        .eq('local_id', localId)
        .eq('fecha', fechaBusqueda)
      
      // Si hay un cierre previo, solo contar vales posteriores
      if (ultimoCierre) {
        query = query.gt('created_at', ultimoCierre.hora_cierre)
      }
      
      const { data, error } = await query
      
      if (error) throw error
      
      // Calcular total en centavos para evitar errores de punto flotante
      const totalCentavos = data.reduce((sum, vale) => {
        const importeCentavos = Math.round(parseFloat(vale.importe) * 100)
        return sum + importeCentavos
      }, 0)
      
      // Convertir de vuelta a pesos
      const total = totalCentavos / 100
      
      return { success: true, total, cantidad: data.length }
    } catch (error) {
      return { success: false, error: handleSupabaseError(error) }
    }
  },

  // Eliminar vale
  async eliminarVale(valeId) {
    try {
      const { error } = await supabase
        .from('vales_caja')
        .delete()
        .eq('id', valeId)
      
      if (error) throw error
      
      return { success: true }
    } catch (error) {
      return { success: false, error: handleSupabaseError(error) }
    }
  }
}

export const ausenciasService = {
  // Registrar ausencia
  async registrarAusencia(ausenciaData) {
    try {
      const user = await getCurrentUser()
      
      const { data, error } = await supabase
        .from('ausencias')
        .insert({
          empleado_id: ausenciaData.empleado_id,
          local_id: ausenciaData.local_id,
          fecha: ausenciaData.fecha || format(new Date(), 'yyyy-MM-dd'),
          motivo_id: ausenciaData.motivo_id,
          observaciones: ausenciaData.observaciones,
          registrado_por: user.id
        })
        .select(`
          *,
          empleado:empleados(nombre, apellido, documento),
          motivo:motivos_ausencia(motivo)
        `)
        .single()
      
      if (error) throw error
      
      return { success: true, data }
    } catch (error) {
      return { success: false, error: handleSupabaseError(error) }
    }
  },

  // Obtener ausencias del día (del turno actual)
  async getAusenciasDelDia(localId, fecha = null) {
    try {
      const fechaBusqueda = fecha || format(new Date(), 'yyyy-MM-dd')
      
      // Obtener hora del último cierre
      const { data: ultimoCierre } = await supabase
        .from('cierres_turno')
        .select('hora_cierre')
        .eq('local_id', localId)
        .eq('fecha', fechaBusqueda)
        .order('numero_turno', { ascending: false })
        .limit(1)
        .maybeSingle()
      
      let query = supabase
        .from('ausencias')
        .select(`
          *,
          empleado:empleados(nombre, apellido, documento),
          motivo:motivos_ausencia(motivo, requiere_justificacion)
        `)
        .eq('local_id', localId)
        .eq('fecha', fechaBusqueda)
      
      // Si hay un cierre previo, solo mostrar ausencias posteriores
      if (ultimoCierre) {
        query = query.gt('created_at', ultimoCierre.hora_cierre)
      }
      
      const { data, error } = await query.order('created_at', { ascending: false })
      
      if (error) throw error
      
      return { success: true, data }
    } catch (error) {
      return { success: false, error: handleSupabaseError(error) }
    }
  },

  // Eliminar ausencia
  async eliminarAusencia(ausenciaId) {
    try {
      const { error } = await supabase
        .from('ausencias')
        .delete()
        .eq('id', ausenciaId)
      
      if (error) throw error
      
      return { success: true }
    } catch (error) {
      return { success: false, error: handleSupabaseError(error) }
    }
  }
}

export const rolesService = {
  // Obtener todos los roles activos
  async getRoles() {
    try {
      const { data, error } = await supabase
        .from('roles')
        .select('*')
        .eq('activo', true)
        .order('nombre', { ascending: true })
      
      if (error) throw error
      
      return { success: true, data }
    } catch (error) {
      return { success: false, error: handleSupabaseError(error) }
    }
  }
}

export const motivosAusenciaService = {
  // Obtener todos los motivos de ausencia
  async getMotivos() {
    try {
      const { data, error} = await supabase
        .from('motivos_ausencia')
        .select('*')
        .eq('activo', true)
        .order('motivo', { ascending: true })
      
      if (error) throw error
      
      return { success: true, data }
    } catch (error) {
      return { success: false, error: handleSupabaseError(error) }
    }
  }
}

export const motivosValesService = {
  // Obtener todos los motivos de vales
  async getMotivos() {
    try {
      const { data, error } = await supabase
        .from('motivos_vales')
        .select('*')
        .eq('activo', true)
        .order('descuenta_sueldo', { ascending: false })
        .order('motivo', { ascending: true })
      
      if (error) throw error
      
      return { success: true, data }
    } catch (error) {
      return { success: false, error: handleSupabaseError(error) }
    }
  }
}

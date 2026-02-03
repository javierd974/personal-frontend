import { supabase, handleSupabaseError } from './supabase'

export const empleadosService = {
  // Obtener TODOS los empleados (GLOBALES - sin filtro de local)
  async getEmpleadosPorLocal(localId) {
    try {
      // Ahora devuelve TODOS los empleados activos, sin importar el local
      const { data, error } = await supabase
        .from('empleados')
        .select('*')
        .eq('activo', true)
        .order('apellido', { ascending: true })
        .order('nombre', { ascending: true })
      
      if (error) throw error
      
      return { success: true, data }
    } catch (error) {
      return { success: false, error: handleSupabaseError(error) }
    }
  },

  // Obtener un empleado por ID
  async getEmpleadoById(empleadoId) {
    try {
      const { data, error } = await supabase
        .from('empleados')
        .select('*')
        .eq('id', empleadoId)
        .single()
      
      if (error) throw error
      
      return { success: true, data }
    } catch (error) {
      return { success: false, error: handleSupabaseError(error) }
    }
  },

  // Crear nuevo empleado (GLOBAL - sin asignación a locales)
  async crearEmpleado(empleadoData) {
    try {
      // Crear empleado
      const { data: empleado, error: empleadoError } = await supabase
        .from('empleados')
        .insert({
          nombre: empleadoData.nombre,
          apellido: empleadoData.apellido,
          documento: empleadoData.documento,
          telefono: empleadoData.telefono,
          email: empleadoData.email,
          fecha_ingreso: empleadoData.fecha_ingreso || new Date().toISOString(),
        })
        .select()
        .single()
      
      if (empleadoError) throw empleadoError
      
      return { success: true, data: empleado }
    } catch (error) {
      return { success: false, error: handleSupabaseError(error) }
    }
  },

  // Actualizar empleado
  async actualizarEmpleado(empleadoId, updates) {
    try {
      const { data, error } = await supabase
        .from('empleados')
        .update(updates)
        .eq('id', empleadoId)
        .select()
        .single()
      
      if (error) throw error
      
      return { success: true, data }
    } catch (error) {
      return { success: false, error: handleSupabaseError(error) }
    }
  },

  // Desactivar empleado (soft delete)
  async desactivarEmpleado(empleadoId) {
    try {
      const { data, error } = await supabase
        .from('empleados')
        .update({ activo: false })
        .eq('id', empleadoId)
        .select()
        .single()
      
      if (error) throw error
      
      return { success: true, data }
    } catch (error) {
      return { success: false, error: handleSupabaseError(error) }
    }
  },

  // Buscar empleado por documento
  async buscarPorDocumento(documento) {
    try {
      const { data, error } = await supabase
        .from('empleados')
        .select('*')
        .eq('documento', documento)
        .eq('activo', true)
        .maybeSingle()
      
      if (error) throw error
      
      return { success: true, data }
    } catch (error) {
      return { success: false, error: handleSupabaseError(error) }
    }
  }
}

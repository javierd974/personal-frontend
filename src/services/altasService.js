import { supabase, handleSupabaseError } from './supabase'

// Alta de empleados autorizada por un DNI aprobado previamente por administración
// (solicitud tipo empleado_nuevo aprobada en la app de Control).
export const altasService = {
  // Lista de DNIs autorizados pendientes de carga
  async listarAltasAutorizadas() {
    try {
      const { data, error } = await supabase.rpc('personal_altas_autorizadas')
      if (error) throw error
      return { success: true, data: data || [] }
    } catch (error) {
      return { success: false, error: handleSupabaseError(error) }
    }
  },

  // Carga/reactiva el empleado usando el DNI autorizado.
  // datos: objeto con los campos de la tabla empleados (el DNI lo fuerza el backend)
  async cargarEmpleadoAutorizado(solicitudId, datos) {
    try {
      const { data, error } = await supabase.rpc('personal_alta_empleado_autorizado', {
        p_solicitud: solicitudId,
        p_datos: datos
      })
      if (error) throw error
      return { success: true, data }
    } catch (error) {
      return { success: false, error: handleSupabaseError(error) }
    }
  }
}

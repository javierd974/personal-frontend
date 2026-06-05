// =====================================================
// SERVICIO DE COMUNICADOS - SmartDom Personal
// Recepcion de comunicados RRHH -> Local + acuse de recibo.
// Feature v1.x (pop-up en dashboard del encargado)
// =====================================================

import { supabase, handleSupabaseError } from './supabase'

export const comunicadosService = {
  // Comunicados pendientes (no vistos) para un local
  async getPendientes(localId) {
    try {
      const { data, error } = await supabase
        .from('comunicados_locales')
        .select('id, mensaje, emisor_nombre, enviado_at')
        .eq('local_id', localId)
        .eq('estado', 'pendiente')
        .order('enviado_at', { ascending: true })
      if (error) throw error
      return { success: true, data }
    } catch (error) {
      return { success: false, error: handleSupabaseError(error) }
    }
  },

  // Trae un comunicado puntual (para resolver un evento realtime por id)
  async getById(id) {
    try {
      const { data, error } = await supabase
        .from('comunicados_locales')
        .select('id, mensaje, emisor_nombre, enviado_at, estado')
        .eq('id', id)
        .maybeSingle()
      if (error) throw error
      return { success: true, data }
    } catch (error) {
      return { success: false, error: handleSupabaseError(error) }
    }
  },

  // Marca un comunicado como visto = acuse de recibo (hora de cierre del pop-up)
  async marcarVisto(id, { usuarioId, usuarioNombre }) {
    try {
      const { error } = await supabase
        .from('comunicados_locales')
        .update({
          estado: 'visto',
          visto_at: new Date().toISOString(),
          visto_usuario_id: usuarioId || null,
          visto_usuario_nombre: usuarioNombre || null,
        })
        .eq('id', id)
        .eq('estado', 'pendiente') // evita pisar un visto ya registrado
      if (error) throw error
      return { success: true }
    } catch (error) {
      return { success: false, error: handleSupabaseError(error) }
    }
  },
}

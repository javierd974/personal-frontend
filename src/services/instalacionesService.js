import { supabase, handleSupabaseError } from './supabase'

export const instalacionesService = {
  // Estado de instalación de kioscos por máquina (solo admin/rrhh por RLS)
  async getInstalaciones() {
    try {
      const { data, error } = await supabase
        .from('kiosco_instalaciones')
        .select('*, local:locales(nombre)')
        .order('updated_at', { ascending: false })
      if (error) throw error
      return { success: true, data }
    } catch (error) {
      return { success: false, error: handleSupabaseError(error) }
    }
  }
}

import { supabase, handleSupabaseError } from './supabase'

export const authService = {
  // Iniciar sesión
  async signIn(email, password) {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      
      if (error) throw error
      
      return { success: true, data }
    } catch (error) {
      return { success: false, error: handleSupabaseError(error) }
    }
  },

  // Registrar nuevo usuario
  async signUp(email, password, userData) {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            nombre: userData.nombre,
            apellido: userData.apellido,
          }
        }
      })
      
      if (error) throw error
      
      // Actualizar información adicional en la tabla usuarios
      if (data.user) {
        const { error: updateError } = await supabase
          .from('usuarios')
          .update({
            telefono: userData.telefono,
          })
          .eq('id', data.user.id)
        
        if (updateError) throw updateError
      }
      
      return { success: true, data }
    } catch (error) {
      return { success: false, error: handleSupabaseError(error) }
    }
  },

  // Cerrar sesión
  async signOut() {
    try {
      const { error } = await supabase.auth.signOut()
      if (error) throw error
      return { success: true }
    } catch (error) {
      return { success: false, error: handleSupabaseError(error) }
    }
  },

  // Obtener usuario actual
  async getCurrentUser() {
    try {
      const { data: { user }, error } = await supabase.auth.getUser()
      if (error) throw error
      
      if (!user) return { success: false, error: 'No hay usuario autenticado' }
      
      // Obtener datos adicionales del usuario incluyendo el rol
      const { data: userData, error: userError } = await supabase
        .from('usuarios')
        .select('*')
        .eq('id', user.id)
        .single()
      
      if (userError) throw userError
      
      return { success: true, data: userData }
    } catch (error) {
      return { success: false, error: handleSupabaseError(error) }
    }
  },

  // Recuperar contraseña
  async resetPassword(email) {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      })
      
      if (error) throw error
      return { success: true }
    } catch (error) {
      return { success: false, error: handleSupabaseError(error) }
    }
  },

  // Actualizar contraseña
  async updatePassword(newPassword) {
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      })
      
      if (error) throw error
      return { success: true }
    } catch (error) {
      return { success: false, error: handleSupabaseError(error) }
    }
  },

  // Verificar sesión
  async checkSession() {
    const { data: { session } } = await supabase.auth.getSession()
    return session
  }
}

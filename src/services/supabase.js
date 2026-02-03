import { createClient } from '@supabase/supabase-js'

// IMPORTANTE: Reemplazar con tus credenciales de Supabase
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'YOUR_SUPABASE_URL'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'YOUR_SUPABASE_ANON_KEY'

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
})

// Helper para manejar errores de Supabase
export const handleSupabaseError = (error) => {
  console.error('Supabase Error:', error)
  
  if (error.message) {
    return error.message
  }
  
  return 'Ha ocurrido un error. Por favor, intente nuevamente.'
}

// Helper para obtener el usuario actual
export const getCurrentUser = async () => {
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error) throw error
  return user
}

// Helper para verificar si el usuario está autenticado
export const isAuthenticated = async () => {
  const { data: { session } } = await supabase.auth.getSession()
  return !!session
}

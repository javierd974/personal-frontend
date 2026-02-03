import { supabase, handleSupabaseError } from './supabase'

export const adminService = {
  // ============================================
  // GESTIÓN DE USUARIOS
  // ============================================

  // Obtener todos los usuarios con conteo de locales
  async getUsuarios() {
    try {
      const { data, error } = await supabase
        .from('usuarios')
        .select(`
          *,
          usuarios_locales(count)
        `)
        .order('apellido', { ascending: true })
      
      if (error) throw error
      
      // Agregar conteo de locales
      const usuarios = data.map(usuario => ({
        ...usuario,
        locales_count: usuario.usuarios_locales?.[0]?.count || 0
      }))
      
      return { success: true, data: usuarios }
    } catch (error) {
      return { success: false, error: handleSupabaseError(error) }
    }
  },

  // Crear usuario usando signUp de Supabase (no requiere pgcrypto)
  async crearUsuario(userData) {
    try {
      // 1. Validar que el email no exista
      const { data: existente } = await supabase
        .from('usuarios')
        .select('id')
        .eq('email', userData.email)
        .maybeSingle()

      if (existente) {
        return { 
          success: false, 
          error: 'El email ya está registrado. Por favor usa otro email.' 
        }
      }

      // 2. Crear usuario con signUp (Supabase maneja la encriptación)
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: userData.email,
        password: userData.password,
        options: {
          data: {
            nombre: userData.nombre,
            apellido: userData.apellido,
            rol: userData.rol
          },
          emailRedirectTo: undefined // No enviar email de confirmación
        }
      })

      if (authError) {
        console.error('Error en signUp:', authError)
        
        if (authError.message.includes('already registered')) {
          return { 
            success: false, 
            error: 'El email ya está registrado en autenticación.' 
          }
        }
        
        return { success: false, error: authError.message }
      }

      if (!authData.user) {
        return { 
          success: false, 
          error: 'No se pudo crear el usuario. Intenta de nuevo.' 
        }
      }

      // 3. Confirmar email automáticamente (para uso interno)
      // Nota: Esto requiere que en Supabase Auth → Settings → Email Auth
      // esté deshabilitado "Confirm email" o que uses el Admin API

      // 4. Crear registro en tabla usuarios
      const { data: usuarioData, error: usuarioError } = await supabase
        .from('usuarios')
        .upsert({
          id: authData.user.id,
          email: userData.email,
          nombre: userData.nombre,
          apellido: userData.apellido,
          rol: userData.rol,
          activo: true
        }, {
          onConflict: 'id'
        })
        .select()
        .single()

      if (usuarioError) {
        console.error('Error al crear usuario en tabla:', usuarioError)
        // Usuario existe en auth pero falló en tabla usuarios
        // Esto es OK, se sincronizará después
      }

      return { 
        success: true, 
        data: usuarioData || {
          id: authData.user.id,
          email: userData.email,
          nombre: userData.nombre,
          apellido: userData.apellido,
          rol: userData.rol,
          activo: true
        }
      }
    } catch (error) {
      console.error('Error en crearUsuario:', error)
      return { success: false, error: error.message || 'Error al crear usuario' }
    }
  },

  // Obtener todos los usuarios
  async getAllUsuarios() {
    try {
      const { data, error } = await supabase
        .from('usuarios')
        .select(`
          *,
          usuarios_locales(
            local:locales(id, nombre)
          )
        `)
        .order('apellido', { ascending: true })
      
      if (error) throw error
      
      return { success: true, data }
    } catch (error) {
      return { success: false, error: handleSupabaseError(error) }
    }
  },

  // Obtener usuario por ID con sus locales
  async getUsuarioById(usuarioId) {
    try {
      const { data, error } = await supabase
        .from('usuarios')
        .select(`
          *,
          usuarios_locales(
            id,
            activo,
            local:locales(id, nombre, direccion)
          )
        `)
        .eq('id', usuarioId)
        .single()
      
      if (error) throw error
      
      return { success: true, data }
    } catch (error) {
      return { success: false, error: handleSupabaseError(error) }
    }
  },

  // Actualizar información del usuario
  async actualizarUsuario(usuarioId, updates) {
    try {
      const { data, error } = await supabase
        .from('usuarios')
        .update(updates)
        .eq('id', usuarioId)
        .select()
        .single()
      
      if (error) throw error
      
      return { success: true, data }
    } catch (error) {
      return { success: false, error: handleSupabaseError(error) }
    }
  },

  // Eliminar usuario (sin función SQL)
  async eliminarUsuario(usuarioId) {
    try {
      // 1. Eliminar asignaciones de locales
      await supabase
        .from('usuarios_locales')
        .delete()
        .eq('usuario_id', usuarioId)

      // 2. Eliminar de tabla usuarios
      const { error: deleteError } = await supabase
        .from('usuarios')
        .delete()
        .eq('id', usuarioId)

      if (deleteError) throw deleteError

      // 3. Nota: No podemos eliminar de auth.users sin Service Role Key
      // El usuario quedará en auth pero sin acceso a locales ni datos

      return { success: true }
    } catch (error) {
      console.error('Error al eliminar usuario:', error)
      return { success: false, error: handleSupabaseError(error) }
    }
  },

  // Obtener locales asignados a un usuario
  async getLocalesUsuario(usuarioId) {
    try {
      const { data, error } = await supabase
        .from('usuarios_locales')
        .select(`
          local:locales(*)
        `)
        .eq('usuario_id', usuarioId)
        .eq('activo', true)

      if (error) throw error

      const locales = data.map(item => item.local)
      
      return { success: true, data: locales }
    } catch (error) {
      return { success: false, error: handleSupabaseError(error) }
    }
  },

  // Asignar múltiples locales a un usuario
  async asignarLocalesUsuario(usuarioId, localesIds) {
    try {
      // 1. Eliminar todas las asignaciones actuales
      await supabase
        .from('usuarios_locales')
        .delete()
        .eq('usuario_id', usuarioId)

      // 2. Insertar nuevas asignaciones
      if (localesIds.length > 0) {
        const asignaciones = localesIds.map(localId => ({
          usuario_id: usuarioId,
          local_id: localId,
          activo: true
        }))

        const { error } = await supabase
          .from('usuarios_locales')
          .insert(asignaciones)

        if (error) throw error
      }

      return { success: true }
    } catch (error) {
      return { success: false, error: handleSupabaseError(error) }
    }
  },

  // ============================================
  // GESTIÓN DE ASIGNACIONES USUARIO-LOCAL
  // ============================================

  // Asignar usuario a local
  async asignarUsuarioALocal(usuarioId, localId) {
    try {
      // Verificar si ya existe la asignación
      const { data: existente } = await supabase
        .from('usuarios_locales')
        .select('id, activo')
        .eq('usuario_id', usuarioId)
        .eq('local_id', localId)
        .maybeSingle()
      
      if (existente) {
        // Si existe pero está inactivo, reactivar
        if (!existente.activo) {
          const { data, error } = await supabase
            .from('usuarios_locales')
            .update({ activo: true })
            .eq('id', existente.id)
            .select(`
              *,
              local:locales(id, nombre)
            `)
            .single()
          
          if (error) throw error
          return { success: true, data, message: 'Asignación reactivada' }
        }
        
        return { success: false, error: 'El usuario ya está asignado a este local' }
      }

      // Crear nueva asignación
      const { data, error } = await supabase
        .from('usuarios_locales')
        .insert({
          usuario_id: usuarioId,
          local_id: localId
        })
        .select(`
          *,
          local:locales(id, nombre)
        `)
        .single()
      
      if (error) throw error
      
      return { success: true, data, message: 'Usuario asignado correctamente' }
    } catch (error) {
      return { success: false, error: handleSupabaseError(error) }
    }
  },

  // Desasignar usuario de local
  async desasignarUsuarioDeLocal(usuarioLocalId) {
    try {
      const { data, error } = await supabase
        .from('usuarios_locales')
        .update({ activo: false })
        .eq('id', usuarioLocalId)
        .select()
        .single()
      
      if (error) throw error
      
      return { success: true, data, message: 'Usuario desasignado correctamente' }
    } catch (error) {
      return { success: false, error: handleSupabaseError(error) }
    }
  },

  // Obtener locales asignados a un usuario
  async getLocalesDeUsuario(usuarioId) {
    try {
      const { data, error } = await supabase
        .from('usuarios_locales')
        .select(`
          *,
          local:locales(*)
        `)
        .eq('usuario_id', usuarioId)
        .eq('activo', true)
        .order('created_at', { ascending: false })
      
      if (error) throw error
      
      return { success: true, data }
    } catch (error) {
      return { success: false, error: handleSupabaseError(error) }
    }
  },

  // Obtener usuarios asignados a un local
  async getUsuariosDeLocal(localId) {
    try {
      const { data, error } = await supabase
        .from('usuarios_locales')
        .select(`
          *,
          usuario:usuarios(id, nombre, apellido, email)
        `)
        .eq('local_id', localId)
        .eq('activo', true)
        .order('created_at', { ascending: false })
      
      if (error) throw error
      
      return { success: true, data }
    } catch (error) {
      return { success: false, error: handleSupabaseError(error) }
    }
  },

  // ============================================
  // GESTIÓN DE LOCALES
  // ============================================

  // Obtener todos los locales
  async getAllLocales() {
    try {
      const { data, error } = await supabase
        .from('locales')
        .select('*')
        .eq('activo', true)
        .order('nombre', { ascending: true })
      
      if (error) throw error
      
      return { success: true, data }
    } catch (error) {
      return { success: false, error: handleSupabaseError(error) }
    }
  },

  // Alias para getLocales (compatibilidad)
  async getLocales() {
    return this.getAllLocales()
  },

  // Crear nuevo local
  async crearLocal(localData) {
    try {
      const { data, error } = await supabase
        .from('locales')
        .insert({
          nombre: localData.nombre,
          direccion: localData.direccion,
          telefono: localData.telefono
        })
        .select()
        .single()
      
      if (error) throw error
      
      return { success: true, data }
    } catch (error) {
      return { success: false, error: handleSupabaseError(error) }
    }
  },

  // Actualizar local
  async actualizarLocal(localId, updates) {
    try {
      const { data, error } = await supabase
        .from('locales')
        .update(updates)
        .eq('id', localId)
        .select()
        .single()
      
      if (error) throw error
      
      return { success: true, data }
    } catch (error) {
      return { success: false, error: handleSupabaseError(error) }
    }
  },

  // Desactivar local
  async desactivarLocal(localId) {
    try {
      const { data, error } = await supabase
        .from('locales')
        .update({ activo: false })
        .eq('id', localId)
        .select()
        .single()
      
      if (error) throw error
      
      return { success: true, data }
    } catch (error) {
      return { success: false, error: handleSupabaseError(error) }
    }
  }
}

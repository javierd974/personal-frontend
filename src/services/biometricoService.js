// Llamada directa al WebAPI de SecuGen (servicio local SgiBioSrv, version "over HTTPS").
// Responde en https://localhost:8443. Requiere el certificado sgca.crt instalado en la
// raiz de confianza de Windows (lo hace el instalador). Se usa el hostname 'localhost'
// —no 127.0.0.1— porque el certificado esta emitido para 'localhost'.
// Al servirse la app por HTTPS en produccion, esto evita el bloqueo por "mixed content".
const WEBAPI_URL = 'https://localhost:8443'

export const biometricoService = {

  // Verificar que el servicio estÃ¡ corriendo â€” usa SGIMatchScore sin params,
  // responde instantÃ¡neo sin intentar capturar ninguna huella
  async verificarServicio() {
    try {
      const response = await fetch(`${WEBAPI_URL}/SGIMatchScore`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({}),
        signal: AbortSignal.timeout(3000)
      })
      return { activo: true }
    } catch {
      return { activo: false }
    }
  },

  // Capturar una huella y devolver el template ISO en base64
  async capturarHuella(timeoutMs = 15000) {
    try {
      const response = await fetch(`${WEBAPI_URL}/SGIFPCapture`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          Timeout: timeoutMs.toString(), Quality: '50',
          templateFormat: 'ISO', licstr: '', serialNumber: ''
        })
      })
      const text = await response.text()
      if (!text) {
        return { success: false, error: 'No se detectÃ³ ningÃºn dedo. ApoyÃ¡ el dedo en el lector.' }
      }
      const data = JSON.parse(text)
      if (data.ErrorCode !== 0) {
        return { success: false, error: this.traducirError(data.ErrorCode) }
      }
      return { success: true, template: data.TemplateBase64, imagen: data.BMPBase64 || null }
    } catch {
      return { success: false, error: 'Error al capturar. IntentÃ¡ de nuevo.' }
    }
  },

  // Comparar template capturado contra array de huellas registradas
  async identificarEmpleado(templateCapturado, huellas) {
    const UMBRAL_MATCHING = 40
    for (const huella of huellas) {
      try {
        const response = await fetch(`${WEBAPI_URL}/SGIMatchScore`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            Template1: templateCapturado,
            Template2: huella.template_iso,
            templateFormat: 'ISO'
          })
        })
        const text = await response.text()
        if (!text) continue
        const data = JSON.parse(text)
        if (data.ErrorCode === 0 && data.MatchingScore >= UMBRAL_MATCHING) {
          return { encontrado: true, empleado_id: huella.empleado_id, score: data.MatchingScore }
        }
      } catch { continue }
    }
    return { encontrado: false }
  },

  async guardarHuella(empleadoId, dedo, template) {
    const { supabase } = await import('./supabase')
    const { data, error } = await supabase
      .from('huellas_empleados')
      .upsert({
        empleado_id: empleadoId, dedo, template_iso: template,
        activo: true, updated_at: new Date().toISOString()
      }, { onConflict: 'empleado_id,dedo' })
      .select().single()
    if (error) return { success: false, error: error.message }
    return { success: true, data }
  },

  // Enrolamiento scopeado por local (RPC SECURITY DEFINER).
  // Encargado: solo empleados de su local. admin/rrhh: cualquiera.
  async enrolarHuella(empleadoId, dedo, template, calidad = null) {
    const { supabase } = await import('./supabase')
    const { data, error } = await supabase.rpc('enrolar_huella', {
      p_empleado_id: empleadoId,
      p_dedo: dedo,
      p_template_iso: template,
      p_calidad: calidad
    })
    if (error) return { success: false, error: error.message }
    return { success: true, data }
  },

  // Identificación del kiosco: SOLO templates activos del local indicado.
  async getHuellasParaIdentificacion(localId) {
    const { createClient } = await import('@supabase/supabase-js')
    const supabaseAnon = createClient(
      import.meta.env.VITE_SUPABASE_URL,
      import.meta.env.VITE_SUPABASE_ANON_KEY
    )
    const { data, error } = await supabaseAnon.rpc('huellas_para_identificacion', {
      p_local_id: localId
    })
    if (error) return { success: false, error: error.message }
    return { success: true, data }
  },

  // Identificación GLOBAL: todas las huellas activas (cualquier local), para
  // que un empleado pueda fichar aunque esté registrado en otro local.
  async getHuellasParaTodas() {
    const { createClient } = await import('@supabase/supabase-js')
    const supabaseAnon = createClient(
      import.meta.env.VITE_SUPABASE_URL,
      import.meta.env.VITE_SUPABASE_ANON_KEY
    )
    const { data, error } = await supabaseAnon.rpc('huellas_para_identificacion_todas')
    if (error) return { success: false, error: error.message }
    return { success: true, data }
  },

  // Estado de enrolamiento por local (RPC): devuelve [{empleado_id, dedo}] sin templates.
  async getEstadoHuellasLocal(localId) {
    const { supabase } = await import('./supabase')
    const { data, error } = await supabase.rpc('huellas_estado_local', {
      p_local_id: localId
    })
    if (error) return { success: false, error: error.message }
    return { success: true, data }
  },

  async getHuellasActivas() {
    const { createClient } = await import('@supabase/supabase-js')
    // Usar cliente anon directo para que funcione sin sesión (kiosco)
    const supabaseAnon = createClient(
      import.meta.env.VITE_SUPABASE_URL,
      import.meta.env.VITE_SUPABASE_ANON_KEY
    )
    const { data, error } = await supabaseAnon
      .from('huellas_empleados')
      .select('empleado_id, dedo, template_iso')
      .eq('activo', true)
    if (error) return { success: false, error: error.message }
    return { success: true, data }
  },

  async getHuellasEmpleado(empleadoId) {
    const { supabase } = await import('./supabase')
    const { data, error } = await supabase
      .from('huellas_empleados')
      .select('id, dedo, activo, created_at')
      .eq('empleado_id', empleadoId)
      .eq('activo', true)
    if (error) return { success: false, error: error.message }
    return { success: true, data }
  },

  async eliminarHuella(empleadoId, dedo) {
    const { supabase } = await import('./supabase')
    const { error } = await supabase
      .from('huellas_empleados')
      .update({ activo: false })
      .eq('empleado_id', empleadoId)
      .eq('dedo', dedo)
    if (error) return { success: false, error: error.message }
    return { success: true }
  },

  traducirError(codigo) {
    const errores = {
      10004: 'No se detectÃ³ ningÃºn dedo. ApoyÃ¡ el dedo en el lector.',
      10005: 'Tiempo de espera agotado. IntentÃ¡ de nuevo.',
      10006: 'Calidad insuficiente. ApoyÃ¡ el dedo con mÃ¡s firmeza.',
      10007: 'Lector no encontrado. VerificÃ¡ que estÃ© conectado.',
    }
    return errores[codigo] || `Error del lector (cÃ³digo ${codigo})`
  }
}

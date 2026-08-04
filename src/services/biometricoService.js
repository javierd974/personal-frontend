// Llamada directa al WebAPI de SecuGen (servicio local SgiBioSrv, version "over HTTPS").
// Responde en https://localhost:8443. Requiere el certificado sgca.crt instalado en la
// raiz de confianza de Windows (lo hace el instalador). Se usa el hostname 'localhost'
// —no 127.0.0.1— porque el certificado esta emitido para 'localhost'.
// Al servirse la app por HTTPS en produccion, esto evita el bloqueo por "mixed content".
const WEBAPI_URL = 'https://localhost:8443'

export const biometricoService = {

  // Verificar que el servicio estÃ¡ corriendo â€” usa SGIMatchScore sin params,
  // responde instantÃ¡neo sin intentar capturar ninguna huella
  // La WebAPI de SecuGen tarda ~12 s en responder la PRIMERA llamada (handshake
  // TLS + renegociacion) y despues ~40 ms. Ademas devuelve respuestas
  // malformadas en llamadas alternadas al reusar la conexion. Por eso: timeout
  // amplio y un reintento antes de darla por caida.
  async verificarServicio({ timeoutMs = 15000, reintentos = 1 } = {}) {
    for (let intento = 0; intento <= reintentos; intento++) {
      try {
        await fetch(`${WEBAPI_URL}/SGIMatchScore`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({}),
          signal: AbortSignal.timeout(timeoutMs)
        })
        return { activo: true }
      } catch {
        if (intento === reintentos) return { activo: false }
        await new Promise(r => setTimeout(r, 400))
      }
    }
    return { activo: false }
  },

  // Capturar una huella y devolver el template ISO en base64.
  // Wrapper con reintento: la WebAPI devuelve respuestas malformadas en llamadas
  // alternadas, lo que hacia que el kiosco mostrara "Lector desconectado" con el
  // lector perfectamente enchufado. Solo reintenta si el fallo fue RAPIDO (<1500 ms):
  // un fallo lento es un timeout real esperando el dedo, y ahi no hay que reintentar.
  async capturarHuella(timeoutMs = 15000) {
    const t0 = Date.now()
    const primera = await this._capturarHuellaUnaVez(timeoutMs)
    if (primera.success) return primera
    if (Date.now() - t0 >= 1500) return primera
    await new Promise(r => setTimeout(r, 300))
    return this._capturarHuellaUnaVez(timeoutMs)
  },

  async _capturarHuellaUnaVez(timeoutMs = 15000) {
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

  // Comparar template capturado contra array de huellas registradas.
  //
  // IMPORTANTE (bug historico): antes esto devolvia la PRIMERA huella que
  // superaba el umbral. En una identificacion 1:N eso produce fichajes
  // cruzados: si el dedo saca 45 contra la huella de otro empleado que esta
  // antes en el array y 130 contra la propia, ganaba el otro. El resultado
  // dependia del orden de las filas, no de quien era la persona.
  //
  // Ahora: se comparan TODAS las huellas, se toma la de mayor score, y se
  // exige que le saque MARGEN_MINIMO al segundo mejor. Si dos personas
  // quedan cerca, no se registra a nadie y se pide reintentar.
  async identificarEmpleado(templateCapturado, huellas) {
    const UMBRAL_MATCHING = 100   // score minimo para aceptar un match
    const MARGEN_MINIMO   = 25    // ventaja que debe sacarle al segundo
    const CONCURRENCIA    = 8     // comparaciones en paralelo

    const resultados = []
    for (let i = 0; i < huellas.length; i += CONCURRENCIA) {
      const lote = huellas.slice(i, i + CONCURRENCIA)
      const scores = await Promise.all(lote.map(async (huella) => {
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
          if (!text) return null
          const data = JSON.parse(text)
          if (data.ErrorCode !== 0) return null
          return { empleado_id: huella.empleado_id, score: data.MatchingScore || 0 }
        } catch { return null }
      }))
      for (const s of scores) if (s) resultados.push(s)
    }

    if (resultados.length === 0) return { encontrado: false, motivo: 'sin_lecturas' }

    resultados.sort((a, b) => b.score - a.score)
    const mejor    = resultados[0]
    const segundo  = resultados.find(r => r.empleado_id !== mejor.empleado_id)
    const margen   = mejor.score - (segundo ? segundo.score : 0)

    if (mejor.score < UMBRAL_MATCHING) {
      return { encontrado: false, motivo: 'score_bajo', score: mejor.score }
    }
    if (margen < MARGEN_MINIMO) {
      // Dos empleados demasiado parecidos: NO registrar a nadie.
      return { encontrado: false, motivo: 'ambiguo', score: mejor.score, margen }
    }
    return { encontrado: true, empleado_id: mejor.empleado_id, score: mejor.score, margen }
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
  async getHuellasParaTodas({ forzar = false } = {}) {
    // Cache en memoria: bajar ~800 templates de Supabase en CADA lectura es
    // la mayor parte de la demora del kiosco. Se refresca cada CACHE_TTL_MS
    // o cuando se enrola a alguien nuevo (invalidarCache()).
    const CACHE_TTL_MS = 10 * 60 * 1000
    const ahora = Date.now()
    if (!forzar && this._cacheHuellas && (ahora - this._cacheHuellasTs) < CACHE_TTL_MS) {
      return { success: true, data: this._cacheHuellas, desdeCache: true }
    }

    const { createClient } = await import('@supabase/supabase-js')
    const supabaseAnon = createClient(
      import.meta.env.VITE_SUPABASE_URL,
      import.meta.env.VITE_SUPABASE_ANON_KEY
    )
    const { data, error } = await supabaseAnon.rpc('huellas_para_identificacion_todas')
    if (error) {
      // Si falla la red pero tenemos cache vieja, es preferible usarla
      if (this._cacheHuellas) return { success: true, data: this._cacheHuellas, desdeCache: true, stale: true }
      return { success: false, error: error.message }
    }
    this._cacheHuellas = data
    this._cacheHuellasTs = ahora
    return { success: true, data }
  },

  _cacheHuellas: null,
  _cacheHuellasTs: 0,
  invalidarCache() { this._cacheHuellas = null; this._cacheHuellasTs = 0 },

  // Enrolamiento de calidad: toma el MISMO dedo N veces y se queda con la
  // captura mas "representativa" — la que mejor puntua contra las otras dos.
  // Una sola toma puede salir torcida o con el dedo seco y deja al empleado
  // con un template pobre que despues nunca matchea bien.
  //
  // onProgreso(paso, total, mensaje) permite que la UI guie a la persona.
  async capturarHuellaCalidad({ tomas = 3, timeoutMs = 15000, onProgreso = null } = {}) {
    const capturas = []
    for (let i = 0; i < tomas; i++) {
      if (onProgreso) onProgreso(i + 1, tomas, `Apoyá el dedo (toma ${i + 1} de ${tomas})`)
      const cap = await this.capturarHuella(timeoutMs)
      if (!cap.success) return { success: false, error: cap.error, tomaFallida: i + 1 }
      capturas.push(cap)
      if (onProgreso && i < tomas - 1) onProgreso(i + 1, tomas, 'Levantá el dedo y volvé a apoyarlo')
      await new Promise(r => setTimeout(r, 700))
    }

    // Score cruzado de cada captura contra las demas. La que tiene mejor
    // promedio es la mas estable → esa guardamos.
    const promedios = []
    for (let i = 0; i < capturas.length; i++) {
      let suma = 0, comparaciones = 0
      for (let j = 0; j < capturas.length; j++) {
        if (i === j) continue
        const score = await this._scoreEntre(capturas[i].template, capturas[j].template)
        if (score !== null) { suma += score; comparaciones++ }
      }
      promedios.push({ idx: i, promedio: comparaciones ? suma / comparaciones : 0 })
    }
    promedios.sort((a, b) => b.promedio - a.promedio)
    const ganadora = promedios[0]

    return {
      success: true,
      template: capturas[ganadora.idx].template,
      imagen: capturas[ganadora.idx].imagen,
      calidad: Math.round(ganadora.promedio),
      scores: promedios.map(p => Math.round(p.promedio))
    }
  },

  // Score entre dos templates. Devuelve null si el WebAPI no pudo comparar.
  async _scoreEntre(t1, t2) {
    try {
      const response = await fetch(`${WEBAPI_URL}/SGIMatchScore`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ Template1: t1, Template2: t2, templateFormat: 'ISO' })
      })
      const text = await response.text()
      if (!text) return null
      const data = JSON.parse(text)
      return data.ErrorCode === 0 ? (data.MatchingScore || 0) : null
    } catch { return null }
  },

  // Logging de scores para calibrar el umbral con datos reales.
  // No bloquea el fichaje: si falla, se ignora en silencio.
  async registrarLectura({ localId, empleadoId, score, margen, motivo, candidatos }) {
    try {
      const { createClient } = await import('@supabase/supabase-js')
      const supabaseAnon = createClient(
        import.meta.env.VITE_SUPABASE_URL,
        import.meta.env.VITE_SUPABASE_ANON_KEY
      )
      await supabaseAnon.from('lecturas_biometricas').insert({
        local_id: localId,
        empleado_id: empleadoId || null,
        score: score ?? null,
        margen: margen ?? null,
        motivo: motivo || null,
        candidatos: candidatos ?? null
      })
    } catch { /* el logging nunca debe romper un fichaje */ }
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

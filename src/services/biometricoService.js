// Llamada directa al WebAPI de SecuGen (servicio local SgiBioSrv, version "over HTTPS").
// Responde en https://localhost:8443. Requiere el certificado sgca.crt instalado en la
// raiz de confianza de Windows (lo hace el instalador). Se usa el hostname 'localhost'
// —no 127.0.0.1— porque el certificado esta emitido para 'localhost'.
// Al servirse la app por HTTPS en produccion, esto evita el bloqueo por "mixed content".
const WEBAPI_URL = 'https://localhost:8443'

// Codigos de error del lector (SGFDx) y de la WebAPI, clasificados por lo que
// dicen sobre el DISPOSITIVO —no sobre el dedo—. Sirven para saber si hay un
// lector realmente enchufado y funcionando:
//   PRESENTE: la WebAPI pudo ABRIR el lector; el fallo es del dedo (timeout,
//             calidad, no se apoyo, lector ocupado por otro programa).
//   AUSENTE : no hay lector, o el driver no esta instalado / esta en error.
const COD_LECTOR_PRESENTE = [0, 54, 60, 10004, 10005, 10006]
const COD_LECTOR_AUSENTE  = [51, 52, 53, 55, 58, 10007]

// true = hay lector; false = no hay; null = el codigo no dice nada concluyente.
function lectorSegunCodigo(codigo) {
  if (COD_LECTOR_PRESENTE.indexOf(codigo) !== -1) return true
  if (COD_LECTOR_AUSENTE.indexOf(codigo) !== -1) return false
  return null
}

export const biometricoService = {

  // Calentar la conexion con la WebAPI. La PRIMERA llamada a sgibiosrv tarda
  // ~12 s (handshake TLS + renegociacion) y las siguientes ~40 ms. Si esa
  // primera la paga el usuario, se come 12 s de spinner al abrir el kiosco o
  // el modal de enrolamiento. Llamando esto al arrancar la app, el costo se
  // paga en segundo plano y para el usuario todo responde al instante.
  // Idempotente: se puede llamar muchas veces, calienta una sola vez.
  _calentando: null,
  calentar() {
    if (!this._calentando) {
      this._calentando = fetch(`${WEBAPI_URL}/SGIMatchScore`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({})
      }).catch(() => {})   // si falla no importa: es solo calentamiento
    }
    return this._calentando
  },

  // Verificar que la PC esta lista para capturar. OJO: no alcanza con que el
  // servicio conteste.
  //
  // BUG HISTORICO: antes esto solo hacia un fetch a SGIMatchScore y devolvia
  // activo:true si el fetch no explotaba. Pero sgibiosrv contesta igual sin
  // ningun lector enchufado y sin el driver instalado, asi que la app mostraba
  // "Lector conectado" en verde en maquinas donde el lector no funcionaba, y
  // no reaccionaba a ningun dedo. El diagnostico del instalador decia
  // FALTA_LECTOR al mismo tiempo que la app decia OK.
  //
  // Ahora se pregunta por el DISPOSITIVO: SGIFPCapture con Timeout=1 ms obliga
  // a la WebAPI a abrir el lector y responde en ~250 ms sin esperar ningun
  // dedo. El ErrorCode que vuelve dice si el lector esta o no (ver
  // lectorSegunCodigo). Devuelve { servicio, lector, codigo, mensaje }.
  async verificarLector({ timeoutMs = 10000, reintentos = 1 } = {}) {
    await this.calentar()
    let ultimoCodigo = null
    for (let intento = 0; intento <= reintentos; intento++) {
      try {
        const response = await fetch(`${WEBAPI_URL}/SGIFPCapture`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            Timeout: '1', Quality: '50', templateFormat: 'ISO', licstr: '', serialNumber: ''
          }),
          signal: AbortSignal.timeout(timeoutMs)
        })
        const text = await response.text()
        // Respuesta vacia o malformada: la WebAPI hace esto al reusar la
        // conexion. Reintentar antes de opinar sobre el lector.
        if (!text) { await new Promise(r => setTimeout(r, 400)); continue }
        let data
        try { data = JSON.parse(text) } catch { await new Promise(r => setTimeout(r, 400)); continue }
        ultimoCodigo = data.ErrorCode
        const presente = lectorSegunCodigo(data.ErrorCode)
        if (presente === null) { await new Promise(r => setTimeout(r, 400)); continue }
        // Un "no hay lector" se confirma con un segundo intento: con Timeout=1 ms
        // una PC lenta puede tardar mas en abrir el dispositivo la primera vez, y
        // no queremos marcar el lector como desconectado por eso.
        if (presente === false && intento < reintentos) {
          await new Promise(r => setTimeout(r, 600)); continue
        }
        return {
          servicio: true,
          lector: presente,
          codigo: data.ErrorCode,
          mensaje: presente
            ? 'Lector conectado y listo.'
            : 'El servicio esta corriendo pero no encuentra el lector. Revisa que este enchufado (USB trasero, sin hub) y que el driver SecuGen este instalado: corre reparar_driver.bat como administrador.'
        }
      } catch {
        // No se pudo llegar al servicio: puede estar apagado, escuchando en
        // 8000 en vez de 8443, o faltar el certificado sgca.crt en la raiz de
        // confianza (el instalador lo pone; si fallo certmgr.exe, no esta).
        if (intento === reintentos) {
          return {
            servicio: false, lector: false, codigo: null,
            mensaje: 'No se pudo conectar al servicio biometrico local (https://localhost:8443). Puede estar apagado, haber quedado en el puerto 8000, o faltar el certificado sgca.crt. Corre diagnostico.bat como administrador.'
          }
        }
        await new Promise(r => setTimeout(r, 400))
      }
    }
    // El servicio contesta pero no se pudo determinar el estado del lector.
    return {
      servicio: true, lector: false, codigo: ultimoCodigo,
      mensaje: 'El servicio contesta pero no se pudo confirmar el lector. Corre diagnostico.bat en esta PC.'
    }
  },

  // Compatibilidad: activo = servicio arriba Y lector presente. Es lo que
  // corresponde para habilitar el boton de capturar.
  async verificarServicio(opts = {}) {
    const r = await this.verificarLector(opts)
    return { activo: r.servicio && r.lector, ...r }
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
        return { success: false, codigo: null, lector: null, error: 'No se detecto ningun dedo. Apoya el dedo en el lector.' }
      }
      const data = JSON.parse(text)
      if (data.ErrorCode !== 0) {
        // Se propaga el codigo: el kiosco lo usa para saber si el fallo fue del
        // dedo (lector OK) o del dispositivo (lector desenchufado / sin driver).
        return { success: false, codigo: data.ErrorCode, lector: lectorSegunCodigo(data.ErrorCode), error: this.traducirError(data.ErrorCode) }
      }
      return { success: true, codigo: 0, lector: true, template: data.TemplateBase64, imagen: data.BMPBase64 || null }
    } catch {
      // No se llego al servicio: no se puede opinar sobre el lector.
      return { success: false, codigo: null, lector: null, error: 'Error al capturar. Intenta de nuevo.' }
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
      // Pausa entre tomas. Importante: el lector espera una presion NUEVA, asi
      // que si la siguiente captura arranca con el dedo todavia apoyado se
      // queda esperando y corta por timeout (codigo 54). 700 ms no alcanzaban
      // para levantar el dedo; 2 s si, y no se siente lento.
      if (onProgreso && i < tomas - 1) onProgreso(i + 1, tomas, 'Levantá el dedo del lector...')
      await new Promise(r => setTimeout(r, 2000))
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

  // Verificación 1:1: huellas de un DNI puntual (rápido). Devuelve filas
  // {empleado_id, nombre, apellido, rol_id, documento, dedo, template_iso}.
  // 0 filas = DNI inexistente; filas con template_iso null = sin huella enrolada.
  async getHuellasPorDni(dni) {
    const { createClient } = await import('@supabase/supabase-js')
    const supabaseAnon = createClient(
      import.meta.env.VITE_SUPABASE_URL,
      import.meta.env.VITE_SUPABASE_ANON_KEY
    )
    const p_dni = String(dni || '').replace(/\D/g, '')
    const { data, error } = await supabaseAnon.rpc('huellas_por_dni', { p_dni })
    if (error) return { success: false, error: error.message }
    return { success: true, data: data || [] }
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
      // Codigos de la WebAPI
      10004: 'No se detecto ningun dedo. Apoya el dedo en el lector.',
      10005: 'Tiempo de espera agotado. Intenta de nuevo.',
      10006: 'Calidad insuficiente. Apoya el dedo con mas firmeza.',
      10007: 'Lector no encontrado. Verifica que este conectado.',
      // Codigos de la libreria SGFDx (los devuelve el lector, no la WebAPI)
      51: 'El lector no pudo iniciar. Desenchufalo y volve a enchufarlo.',
      52: 'No se pudo inicializar el lector. Reinicia la PC.',
      53: 'Se corto la conexion con el lector. Revisa el cable USB.',
      54: 'No se apoyo el dedo a tiempo. Levanta el dedo y volve a apoyarlo.',
      55: 'Lector no encontrado. Verifica que este conectado.',
      58: 'Lector no compatible.',
      60: 'El lector ya esta en uso por otro programa. Cerra el otro kiosco.',
    }
    return errores[codigo] || `Error del lector (codigo ${codigo})`
  }
}

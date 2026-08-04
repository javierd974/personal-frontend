import React, { useState, useEffect, useRef } from 'react'
import { biometricoService } from '../services/biometricoService'
import { localesService } from '../services/catalogosService'
import { createClient } from '@supabase/supabase-js'

// Cliente Supabase anon para el kiosco (funciona sin sesión)
const supabaseKiosco = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)

const ESTADOS = {
  LISTO:         'listo',          // esperando dedo (lectura automática en curso)
  IDENTIFICANDO: 'identificando',  // huella capturada, buscando empleado
  PROCESANDO:    'procesando',     // registrando entrada/salida
  EXITO:         'exito',
  ERROR:         'error',
  SIN_HUELLA:    'sin_huella',
}

const ACCION = { ENTRADA: 'entrada', SALIDA: 'salida' }

// Tiempos (ms)
const CAPTURE_TIMEOUT = 10000  // cuánto espera cada intento de captura un dedo
const COOLDOWN_MS     = 10000  // pausa tras una marcación exitosa (evita doble lectura)
const ERROR_HOLD_MS   = 3500   // cuánto se muestra un error / huella no reconocida

const sleep = (ms) => new Promise(r => setTimeout(r, ms))

// Valida que el local sea un UUID real (evita fichar con un LOCAL_ID sin
// configurar, ej. el placeholder "__LOCAL_ID__", que rompe el registro).
const esUUID = (s) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s || '')

// Candado a nivel de módulo: garantiza que UNA sola lectura se procese a la vez
// de punta a punta (identificar + decidir + registrar + cooldown), aunque haya
// más de un loop de captura corriendo (StrictMode en dev, o varias pestañas).
// Evita la condición de carrera que insertaba dos entradas simultáneas.
let procesandoLectura = false

export default function Kiosco() {
  const [estado, setEstado]               = useState(ESTADOS.LISTO)
  const [accion, setAccion]               = useState(null)
  const [empleado, setEmpleado]           = useState(null)
  const [registro, setRegistro]           = useState(null)
  const [mensaje, setMensaje]             = useState('')
  const [localId, setLocalId]             = useState(null)
  const [localNombre, setLocalNombre]     = useState('')
  const [locales, setLocales]             = useState([])
  const [eligiendoLocal, setEligiendoLocal] = useState(false)
  const [lectorActivo, setLectorActivo]   = useState(true)

  const loopTokenRef = useRef(0)     // token del loop activo (evita loops duplicados)
  const localIdRef = useRef(null)    // localId siempre actualizado para el loop
  const STORAGE_KEY = 'kiosco_local_id'
  const STORAGE_NOMBRE = 'kiosco_local_nombre'

  useEffect(() => { localIdRef.current = localId }, [localId])

  // Cargar local guardado (localStorage o ?local= en la URL)
  useEffect(() => {
    const lidGuardado = localStorage.getItem(STORAGE_KEY)
    const nombreGuardado = localStorage.getItem(STORAGE_NOMBRE)
    const params = new URLSearchParams(window.location.search)
    const lidUrl = params.get('local')
    const lid = lidUrl || lidGuardado
    if (lid && esUUID(lid)) {
      setLocalId(lid)
      setLocalNombre(nombreGuardado || '')
      localStorage.setItem(STORAGE_KEY, lid)
    }
    // Si el local no es un UUID valido (ej. placeholder sin configurar), no
    // seteamos localId -> se muestra el selector para elegir el local.
  }, [])

  // Loop de lectura automática: arranca cuando hay local seleccionado
  useEffect(() => {
    if (!localId) return
    const token = ++loopTokenRef.current
    loopCaptura(token)
    return () => { loopTokenRef.current++ }   // invalida el loop actual
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localId])

  const abrirSelectorLocal = async () => {
    const result = await localesService.getLocalesUsuario()
    if (result.success) setLocales(result.data)
    setEligiendoLocal(true)
  }

  const elegirLocal = (local) => {
    setLocalId(local.id)
    setLocalNombre(local.nombre)
    localStorage.setItem(STORAGE_KEY, local.id)
    localStorage.setItem(STORAGE_NOMBRE, local.nombre)
    setEligiendoLocal(false)
  }

  // ── Loop principal de captura ──────────────────────────────────────────────
  const loopCaptura = async (token) => {
    let fallosRapidos = 0
    while (loopTokenRef.current === token) {
      const t0 = Date.now()
      let cap
      try { cap = await biometricoService.capturarHuella(CAPTURE_TIMEOUT) }
      catch { cap = { success: false } }
      if (loopTokenRef.current !== token) break

      if (!cap.success) {
        // Sin dedo (timeout normal) vs. lector caído: si falla muy rápido y
        // repetido, asumimos lector desconectado.
        const elapsed = Date.now() - t0
        if (elapsed < 1500) { fallosRapidos++ } else { fallosRapidos = 0 }
        setLectorActivo(fallosRapidos < 3)
        await sleep(elapsed < 1500 ? 1200 : 300)
        continue
      }

      fallosRapidos = 0
      setLectorActivo(true)

      // Candado: si ya hay una lectura en curso (otro loop / otra pestaña),
      // descartamos esta captura para no marcar dos veces.
      if (procesandoLectura) { await sleep(400); continue }
      procesandoLectura = true
      try {
        await procesarLectura(cap.template, token)   // identificar + decidir + registrar + cooldown
      } finally {
        procesandoLectura = false
      }
    }
  }

  const finLectura = async (nuevoEstado, info, holdMs, token) => {
    setEmpleado(info.empleado || null)
    setAccion(info.accion || null)
    setRegistro(info.registro || null)
    setMensaje(info.mensaje || '')
    setEstado(nuevoEstado)
    await sleep(holdMs)                     // durante este tiempo el loop NO captura
    if (loopTokenRef.current !== token) return
    setEstado(ESTADOS.LISTO)
    setEmpleado(null); setAccion(null); setRegistro(null); setMensaje('')
  }

  const procesarLectura = async (template, token) => {
    const lid = localIdRef.current
    setEstado(ESTADOS.IDENTIFICANDO)

    // 1. Traer TODAS las huellas activas (cualquier local) e identificar
    const huellasResult = await biometricoService.getHuellasParaTodas()
    if (!huellasResult.success || huellasResult.data.length === 0) {
      return finLectura(ESTADOS.ERROR, { mensaje: 'No hay huellas registradas en el sistema. Consultá al encargado.' }, ERROR_HOLD_MS, token)
    }
    const match = await biometricoService.identificarEmpleado(template, huellasResult.data)

    // Logging para calibrar UMBRAL_MATCHING / MARGEN_MINIMO con datos reales.
    // No bloquea el fichaje (corre sin await, y falla en silencio).
    biometricoService.registrarLectura({
      localId: lid,
      empleadoId: match.encontrado ? match.empleado_id : null,
      score: match.score,
      margen: match.margen,
      motivo: match.encontrado ? 'ok' : (match.motivo || 'no_encontrado'),
      candidatos: huellasResult.data.length
    })

    if (!match.encontrado) {
      // 'ambiguo' = dos empleados puntuaron parecido. Antes esto registraba
      // al primero del array y producia fichajes cruzados; ahora se pide
      // reintentar en vez de arriesgar la identidad equivocada.
      const msg = match.motivo === 'ambiguo'
        ? 'No pudimos identificarte con seguridad. Apoyá el dedo de nuevo, bien centrado.'
        : 'Huella no reconocida. Consultá al encargado.'
      return finLectura(ESTADOS.SIN_HUELLA, { mensaje: msg }, ERROR_HOLD_MS, token)
    }

    // 2. Datos del empleado (incluye su rol por defecto)
    const { data: emp, error: empErr } = await supabaseKiosco
      .from('empleados')
      .select('*, rol:roles(id, nombre)')
      .eq('id', match.empleado_id)
      .single()
    if (empErr || !emp) {
      return finLectura(ESTADOS.ERROR, { mensaje: 'No se pudo cargar el empleado. Intentá de nuevo.' }, ERROR_HOLD_MS, token)
    }

    // 3. ¿Tiene un registro abierto (entrada sin salida)? → decide la acción
    const { data: abiertos } = await supabaseKiosco
      .from('registros_horarios')
      .select('id, hora_entrada, rol:roles(nombre)')
      .eq('empleado_id', emp.id)
      .is('hora_salida', null)
      .order('hora_entrada', { ascending: false })
      .limit(1)
    const regAbierto = abiertos && abiertos[0]

    setEstado(ESTADOS.PROCESANDO)
    const ahora = new Date().toISOString()

    if (regAbierto) {
      // ── SALIDA ──
      const { data, error } = await supabaseKiosco
        .from('registros_horarios')
        .update({ hora_salida: ahora })
        .eq('id', regAbierto.id)
        .select('*, rol:roles(nombre)')
        .single()
      if (error) {
        return finLectura(ESTADOS.ERROR, { empleado: emp, mensaje: error.message }, ERROR_HOLD_MS, token)
      }
      return finLectura(ESTADOS.EXITO, { empleado: emp, accion: ACCION.SALIDA, registro: data }, COOLDOWN_MS, token)
    }

    // ── ENTRADA (rol automático desde el empleado) ──
    if (!emp.rol_id) {
      return finLectura(ESTADOS.ERROR, {
        empleado: emp,
        mensaje: `${emp.nombre} no tiene un rol asignado. Avisá al encargado para cargarlo.`
      }, ERROR_HOLD_MS, token)
    }
    const fecha = ahora.split('T')[0]
    const { data, error } = await supabaseKiosco
      .from('registros_horarios')
      .insert({
        empleado_id: emp.id,
        local_id: lid,
        rol_id: emp.rol_id,
        fecha,
        hora_entrada: ahora,
        metodo_registro: 'biometrico'
      })
      .select('*, rol:roles(nombre)')
      .single()
    if (error) {
      // 23505 = índice único (uq_registro_abierto_empleado_dia) o el trigger
      // validar_entrada_unica: ya hay un turno abierto (carrera entre dispositivos).
      const yaAbierto = error.code === '23505' || /turno abierto/i.test(error.message || '')
      const mensaje = yaAbierto
        ? `${emp.nombre} ya tiene un turno abierto. Volvé a apoyar el dedo para registrar la salida.`
        : error.message
      return finLectura(ESTADOS.ERROR, { empleado: emp, mensaje }, ERROR_HOLD_MS, token)
    }
    return finLectura(ESTADOS.EXITO, { empleado: emp, accion: ACCION.ENTRADA, registro: data }, COOLDOWN_MS, token)
  }

  const hora = new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false })

  return (
    <div style={estilos.root}>
      {/* Fondo con textura sutil */}
      <div style={estilos.fondo} />

      {/* Selector de local — pantalla inicial si no hay local */}
      {eligiendoLocal && (
        <div style={estilos.selectorOverlay}>
          <div style={estilos.selectorBox}>
            <p style={estilos.selectorTitulo}>Seleccioná el local</p>
            {locales.map(loc => (
              <button key={loc.id} style={estilos.selectorBtn} onClick={() => elegirLocal(loc)}>
                {loc.nombre}
              </button>
            ))}
            {localId && (
              <button style={estilos.cancelarBtn} onClick={() => setEligiendoLocal(false)}>Cancelar</button>
            )}
          </div>
        </div>
      )}

      {/* Pantalla de bienvenida si no hay local aún */}
      {!localId && !eligiendoLocal && (
        <div style={estilos.selectorOverlay}>
          <div style={estilos.selectorBox}>
            <p style={estilos.selectorTitulo}>Kiosco Biométrico</p>
            <p style={{color:'#64748b', marginBottom:'24px', fontSize:'15px'}}>Para comenzar, seleccioná el local</p>
            <button style={{...estilos.selectorBtn, background:'#1d4ed8'}} onClick={abrirSelectorLocal}>
              Seleccionar local
            </button>
          </div>
        </div>
      )}

      {/* Header — reloj y local */}
      <header style={estilos.header}>
        <div style={estilos.marca}>LOS NOTABLES</div>
        <div style={{display:'flex', alignItems:'center', gap:'16px'}}>
          {localNombre && (
            <button onClick={abrirSelectorLocal} style={estilos.localBtn}>
              {localNombre} ▾
            </button>
          )}
          <div style={estilos.reloj}>{hora}</div>
        </div>
      </header>

      {/* Display central — estado actual */}
      <div style={estilos.display}>
        <DisplayEstado
          estado={estado}
          empleado={empleado}
          accion={accion}
          mensaje={mensaje}
          registro={registro}
          lectorActivo={lectorActivo}
        />
      </div>

      {/* Footer */}
      <footer style={estilos.footer}>
        <span style={{display:'inline-flex', alignItems:'center', gap:'8px'}}>
          <span style={{
            width:'8px', height:'8px', borderRadius:'50%',
            background: lectorActivo ? '#22c55e' : '#ef4444',
            boxShadow: lectorActivo ? '0 0 8px #22c55e88' : 'none'
          }} />
          {lectorActivo ? 'Lector conectado' : 'Lector desconectado — verificá el dispositivo'}
          <span style={{color:'#1e293b'}}>·</span> SmartDom · Sistema Biométrico
        </span>
      </footer>
    </div>
  )
}


// Componente del display central
function DisplayEstado({ estado, empleado, accion, mensaje, registro, lectorActivo }) {
  const nombre = empleado ? `${empleado.nombre} ${empleado.apellido}` : ''
  const rolNombre = empleado?.rol?.nombre || registro?.rol?.nombre || ''
  const horaAhora = new Date().toLocaleTimeString('es-AR', {hour:'2-digit',minute:'2-digit',hour12:false})

  const contenidos = {
    [ESTADOS.LISTO]: lectorActivo ? {
      icono: '☞',
      titulo: 'Apoyá el dedo',
      sub: 'El sistema marca tu entrada o salida automáticamente',
      color: '#94a3b8'
    } : {
      icono: '⚠',
      titulo: 'Lector desconectado',
      sub: 'Revisá que el lector esté enchufado. Reintentando...',
      color: '#ef4444'
    },
    [ESTADOS.IDENTIFICANDO]: {
      icono: '⟳',
      titulo: 'Identificando...',
      sub: 'Mantené el dedo apoyado',
      color: '#f59e0b',
      pulsar: true
    },
    [ESTADOS.PROCESANDO]: {
      icono: '⟳',
      titulo: 'Registrando...',
      sub: '',
      color: '#f59e0b',
      pulsar: true
    },
    [ESTADOS.EXITO]: {
      icono: accion === ACCION.ENTRADA ? '↓' : '↑',
      titulo: nombre,
      sub: accion === ACCION.ENTRADA
        ? `Entrada registrada · ${rolNombre ? rolNombre + ' · ' : ''}${horaAhora}`
        : `Salida registrada · ${horaAhora}`,
      color: '#22c55e'
    },
    [ESTADOS.ERROR]: {
      icono: '✕',
      titulo: empleado ? nombre : 'Error',
      sub: mensaje,
      color: '#ef4444'
    },
    [ESTADOS.SIN_HUELLA]: {
      icono: '?',
      titulo: 'No reconocido',
      sub: mensaje,
      color: '#f97316'
    },
  }

  const c = contenidos[estado] || contenidos[ESTADOS.LISTO]

  return (
    <div style={{...estilos.displayInner, borderColor: c.color + '40'}}>
      <div style={{
        ...estilos.displayIcono,
        color: c.color,
        animation: c.pulsar ? 'pulsar 1.2s ease-in-out infinite' : 'none'
      }}>
        {c.icono}
      </div>
      <div style={{...estilos.displayTitulo, color: c.color === '#94a3b8' ? '#e2e8f0' : c.color}}>
        {c.titulo}
      </div>
      {c.sub && <div style={estilos.displaySub}>{c.sub}</div>}
    </div>
  )
}


// ── Estilos ───────────────────────────────────────────────────────────────────
const estilos = {
  root: {
    minHeight: '100vh',
    background: '#0a0f1a',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'space-between',
    fontFamily: "'DM Sans', 'Segoe UI', sans-serif",
    color: '#e2e8f0',
    padding: '0',
    position: 'relative',
    overflow: 'hidden',
    userSelect: 'none',
  },
  fondo: {
    position: 'absolute', inset: 0,
    background: 'radial-gradient(ellipse 80% 60% at 50% 0%, #0b1829 0%, #0a0f1a 100%)',
    backgroundImage: `
      radial-gradient(ellipse 80% 60% at 50% 0%, #0b1829 0%, #0a0f1a 100%),
      repeating-linear-gradient(0deg, transparent, transparent 39px, #ffffff06 39px, #ffffff06 40px),
      repeating-linear-gradient(90deg, transparent, transparent 39px, #ffffff06 39px, #ffffff06 40px)
    `,
    pointerEvents: 'none',
  },
  header: {
    width: '100%',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '28px 48px',
    borderBottom: '1px solid #ffffff10',
    zIndex: 1,
  },
  marca: {
    fontSize: '13px',
    fontWeight: '700',
    letterSpacing: '0.25em',
    color: '#475569',
    textTransform: 'uppercase',
  },
  reloj: {
    fontSize: '13px',
    fontWeight: '500',
    letterSpacing: '0.15em',
    color: '#475569',
    fontVariantNumeric: 'tabular-nums',
  },
  display: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    padding: '40px 48px',
    zIndex: 1,
  },
  displayInner: {
    width: '100%',
    maxWidth: '680px',
    border: '1px solid',
    borderRadius: '24px',
    padding: '60px 48px',
    textAlign: 'center',
    background: '#0d1520',
    transition: 'border-color 0.4s ease',
  },
  displayIcono: {
    fontSize: '72px',
    lineHeight: 1,
    marginBottom: '28px',
    display: 'block',
    transition: 'color 0.4s ease',
  },
  displayTitulo: {
    fontSize: '42px',
    fontWeight: '700',
    letterSpacing: '-0.02em',
    lineHeight: 1.1,
    marginBottom: '12px',
    transition: 'color 0.4s ease',
  },
  displaySub: {
    fontSize: '18px',
    color: '#64748b',
    fontWeight: '400',
    letterSpacing: '0.01em',
  },
  roles: {
    width: '100%',
    maxWidth: '680px',
    padding: '0 48px 48px',
    zIndex: 1,
    textAlign: 'center',
  },
  selectorOverlay: {
    position: 'fixed', inset: 0,
    background: '#0a0f1aee',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 100,
  },
  selectorBox: {
    background: '#0d1520',
    border: '1px solid #1e293b',
    borderRadius: '24px',
    padding: '48px 40px',
    minWidth: '320px',
    maxWidth: '480px',
    width: '100%',
    textAlign: 'center',
    display: 'flex', flexDirection: 'column', gap: '12px',
  },
  selectorTitulo: {
    fontSize: '26px',
    fontWeight: '700',
    color: '#e2e8f0',
    marginBottom: '8px',
    letterSpacing: '-0.02em',
  },
  selectorBtn: {
    padding: '18px 24px',
    borderRadius: '14px',
    border: '1px solid #334155',
    background: '#1e293b',
    color: '#e2e8f0',
    fontSize: '17px',
    fontWeight: '600',
    cursor: 'pointer',
    letterSpacing: '0.02em',
    transition: 'background 0.15s ease',
    width: '100%',
  },
  cancelarBtn: {
    padding: '12px 24px',
    borderRadius: '10px',
    border: '1px solid #1e293b',
    background: 'transparent',
    color: '#475569',
    fontSize: '14px',
    cursor: 'pointer',
    letterSpacing: '0.05em',
  },
  localBtn: {
    padding: '6px 14px',
    borderRadius: '8px',
    border: '1px solid #1e293b',
    background: '#0d1520',
    color: '#64748b',
    fontSize: '12px',
    fontWeight: '600',
    cursor: 'pointer',
    letterSpacing: '0.05em',
  },
  footer: {
    width: '100%',
    textAlign: 'center',
    padding: '20px',
    fontSize: '12px',
    color: '#475569',
    letterSpacing: '0.08em',
    zIndex: 1,
    borderTop: '1px solid #ffffff06',
  },
}

// Animación CSS para el ícono pulsante
const style = document.createElement('style')
style.textContent = `
  @keyframes pulsar { 0%,100% { opacity:1; transform: scale(1) } 50% { opacity:0.5; transform: scale(0.95) } }
  button:active { transform: scale(0.97) !important; filter: brightness(0.9) !important; }
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;600;700;800&display=swap');
`
document.head.appendChild(style)

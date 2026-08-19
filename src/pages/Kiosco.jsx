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
  LISTO:         'listo',          // esperando DNI + dedo
  IDENTIFICANDO: 'identificando',  // huella capturada, verificando contra el DNI
  PROCESANDO:    'procesando',     // registrando entrada/salida
  EXITO:         'exito',
  ERROR:         'error',
  SIN_HUELLA:    'sin_huella',
}

const ACCION = { ENTRADA: 'entrada', SALIDA: 'salida' }

// Tiempos (ms)
const CAPTURE_TIMEOUT = 10000  // cuánto espera cada intento de captura un dedo
const COOLDOWN_MS     = 6000   // pausa tras una marcación exitosa
const ERROR_HOLD_MS   = 3800   // cuánto se muestra un error

const sleep = (ms) => new Promise(r => setTimeout(r, ms))

// Valida que el local sea un UUID real (evita fichar con un LOCAL_ID sin
// configurar, ej. el placeholder "__LOCAL_ID__", que rompe el registro).
const esUUID = (s) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s || '')

// Candado a nivel de módulo: una sola lectura se procesa a la vez.
let procesandoLectura = false

export default function Kiosco() {
  const [estado, setEstado]               = useState(ESTADOS.LISTO)
  const [accion, setAccion]               = useState(null)
  const [empleado, setEmpleado]           = useState(null)
  const [registro, setRegistro]           = useState(null)
  const [mensaje, setMensaje]             = useState('')
  const [dni, setDni]                     = useState('')
  const [localId, setLocalId]             = useState(null)
  const [localNombre, setLocalNombre]     = useState('')
  const [locales, setLocales]             = useState([])
  const [eligiendoLocal, setEligiendoLocal] = useState(false)
  const [lectorActivo, setLectorActivo]   = useState(true)

  const loopTokenRef = useRef(0)     // token del loop activo (evita loops duplicados)
  const localIdRef = useRef(null)    // localId siempre actualizado para el loop
  const dniRef = useRef('')          // DNI siempre actualizado para el loop
  const STORAGE_KEY = 'kiosco_local_id'
  const STORAGE_NOMBRE = 'kiosco_local_nombre'

  useEffect(() => { localIdRef.current = localId }, [localId])
  useEffect(() => { dniRef.current = dni }, [dni])

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
  }, [])

  // Loop de lectura automática: arranca cuando hay local seleccionado
  useEffect(() => {
    if (!localId) return
    const token = ++loopTokenRef.current
    loopCaptura(token)
    return () => { loopTokenRef.current++ }
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

  // ── Teclado numérico ────────────────────────────────────────────────────────
  const tipear = (d) => { if (estado === ESTADOS.LISTO) setDni(prev => (prev + d).slice(0, 10)) }
  const borrar = () => { if (estado === ESTADOS.LISTO) setDni(prev => prev.slice(0, -1)) }
  const limpiarDni = () => { if (estado === ESTADOS.LISTO) setDni('') }

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
        const elapsed = Date.now() - t0
        if (elapsed < 1500) { fallosRapidos++ } else { fallosRapidos = 0 }
        setLectorActivo(fallosRapidos < 3)
        await sleep(elapsed < 1500 ? 1200 : 300)
        continue
      }

      fallosRapidos = 0
      setLectorActivo(true)

      if (procesandoLectura) { await sleep(400); continue }
      procesandoLectura = true
      try {
        await procesarLectura(cap.template, token)
      } finally {
        procesandoLectura = false
      }
    }
  }

  // finLectura: muestra el resultado holdMs y vuelve a LISTO.
  // Por defecto limpia el DNI; pasar { conservarDni: true } para dejarlo (reintento).
  const finLectura = async (nuevoEstado, info, holdMs, token) => {
    setEmpleado(info.empleado || null)
    setAccion(info.accion || null)
    setRegistro(info.registro || null)
    setMensaje(info.mensaje || '')
    setEstado(nuevoEstado)
    await sleep(holdMs)
    if (loopTokenRef.current !== token) return
    setEstado(ESTADOS.LISTO)
    setEmpleado(null); setAccion(null); setRegistro(null); setMensaje('')
    if (!info.conservarDni) { setDni(''); dniRef.current = '' }
  }

  const procesarLectura = async (template, token) => {
    const lid = localIdRef.current
    const dniActual = (dniRef.current || '').replace(/\D/g, '')

    // Gate: el DNI debe estar ingresado primero
    if (!dniActual) {
      return finLectura(ESTADOS.ERROR, {
        mensaje: 'Primero ingresá tu DNI en el teclado y después apoyá el dedo.',
        conservarDni: true
      }, ERROR_HOLD_MS, token)
    }

    setEstado(ESTADOS.IDENTIFICANDO)

    // 1. Traer las huellas de ESE DNI (verificación 1:1, rápida)
    const res = await biometricoService.getHuellasPorDni(dniActual)
    if (!res.success) {
      return finLectura(ESTADOS.ERROR, { mensaje: 'Error al buscar el DNI. Intentá de nuevo.', conservarDni: true }, ERROR_HOLD_MS, token)
    }
    const filas = res.data
    if (!filas || filas.length === 0) {
      return finLectura(ESTADOS.ERROR, { mensaje: `No existe un empleado activo con el DNI ${dniActual}. Verificá el número.` }, ERROR_HOLD_MS, token)
    }
    const huellas = filas.filter(f => f.template_iso)
    if (huellas.length === 0) {
      return finLectura(ESTADOS.ERROR, { mensaje: 'Ese DNI no tiene huella registrada. Consultá al encargado.' }, ERROR_HOLD_MS, token)
    }

    // 2. Verificar el dedo SOLO contra las huellas de ese DNI
    const match = await biometricoService.identificarEmpleado(template, huellas)
    biometricoService.registrarLectura({
      localId: lid, empleadoId: match.encontrado ? match.empleado_id : filas[0].empleado_id,
      score: match.score, margen: match.margen,
      motivo: match.encontrado ? 'ok_1a1' : (match.motivo || 'no_match_dni'),
      candidatos: huellas.length
    })

    if (!match.encontrado) {
      return finLectura(ESTADOS.SIN_HUELLA, {
        mensaje: 'El DNI o la huella no coinciden. No se registró nada. Verificá el DNI y apoyá el dedo bien centrado.',
        conservarDni: true
      }, ERROR_HOLD_MS, token)
    }

    // 3. Datos del empleado verificado
    const { data: emp, error: empErr } = await supabaseKiosco
      .from('empleados')
      .select('*, rol:roles(id, nombre)')
      .eq('id', match.empleado_id)
      .single()
    if (empErr || !emp) {
      return finLectura(ESTADOS.ERROR, { mensaje: 'No se pudo cargar el empleado. Intentá de nuevo.' }, ERROR_HOLD_MS, token)
    }

    // 4. ¿Tiene un registro abierto? → decide entrada/salida
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
        empleado_id: emp.id, local_id: lid, rol_id: emp.rol_id,
        fecha, hora_entrada: ahora, metodo_registro: 'biometrico'
      })
      .select('*, rol:roles(nombre)')
      .single()
    if (error) {
      const yaAbierto = error.code === '23505' || /turno abierto/i.test(error.message || '')
      const mensaje = yaAbierto
        ? `${emp.nombre} ya tiene un turno abierto. Apoyá el dedo de nuevo para registrar la salida.`
        : error.message
      return finLectura(ESTADOS.ERROR, { empleado: emp, mensaje }, ERROR_HOLD_MS, token)
    }
    return finLectura(ESTADOS.EXITO, { empleado: emp, accion: ACCION.ENTRADA, registro: data }, COOLDOWN_MS, token)
  }

  const hora = new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false })
  const editable = estado === ESTADOS.LISTO

  return (
    <div style={estilos.root}>
      <div style={estilos.fondo} />

      {/* Selector de local */}
      {eligiendoLocal && (
        <div style={estilos.selectorOverlay}>
          <div style={estilos.selectorBox}>
            <p style={estilos.selectorTitulo}>Seleccioná el local</p>
            {locales.map(loc => (
              <button key={loc.id} style={estilos.selectorBtn} onClick={() => elegirLocal(loc)}>{loc.nombre}</button>
            ))}
            {localId && <button style={estilos.cancelarBtn} onClick={() => setEligiendoLocal(false)}>Cancelar</button>}
          </div>
        </div>
      )}
      {!localId && !eligiendoLocal && (
        <div style={estilos.selectorOverlay}>
          <div style={estilos.selectorBox}>
            <p style={estilos.selectorTitulo}>Kiosco Biométrico</p>
            <p style={{color:'#64748b', marginBottom:'24px', fontSize:'15px'}}>Para comenzar, seleccioná el local</p>
            <button style={{...estilos.selectorBtn, background:'#1d4ed8'}} onClick={abrirSelectorLocal}>Seleccionar local</button>
          </div>
        </div>
      )}

      {/* Header */}
      <header style={estilos.header}>
        <div style={estilos.marca}>LOS NOTABLES</div>
        <div style={{display:'flex', alignItems:'center', gap:'16px'}}>
          {localNombre && <button onClick={abrirSelectorLocal} style={estilos.localBtn}>{localNombre} ▾</button>}
          <div style={estilos.reloj}>{hora}</div>
        </div>
      </header>

      {/* Cuerpo: teclado (izq) + lector (der) */}
      <main style={estilos.main}>
        {/* ── Izquierda: DNI + teclado ── */}
        <div style={estilos.colIzq}>
          <div style={estilos.pasoLabel}><span style={estilos.pasoNum}>1</span> Ingresá tu DNI</div>
          <div style={{...estilos.dniDisplay, borderColor: dni ? '#0B9FD9' : '#1e293b'}}>
            {dni ? dni : <span style={{color:'#334155'}}>— — — — — —</span>}
          </div>
          <div style={estilos.teclado}>
            {['1','2','3','4','5','6','7','8','9'].map(n => (
              <button key={n} style={estilos.tecla} onClick={() => tipear(n)} disabled={!editable}>{n}</button>
            ))}
            <button style={{...estilos.tecla, ...estilos.teclaAccion}} onClick={borrar} disabled={!editable}>⌫</button>
            <button style={estilos.tecla} onClick={() => tipear('0')} disabled={!editable}>0</button>
            <button style={{...estilos.tecla, ...estilos.teclaAccion}} onClick={limpiarDni} disabled={!editable}>C</button>
          </div>
        </div>

        {/* ── Derecha: lector ── */}
        <div style={estilos.colDer}>
          <div style={estilos.pasoLabel}><span style={estilos.pasoNum}>2</span> Apoyá el dedo</div>
          <DisplayEstado
            estado={estado} empleado={empleado} accion={accion}
            mensaje={mensaje} registro={registro}
            lectorActivo={lectorActivo} dniListo={dni.length > 0}
          />
        </div>
      </main>

      {/* Footer */}
      <footer style={estilos.footer}>
        <span style={{display:'inline-flex', alignItems:'center', gap:'8px'}}>
          <span style={{ width:'8px', height:'8px', borderRadius:'50%',
            background: lectorActivo ? '#22c55e' : '#ef4444',
            boxShadow: lectorActivo ? '0 0 8px #22c55e88' : 'none' }} />
          {lectorActivo ? 'Lector conectado' : 'Lector desconectado — verificá el dispositivo'}
          <span style={{color:'#1e293b'}}>·</span> SmartDom · Sistema Biométrico
        </span>
      </footer>
    </div>
  )
}


function DisplayEstado({ estado, empleado, accion, mensaje, registro, lectorActivo, dniListo }) {
  const nombre = empleado ? `${empleado.nombre} ${empleado.apellido}` : ''
  const rolNombre = empleado?.rol?.nombre || registro?.rol?.nombre || ''
  const horaAhora = new Date().toLocaleTimeString('es-AR', {hour:'2-digit',minute:'2-digit',hour12:false})

  const listo = !lectorActivo
    ? { icono:'⚠', titulo:'Lector desconectado', sub:'Revisá que el lector esté enchufado. Reintentando...', color:'#ef4444' }
    : dniListo
      ? { icono:'☞', titulo:'Apoyá el dedo', sub:'Verificamos tu huella con el DNI ingresado', color:'#22c55e' }
      : { icono:'⌨', titulo:'Ingresá tu DNI', sub:'Usá el teclado y después apoyá el dedo', color:'#64748b' }

  const contenidos = {
    [ESTADOS.LISTO]: listo,
    [ESTADOS.IDENTIFICANDO]: { icono:'⟳', titulo:'Verificando...', sub:'Mantené el dedo apoyado', color:'#f59e0b', pulsar:true },
    [ESTADOS.PROCESANDO]:    { icono:'⟳', titulo:'Registrando...', sub:'', color:'#f59e0b', pulsar:true },
    [ESTADOS.EXITO]: {
      icono: accion === ACCION.ENTRADA ? '↓' : '↑',
      titulo: nombre,
      sub: accion === ACCION.ENTRADA
        ? `Entrada registrada · ${rolNombre ? rolNombre + ' · ' : ''}${horaAhora}`
        : `Salida registrada · ${horaAhora}`,
      color: '#22c55e'
    },
    [ESTADOS.ERROR]:      { icono:'✕', titulo: empleado ? nombre : 'Atención', sub: mensaje, color:'#ef4444' },
    [ESTADOS.SIN_HUELLA]: { icono:'✕', titulo:'No coincide', sub: mensaje, color:'#f97316' },
  }

  const c = contenidos[estado] || listo

  return (
    <div style={{...estilos.displayInner, borderColor: c.color + '40'}}>
      <div style={{...estilos.displayIcono, color: c.color, animation: c.pulsar ? 'pulsar 1.2s ease-in-out infinite' : 'none'}}>{c.icono}</div>
      <div style={{...estilos.displayTitulo, color: c.color === '#64748b' ? '#e2e8f0' : c.color}}>{c.titulo}</div>
      {c.sub && <div style={estilos.displaySub}>{c.sub}</div>}
    </div>
  )
}


// ── Estilos ───────────────────────────────────────────────────────────────────
const estilos = {
  root: {
    minHeight: '100vh', background: '#0a0f1a', display: 'flex', flexDirection: 'column',
    justifyContent: 'space-between', fontFamily: "'DM Sans', 'Segoe UI', sans-serif",
    color: '#e2e8f0', position: 'relative', overflow: 'hidden', userSelect: 'none',
  },
  fondo: {
    position: 'absolute', inset: 0,
    backgroundImage: `
      radial-gradient(ellipse 80% 60% at 50% 0%, #0b1829 0%, #0a0f1a 100%),
      repeating-linear-gradient(0deg, transparent, transparent 39px, #ffffff06 39px, #ffffff06 40px),
      repeating-linear-gradient(90deg, transparent, transparent 39px, #ffffff06 39px, #ffffff06 40px)`,
    pointerEvents: 'none',
  },
  header: {
    width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '20px 40px', borderBottom: '1px solid #ffffff10', zIndex: 1, boxSizing: 'border-box',
  },
  marca: { fontSize: '13px', fontWeight: '700', letterSpacing: '0.25em', color: '#475569', textTransform: 'uppercase' },
  reloj: { fontSize: '13px', fontWeight: '500', letterSpacing: '0.15em', color: '#475569', fontVariantNumeric: 'tabular-nums' },

  main: {
    flex: 1, width: '100%', display: 'flex', alignItems: 'stretch', justifyContent: 'center',
    gap: '32px', padding: '24px 40px', zIndex: 1, boxSizing: 'border-box', flexWrap: 'wrap',
  },
  colIzq: {
    flex: '1 1 360px', maxWidth: '460px', display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center', gap: '18px',
  },
  colDer: {
    flex: '1 1 360px', maxWidth: '560px', display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center', gap: '18px',
  },
  pasoLabel: {
    fontSize: '15px', fontWeight: '700', color: '#94a3b8', letterSpacing: '0.02em',
    display: 'flex', alignItems: 'center', gap: '10px', textTransform: 'uppercase',
  },
  pasoNum: {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    width: '26px', height: '26px', borderRadius: '50%', background: '#1d4ed8',
    color: '#fff', fontSize: '14px', fontWeight: '800',
  },
  dniDisplay: {
    width: '100%', textAlign: 'center', fontSize: '40px', fontWeight: '800',
    letterSpacing: '0.12em', color: '#e2e8f0', background: '#0d1520',
    border: '2px solid', borderRadius: '16px', padding: '16px 12px',
    fontVariantNumeric: 'tabular-nums', minHeight: '40px', transition: 'border-color 0.2s',
  },
  teclado: { width: '100%', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' },
  tecla: {
    padding: '22px 0', fontSize: '28px', fontWeight: '700', color: '#e2e8f0',
    background: '#1e293b', border: '1px solid #334155', borderRadius: '14px',
    cursor: 'pointer', transition: 'background 0.12s',
  },
  teclaAccion: { background: '#0d1520', color: '#94a3b8', fontSize: '22px' },

  displayInner: {
    width: '100%', border: '1px solid', borderRadius: '24px', padding: '48px 32px',
    textAlign: 'center', background: '#0d1520', transition: 'border-color 0.4s ease',
  },
  displayIcono: { fontSize: '68px', lineHeight: 1, marginBottom: '22px', display: 'block', transition: 'color 0.4s ease' },
  displayTitulo: { fontSize: '38px', fontWeight: '700', letterSpacing: '-0.02em', lineHeight: 1.1, marginBottom: '12px', transition: 'color 0.4s ease' },
  displaySub: { fontSize: '17px', color: '#64748b', fontWeight: '400', lineHeight: 1.4 },

  selectorOverlay: { position: 'fixed', inset: 0, background: '#0a0f1aee', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 },
  selectorBox: { background: '#0d1520', border: '1px solid #1e293b', borderRadius: '24px', padding: '48px 40px', minWidth: '320px', maxWidth: '480px', width: '100%', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '12px' },
  selectorTitulo: { fontSize: '26px', fontWeight: '700', color: '#e2e8f0', marginBottom: '8px', letterSpacing: '-0.02em' },
  selectorBtn: { padding: '18px 24px', borderRadius: '14px', border: '1px solid #334155', background: '#1e293b', color: '#e2e8f0', fontSize: '17px', fontWeight: '600', cursor: 'pointer', width: '100%' },
  cancelarBtn: { padding: '12px 24px', borderRadius: '10px', border: '1px solid #1e293b', background: 'transparent', color: '#475569', fontSize: '14px', cursor: 'pointer' },
  localBtn: { padding: '6px 14px', borderRadius: '8px', border: '1px solid #1e293b', background: '#0d1520', color: '#64748b', fontSize: '12px', fontWeight: '600', cursor: 'pointer', letterSpacing: '0.05em' },
  footer: { width: '100%', textAlign: 'center', padding: '16px', fontSize: '12px', color: '#475569', letterSpacing: '0.08em', zIndex: 1, borderTop: '1px solid #ffffff06', boxSizing: 'border-box' },
}

// Animación + fuente
const style = document.createElement('style')
style.textContent = `
  @keyframes pulsar { 0%,100% { opacity:1; transform: scale(1) } 50% { opacity:0.5; transform: scale(0.95) } }
  button:active:not(:disabled) { transform: scale(0.96) !important; filter: brightness(1.15) !important; }
  button:disabled { opacity: 0.5; cursor: default; }
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;600;700;800&display=swap');
`
document.head.appendChild(style)

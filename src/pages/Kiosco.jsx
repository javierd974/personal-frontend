import React, { useState, useEffect, useRef } from 'react'
import { biometricoService } from '../services/biometricoService'
import { registrosService } from '../services/registrosService'
import { rolesService } from '../services/catalogosService'

const ESTADOS = {
  LISTO:        'listo',
  LEYENDO:      'leyendo',
  IDENTIFICANDO:'identificando',
  CONFIRMAR:    'confirmar',
  PROCESANDO:   'procesando',
  EXITO:        'exito',
  ERROR:        'error',
  SIN_HUELLA:   'sin_huella',
}

const ACCION = { ENTRADA: 'entrada', SALIDA: 'salida' }

export default function Kiosco() {
  const [estado, setEstado]               = useState(ESTADOS.LISTO)
  const [accion, setAccion]               = useState(null)
  const [empleado, setEmpleado]           = useState(null)
  const [registro, setRegistro]           = useState(null)
  const [roles, setRoles]                 = useState([])
  const [rolSeleccionado, setRolSeleccionado] = useState(null)
  const [mensaje, setMensaje]             = useState('')
  const [localId, setLocalId]             = useState(null)
  const timeoutRef                        = useRef(null)

  useEffect(() => {
    // Leer localId desde URL: /kiosco?local=UUID
    const params = new URLSearchParams(window.location.search)
    const lid = params.get('local')
    if (lid) setLocalId(lid)
    rolesService.getRoles().then(r => { if (r.success) setRoles(r.data) })
    return () => clearTimeout(timeoutRef.current)
  }, [])

  const resetear = (delay = 0) => {
    clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(() => {
      setEstado(ESTADOS.LISTO)
      setAccion(null)
      setEmpleado(null)
      setRegistro(null)
      setRolSeleccionado(null)
      setMensaje('')
    }, delay)
  }

  const iniciarLectura = async (accionElegida) => {
    setAccion(accionElegida)
    setEstado(ESTADOS.LEYENDO)
    setEmpleado(null)
    setMensaje('')

    const capturaResult = await biometricoService.capturarHuella(12000)
    if (!capturaResult.success) {
      setEstado(ESTADOS.ERROR)
      setMensaje(capturaResult.error)
      resetear(3500)
      return
    }

    setEstado(ESTADOS.IDENTIFICANDO)
    const huellasResult = await biometricoService.getHuellasActivas()
    if (!huellasResult.success || huellasResult.data.length === 0) {
      setEstado(ESTADOS.ERROR)
      setMensaje('No hay huellas registradas. Consultá al encargado.')
      resetear(4000)
      return
    }

    const match = await biometricoService.identificarEmpleado(capturaResult.template, huellasResult.data)
    if (!match.encontrado) {
      setEstado(ESTADOS.SIN_HUELLA)
      setMensaje('Huella no reconocida. Consultá al encargado.')
      resetear(4000)
      return
    }

    // Traer datos del empleado incluyendo su rol por defecto
    const { supabase } = await import('../services/supabase')
    const { data: emp } = await supabase
      .from('empleados')
      .select('*, rol:roles(id, nombre)')
      .eq('id', match.empleado_id)
      .single()
    setEmpleado(emp)

    if (accionElegida === ACCION.ENTRADA) {
      if (emp?.rol_id && emp?.rol) {
        // Tiene rol asignado → registrar directamente sin preguntar
        await procesarEntradaDirecta(emp, emp.rol)
      } else {
        // Sin rol asignado → mostrar selector
        setEstado(ESTADOS.CONFIRMAR)
      }
    } else {
      await procesarSalida(emp)
    }
  }


  // Entrada con rol conocido (sin preguntar)
  const procesarEntradaDirecta = async (emp, rol) => {
    if (!localId) return
    setEstado(ESTADOS.PROCESANDO)
    const result = await registrosService.registrarEntrada(emp.id, localId, rol.id, '')
    if (result.success) {
      setRegistro(result.data)
      setEstado(ESTADOS.EXITO)
      resetear(4000)
    } else {
      setEstado(ESTADOS.ERROR)
      setMensaje(result.error)
      resetear(4000)
    }
  }

  const procesarEntrada = async (rol) => {
    if (!empleado || !localId) return
    setRolSeleccionado(rol)
    setEstado(ESTADOS.PROCESANDO)
    const result = await registrosService.registrarEntrada(empleado.id, localId, rol.id, '')
    if (result.success) {
      setRegistro(result.data)
      setEstado(ESTADOS.EXITO)
      resetear(4000)
    } else {
      setEstado(ESTADOS.ERROR)
      setMensaje(result.error)
      resetear(4000)
    }
  }

  const procesarSalida = async (emp) => {
    setEstado(ESTADOS.PROCESANDO)
    // Buscar registro abierto del empleado
    const { supabase } = await import('../services/supabase')
    const { data: regAbierto } = await supabase
      .from('registros_horarios')
      .select('*, rol:roles(nombre)')
      .eq('empleado_id', emp.id)
      .is('hora_salida', null)
      .maybeSingle()

    if (!regAbierto) {
      setEstado(ESTADOS.ERROR)
      setMensaje('No hay ingreso registrado hoy. Consultá al encargado.')
      resetear(4000)
      return
    }

    const result = await registrosService.registrarSalida(regAbierto.id)
    if (result.success) {
      setRegistro(regAbierto)
      setEstado(ESTADOS.EXITO)
      resetear(4000)
    } else {
      setEstado(ESTADOS.ERROR)
      setMensaje(result.error)
      resetear(4000)
    }
  }

  const hora = new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false })

  return (
    <div style={estilos.root}>
      {/* Fondo con textura sutil */}
      <div style={estilos.fondo} />

      {/* Header — reloj y local */}
      <header style={estilos.header}>
        <div style={estilos.marca}>LOS NOTABLES</div>
        <div style={estilos.reloj}>{hora}</div>
      </header>

      {/* Display central — estado actual */}
      <div style={estilos.display}>
        <DisplayEstado
          estado={estado}
          empleado={empleado}
          accion={accion}
          mensaje={mensaje}
          registro={registro}
        />
      </div>

      {/* Selector de rol — solo aparece para entrada después de identificar */}
      {estado === ESTADOS.CONFIRMAR && roles.length > 0 && (
        <div style={estilos.roles}>
          <p style={estilos.rolesLabel}>Seleccioná tu rol</p>
          <div style={estilos.rolesGrid}>
            {roles.map(rol => (
              <button key={rol.id} style={estilos.rolBtn} onClick={() => procesarEntrada(rol)}>
                {rol.nombre}
              </button>
            ))}
          </div>
          <button style={estilos.cancelarBtn} onClick={() => resetear(0)}>Cancelar</button>
        </div>
      )}

      {/* Botones principales — solo en estado LISTO */}
      {estado === ESTADOS.LISTO && (
        <div style={estilos.botones}>
          <button style={{...estilos.boton, ...estilos.botonEntrada}}
            onClick={() => iniciarLectura(ACCION.ENTRADA)}>
            <span style={estilos.botonIcono}>↓</span>
            <span style={estilos.botonTexto}>ENTRADA</span>
          </button>
          <button style={{...estilos.boton, ...estilos.botonSalida}}
            onClick={() => iniciarLectura(ACCION.SALIDA)}>
            <span style={estilos.botonIcono}>↑</span>
            <span style={estilos.botonTexto}>SALIDA</span>
          </button>
        </div>
      )}

      {/* Footer */}
      <footer style={estilos.footer}>
        <span>SmartDom · Sistema Biométrico</span>
        {!localId && <span style={{color:'#ef4444'}}> · Sin local configurado</span>}
      </footer>
    </div>
  )
}


// Componente del display central
function DisplayEstado({ estado, empleado, accion, mensaje, registro }) {
  const nombre = empleado ? `${empleado.nombre} ${empleado.apellido}` : ''
  const rolNombre = empleado?.rol?.nombre || registro?.rol?.nombre || ''

  const contenidos = {
    [ESTADOS.LISTO]: {
      icono: '☞',
      titulo: 'Apoyá el dedo',
      sub: 'y presioná ENTRADA o SALIDA',
      color: '#94a3b8'
    },
    [ESTADOS.LEYENDO]: {
      icono: '◎',
      titulo: 'Leyendo huella...',
      sub: 'Mantené el dedo apoyado',
      color: '#f59e0b',
      pulsar: true
    },
    [ESTADOS.IDENTIFICANDO]: {
      icono: '⟳',
      titulo: 'Identificando...',
      sub: '',
      color: '#f59e0b',
      pulsar: true
    },
    [ESTADOS.CONFIRMAR]: {
      icono: '✓',
      titulo: nombre,
      sub: 'Identificado — seleccioná tu rol',
      color: '#22c55e'
    },
    [ESTADOS.PROCESANDO]: {
      icono: '⟳',
      titulo: 'Registrando...',
      sub: '',
      color: '#f59e0b',
      pulsar: true
    },
    [ESTADOS.EXITO]: {
      icono: '✓',
      titulo: nombre,
      sub: accion === ACCION.ENTRADA
        ? `Ingreso registrado · ${rolNombre ? rolNombre + ' · ' : ''}${new Date().toLocaleTimeString('es-AR', {hour:'2-digit',minute:'2-digit',hour12:false})}`
        : `Salida registrada · ${new Date().toLocaleTimeString('es-AR', {hour:'2-digit',minute:'2-digit',hour12:false})}`,
      color: '#22c55e'
    },
    [ESTADOS.ERROR]: {
      icono: '✕',
      titulo: 'Error',
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
  botones: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '20px',
    width: '100%',
    maxWidth: '680px',
    padding: '0 48px 48px',
    zIndex: 1,
  },
  boton: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '12px',
    padding: '40px 24px',
    borderRadius: '20px',
    border: 'none',
    cursor: 'pointer',
    transition: 'transform 0.15s ease, filter 0.15s ease',
    outline: 'none',
    WebkitTapHighlightColor: 'transparent',
  },
  botonEntrada: {
    background: 'linear-gradient(135deg, #166534 0%, #15803d 100%)',
    boxShadow: '0 8px 32px #16653440, inset 0 1px 0 #ffffff20',
  },
  botonSalida: {
    background: 'linear-gradient(135deg, #7c2d12 0%, #b45309 100%)',
    boxShadow: '0 8px 32px #b4530940, inset 0 1px 0 #ffffff20',
  },
  botonIcono: {
    fontSize: '40px',
    color: '#fff',
    lineHeight: 1,
  },
  botonTexto: {
    fontSize: '22px',
    fontWeight: '800',
    color: '#fff',
    letterSpacing: '0.12em',
  },
  roles: {
    width: '100%',
    maxWidth: '680px',
    padding: '0 48px 48px',
    zIndex: 1,
    textAlign: 'center',
  },
  rolesLabel: {
    fontSize: '16px',
    color: '#64748b',
    marginBottom: '16px',
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  rolesGrid: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '12px',
    justifyContent: 'center',
    marginBottom: '16px',
  },
  rolBtn: {
    padding: '18px 32px',
    borderRadius: '14px',
    border: '1px solid #334155',
    background: '#1e293b',
    color: '#e2e8f0',
    fontSize: '17px',
    fontWeight: '600',
    cursor: 'pointer',
    letterSpacing: '0.03em',
    transition: 'background 0.15s ease',
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
  footer: {
    width: '100%',
    textAlign: 'center',
    padding: '20px',
    fontSize: '12px',
    color: '#1e293b',
    letterSpacing: '0.1em',
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

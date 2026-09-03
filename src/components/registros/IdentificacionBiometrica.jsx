import React, { useState, useRef, useEffect } from 'react'
import { Fingerprint, XCircle, Loader2, LogIn, LogOut, Delete } from 'lucide-react'
import { biometricoService } from '../../services/biometricoService'
import { registrosService, COOLDOWN_MINUTOS } from '../../services/registrosService'

// Marcación por huella para la pantalla del encargado.
//
// Usa el MISMO mecanismo que el kiosco: verificación 1:1 por DNI. Antes esto
// hacía una identificación 1:N (bajaba las ~800 huellas del sistema y las
// comparaba una por una contra el WebAPI local), y por eso tardaba muchísimo.
// Ahora se ingresa el DNI, se traen SOLO las 1-2 huellas de ese documento y se
// compara contra esas: la verificación es prácticamente instantánea.
//
// Reglas de negocio (se validan acá y además en la base, con los triggers
// validar_entrada_unica y validar_cooldown_marcacion):
//   - No hay entrada si el empleado tiene un turno abierto, aunque sea de otro
//     día: en ese caso lo que corresponde es la SALIDA, y es lo que se registra.
//   - No hay salida sin una entrada previa abierta.
//   - No se puede marcar (entrada ni salida) dentro de los COOLDOWN_MINUTOS
//     posteriores a la marcación anterior del mismo empleado.

const PASOS = {
  DNI:         'dni',          // esperando el documento
  BUSCANDO:    'buscando',     // resolviendo el DNI contra la base
  CAPTURANDO:  'capturando',   // esperando el dedo en el lector
  VERIFICANDO: 'verificando',  // comparando la huella contra las de ese DNI
  PROCESANDO:  'procesando',   // registrando entrada/salida
  OK:          'ok',
  ERROR:       'error',
}

const CAPTURE_TIMEOUT = 12000   // ms que espera el lector a que apoyen el dedo
const CIERRE_OK_MS    = 2600    // cuánto se muestra el resultado antes de cerrar

const IdentificacionBiometrica = ({ localId, onRegistrado, onAlert }) => {
  const [abierto, setAbierto]     = useState(false)
  const [paso, setPaso]           = useState(PASOS.DNI)
  const [dni, setDni]             = useState('')
  const [mensaje, setMensaje]     = useState('')
  const [resultado, setResultado] = useState(null)   // { nombre, accion, hora, rol }
  const enCursoRef = useRef(false)                   // evita doble-toque / reentrada
  const inputRef   = useRef(null)
  const cierreRef  = useRef(null)

  const trabajando = paso === PASOS.BUSCANDO || paso === PASOS.CAPTURANDO ||
                     paso === PASOS.VERIFICANDO || paso === PASOS.PROCESANDO

  useEffect(() => () => clearTimeout(cierreRef.current), [])

  const abrir = () => {
    if (!localId) { onAlert?.({ type: 'error', message: 'Seleccioná un local primero.' }); return }
    clearTimeout(cierreRef.current)
    enCursoRef.current = false
    setDni(''); setMensaje(''); setResultado(null); setPaso(PASOS.DNI)
    setAbierto(true)
    // La PRIMERA llamada al WebAPI del lector tarda ~12 s (handshake TLS). Se
    // calienta al abrir el modal para que no la pague el empleado esperando.
    biometricoService.calentar()
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  const cerrar = () => {
    if (trabajando) return          // no cerrar en medio de una marcación
    clearTimeout(cierreRef.current)
    enCursoRef.current = false
    setAbierto(false)
  }

  // Muestra el error y vuelve al paso del DNI. Por defecto conserva lo tipeado
  // (para reintentar el dedo); limpiarDni cuando el problema es el documento.
  const fallar = (texto, { limpiarDni = false } = {}) => {
    setMensaje(texto)
    setPaso(PASOS.ERROR)
    if (limpiarDni) setDni('')
    enCursoRef.current = false
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  // ── Teclado numérico en pantalla (para las PCs con pantalla táctil) ─────────
  const tipear     = (d) => { if (!trabajando) { setDni(prev => (prev + d).slice(0, 10)); setPaso(PASOS.DNI) } }
  const borrar     = () => { if (!trabajando) { setDni(prev => prev.slice(0, -1)); setPaso(PASOS.DNI) } }
  const limpiarDni = () => { if (!trabajando) { setDni(''); setPaso(PASOS.DNI) } }

  // ── Flujo principal ────────────────────────────────────────────────────────
  const marcar = async () => {
    if (enCursoRef.current) return
    if (!localId) { fallar('Seleccioná un local primero.'); return }

    const documento = dni.replace(/\D/g, '')
    if (documento.length < 6) { fallar('Ingresá un DNI válido (al menos 6 dígitos).'); return }

    enCursoRef.current = true
    setResultado(null)
    setMensaje('')

    try {
      // 1. Huellas de ESE DNI (1:1, rápido). La RPC devuelve también los datos
      //    del empleado, así que no hace falta una segunda consulta.
      setPaso(PASOS.BUSCANDO)
      const res = await biometricoService.getHuellasPorDni(documento)
      if (!res.success) return fallar('Error al buscar el DNI. Intentá de nuevo.')

      const filas = res.data || []
      if (filas.length === 0) {
        return fallar(`No existe un empleado activo con el DNI ${documento}. Verificá el número.`, { limpiarDni: true })
      }
      const huellas = filas.filter(f => f.template_iso)
      if (huellas.length === 0) {
        return fallar('Ese DNI no tiene huella registrada. Enrolala desde Administración.', { limpiarDni: true })
      }

      const emp = filas[0]
      const nombre = `${emp.nombre} ${emp.apellido}`

      // 2. Capturar el dedo
      setPaso(PASOS.CAPTURANDO)
      const cap = await biometricoService.capturarHuella(CAPTURE_TIMEOUT)
      if (!cap.success) return fallar(cap.error)

      // 3. Comparar SOLO contra las huellas de ese DNI
      setPaso(PASOS.VERIFICANDO)
      const match = await biometricoService.identificarEmpleado(cap.template, huellas)
      biometricoService.registrarLectura({
        localId, empleadoId: emp.empleado_id,
        score: match.score, margen: match.margen,
        motivo: match.encontrado ? 'ok_1a1_admin' : (match.motivo || 'no_match_dni'),
        candidatos: huellas.length
      })
      if (!match.encontrado) {
        return fallar('El DNI o la huella no coinciden. No se registró nada. Verificá el DNI y apoyá el dedo bien centrado.')
      }

      // 4. ¿Tiene un turno abierto? → decide salida; si no, entrada
      setPaso(PASOS.PROCESANDO)
      const abiertoRes = await registrosService.getRegistroAbierto(emp.empleado_id)
      if (!abiertoRes.success) return fallar(abiertoRes.error)
      const regAbierto = abiertoRes.data

      // 5. Cooldown: ni entrada ni salida dentro de los COOLDOWN_MINUTOS de la
      //    marcación anterior (la base lo vuelve a validar igual).
      const cd = await registrosService.verificarCooldown(emp.empleado_id)
      if (!cd.success) return fallar(cd.error)
      if (!cd.puede) {
        const ultima = cd.ultima.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false })
        return fallar(
          `${nombre} marcó recién a las ${ultima} hs. Deben pasar ${COOLDOWN_MINUTOS} minutos entre marcaciones: faltan ${cd.faltan} minuto(s).`
        )
      }

      const hora = new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false })

      if (regAbierto) {
        // ── SALIDA (cierra el turno abierto, sea de hoy o de otro día) ──
        const salida = await registrosService.registrarSalida(regAbierto.id)
        if (!salida.success) return fallar(salida.error)
        setResultado({ nombre, accion: 'salida', hora, rol: regAbierto.rol?.nombre || '' })
        onAlert?.({ type: 'success', message: `Salida registrada: ${nombre}` })
      } else {
        // ── ENTRADA (con el rol del empleado, sin elegirlo de la lista) ──
        if (!emp.rol_id) {
          return fallar(`${nombre} no tiene un rol asignado. Cargalo en la ficha del empleado.`)
        }
        const entrada = await registrosService.registrarEntrada(emp.empleado_id, localId, emp.rol_id, '', 'biometrico')
        if (!entrada.success) return fallar(entrada.error)
        setResultado({ nombre, accion: 'entrada', hora, rol: entrada.data?.rol?.nombre || '' })
        onAlert?.({ type: 'success', message: `Entrada registrada: ${nombre}` })
      }

      setPaso(PASOS.OK)
      enCursoRef.current = false
      if (onRegistrado) await onRegistrado()
      cierreRef.current = setTimeout(() => setAbierto(false), CIERRE_OK_MS)
    } catch (error) {
      fallar(error?.message || 'Error inesperado al registrar. Intentá de nuevo.')
    }
  }

  const onKeyDown = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); marcar() }
    else if (e.key === 'Escape') { e.preventDefault(); cerrar() }
  }

  const esSalida = resultado?.accion === 'salida'
  const dniListo = dni.replace(/\D/g, '').length >= 6

  return (
    <>
      <button
        onClick={abrir}
        className="w-full py-5 rounded-xl font-bold text-lg transition-all flex items-center justify-center gap-3 shadow-lg text-white bg-indigo-600 hover:bg-indigo-700">
        <Fingerprint className="w-6 h-6" />
        <span>IDENTIFICAR POR HUELLA</span>
      </button>

      {abierto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 p-4"
          onClick={cerrar}>
          <div
            className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-slide-in"
            onClick={(e) => e.stopPropagation()}>

            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h2 className="text-xl font-bold text-dark flex items-center gap-2">
                <Fingerprint className="w-5 h-5 text-indigo-600" /> Marcación por huella
              </h2>
              <button
                onClick={cerrar} disabled={trabajando}
                className="text-gray-400 hover:text-gray-600 disabled:opacity-40 text-2xl leading-none">&times;</button>
            </div>

            <div className="p-6 space-y-4">
              {paso === PASOS.OK ? (
                /* ── Resultado ── */
                <div className={`rounded-xl p-6 text-center ${esSalida ? 'bg-amber-50' : 'bg-green-50'}`}>
                  <div className={`mx-auto mb-3 flex items-center justify-center w-14 h-14 rounded-full ${esSalida ? 'bg-amber-500' : 'bg-green-600'}`}>
                    {esSalida ? <LogOut className="w-7 h-7 text-white" /> : <LogIn className="w-7 h-7 text-white" />}
                  </div>
                  <p className="text-xl font-bold text-dark">{resultado.nombre}</p>
                  <p className={`text-sm font-semibold mt-1 ${esSalida ? 'text-amber-700' : 'text-green-700'}`}>
                    {esSalida ? 'Salida registrada' : 'Entrada registrada'}
                    {resultado.rol ? ` · ${resultado.rol}` : ''} · {resultado.hora} hs
                  </p>
                </div>
              ) : (
                <>
                  {/* ── Paso 1: DNI ── */}
                  <div>
                    <label className="label flex items-center gap-2">
                      <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-indigo-600 text-white text-xs font-bold">1</span>
                      DNI del empleado
                    </label>
                    <input
                      ref={inputRef} type="text" inputMode="numeric" value={dni}
                      onChange={(e) => {
                        setDni(e.target.value.replace(/\D/g, '').slice(0, 10))
                        if (paso === PASOS.ERROR) setPaso(PASOS.DNI)
                      }}
                      onKeyDown={onKeyDown}
                      disabled={trabajando}
                      placeholder="Ingresá el DNI"
                      className="input text-center text-3xl font-bold tracking-widest tabular-nums disabled:bg-gray-100"
                    />
                  </div>

                  {/* Teclado numérico */}
                  <div className="grid grid-cols-3 gap-2">
                    {['1','2','3','4','5','6','7','8','9'].map(n => (
                      <button key={n} onClick={() => tipear(n)} disabled={trabajando}
                        className="py-3 rounded-lg bg-gray-100 hover:bg-gray-200 text-xl font-bold text-dark disabled:opacity-40">{n}</button>
                    ))}
                    <button onClick={borrar} disabled={trabajando} title="Borrar"
                      className="py-3 rounded-lg bg-gray-50 hover:bg-gray-200 text-gray-500 flex items-center justify-center disabled:opacity-40">
                      <Delete className="w-5 h-5" />
                    </button>
                    <button onClick={() => tipear('0')} disabled={trabajando}
                      className="py-3 rounded-lg bg-gray-100 hover:bg-gray-200 text-xl font-bold text-dark disabled:opacity-40">0</button>
                    <button onClick={limpiarDni} disabled={trabajando} title="Limpiar"
                      className="py-3 rounded-lg bg-gray-50 hover:bg-gray-200 text-gray-500 font-bold disabled:opacity-40">C</button>
                  </div>

                  {/* ── Paso 2: dedo ── */}
                  <button
                    onClick={marcar} disabled={trabajando || !dniListo}
                    className="w-full py-4 rounded-xl font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-3">
                    {trabajando ? <Loader2 className="w-5 h-5 animate-spin" /> : <Fingerprint className="w-5 h-5" />}
                    <span>
                      {paso === PASOS.BUSCANDO    && 'Buscando el DNI...'}
                      {paso === PASOS.CAPTURANDO  && 'Apoyá el dedo en el lector...'}
                      {paso === PASOS.VERIFICANDO && 'Verificando la huella...'}
                      {paso === PASOS.PROCESANDO  && 'Registrando...'}
                      {!trabajando && 'Verificar huella'}
                    </span>
                  </button>

                  {paso === PASOS.CAPTURANDO && (
                    <p className="text-center text-sm text-gray-500 animate-pulse">
                      Apoyá el dedo bien centrado (hasta {Math.round(CAPTURE_TIMEOUT / 1000)}s)
                    </p>
                  )}

                  {paso === PASOS.ERROR && (
                    <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 p-3">
                      <XCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                      <p className="text-sm text-red-700">{mensaje}</p>
                    </div>
                  )}

                  {paso !== PASOS.ERROR && !trabajando && (
                    <p className="text-center text-xs text-gray-400">
                      El sistema decide solo si es entrada o salida, con el rol del empleado.
                    </p>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default IdentificacionBiometrica

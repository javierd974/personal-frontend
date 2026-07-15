import React, { useState, useEffect } from 'react'
import { UserCheck, RefreshCw, AlertTriangle, ArrowLeft, Loader2, CreditCard } from 'lucide-react'
import Modal from '../common/Modal'
import { altasService } from '../../services/altasService'
import { rolesService, localesService } from '../../services/catalogosService'

const SEXO = ['Masculino', 'Femenino', 'Otro', 'Prefiero no decir']
const ESTADO_CIVIL = ['Soltero/a', 'Casado/a', 'Divorciado/a', 'Viudo/a', 'Unión Convivencial']
const TIPO_CONTRATO = ['Permanente', 'Temporal', 'Pasantía', 'Contrato']
const TIPO_CUENTA = ['Caja de Ahorro', 'Cuenta Corriente']
const TURNOS = [{ v: 'TM', l: 'Mañana (TM)' }, { v: 'TN', l: 'Noche (TN)' }]

const hoy = () => new Date().toISOString().split('T')[0]

const formInicial = (alta, localId) => ({
  nombre: alta?.nombre || '',
  apellido: alta?.apellido || '',
  documento: alta?.dni || '',
  cuil: '',
  fecha_nacimiento: '',
  lugar_nacimiento: '',
  nacionalidad: 'Argentina',
  sexo: '',
  estado_civil: '',
  telefono: '',
  email: '',
  direccion: '',
  ciudad: '',
  provincia: '',
  codigo_postal: '',
  rol_id: '',
  local_origen_id: localId || '',
  turno: '',
  fecha_ingreso: hoy(),
  tipo_contrato: '',
  categoria: '',
  salario: '',
  obra_social: '',
  numero_afiliado: '',
  banco: '',
  tipo_cuenta: '',
  cbu: '',
  alias: '',
  contacto_emergencia_nombre: '',
  contacto_emergencia_telefono: '',
  contacto_emergencia_relacion: '',
  observaciones_legajo: ''
})

const Field = ({ label, children, required }) => (
  <div>
    <span className="label">{label}{required && <span className="text-red-500"> *</span>}</span>
    {children}
  </div>
)

const AltaEmpleadoModal = ({ isOpen, onClose, localId, onSuccess, onAlert }) => {
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [altas, setAltas] = useState([])
  const [seleccion, setSeleccion] = useState(null)   // alta elegida
  const [form, setForm] = useState(formInicial(null, localId))
  const [roles, setRoles] = useState([])
  const [locales, setLocales] = useState([])
  const [error, setError] = useState(null)

  useEffect(() => {
    if (isOpen) {
      setSeleccion(null)
      setError(null)
      cargarAltas()
      cargarCatalogos()
    }
  }, [isOpen])

  const cargarAltas = async () => {
    setLoading(true)
    const res = await altasService.listarAltasAutorizadas()
    if (res.success) setAltas(res.data)
    else setError(res.error)
    setLoading(false)
  }

  const cargarCatalogos = async () => {
    const [r, l] = await Promise.all([rolesService.getRoles(), localesService.getLocalesUsuario()])
    if (r.success) setRoles(r.data)
    if (l.success) setLocales(l.data)
  }

  const elegir = (alta) => {
    if (alta.lista_negra || (alta.ya_existe && alta.activo)) return
    setSeleccion(alta)
    setForm(formInicial(alta, localId))
    setError(null)
  }

  const set = (campo, valor) => setForm(prev => ({ ...prev, [campo]: valor }))

  const guardar = async () => {
    setError(null)
    if (!form.rol_id) { setError('Seleccioná el puesto (rol).'); return }
    setSaving(true)
    const res = await altasService.cargarEmpleadoAutorizado(seleccion.solicitud_id, form)
    setSaving(false)
    if (!res.success) { setError(res.error); return }
    onAlert && onAlert({ type: 'success', message: `Empleado ${form.nombre} ${form.apellido} cargado correctamente.` })
    onSuccess && onSuccess()
    onClose()
  }

  // ─── PASO 1: elegir DNI autorizado ───────────────────────────────
  const renderLista = () => (
    <div className="space-y-3">
      <p className="text-sm text-gray-600">
        Seleccioná el DNI autorizado por administración para cargar la persona en el sistema.
      </p>
      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
      ) : altas.length === 0 ? (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center text-gray-500 text-sm">
          No hay altas autorizadas pendientes. Administración debe aprobar primero la solicitud de empleado nuevo.
        </div>
      ) : (
        altas.map((a) => {
          const bloqueado = a.lista_negra || (a.ya_existe && a.activo)
          return (
            <button
              key={a.solicitud_id}
              onClick={() => elegir(a)}
              disabled={bloqueado}
              className={`w-full flex items-center gap-4 p-4 border-2 rounded-xl text-left transition-all ${
                bloqueado ? 'border-gray-200 bg-gray-50 opacity-70 cursor-not-allowed'
                          : 'border-gray-200 hover:border-primary hover:bg-primary/5'}`}
            >
              <div className="w-11 h-11 bg-primary/10 rounded-xl flex items-center justify-center flex-shrink-0">
                <CreditCard className="w-6 h-6 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-dark truncate">{a.nombre} {a.apellido}</p>
                <p className="text-sm text-gray-500">DNI {a.dni}</p>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {a.es_reactivacion && <span className="badge badge-warning text-xs"><RefreshCw className="w-3 h-3 mr-1" />Reactivación</span>}
                  {a.lista_negra && <span className="badge badge-error text-xs"><AlertTriangle className="w-3 h-3 mr-1" />Lista negra</span>}
                  {a.ya_existe && a.activo && <span className="badge badge-error text-xs">Ya activo</span>}
                  {a.ya_existe && !a.activo && !a.lista_negra && <span className="badge badge-info text-xs">Legajo inactivo</span>}
                </div>
              </div>
            </button>
          )
        })
      )}
    </div>
  )

  const Seccion = ({ titulo }) => (
    <h4 className="text-sm font-bold text-primary uppercase tracking-wide mt-2 mb-1 pb-1 border-b border-gray-100">{titulo}</h4>
  )

  // ─── PASO 2: formulario de carga ─────────────────────────────────
  const renderForm = () => (
    <div className="space-y-4">
      <button onClick={() => setSeleccion(null)} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-primary">
        <ArrowLeft className="w-4 h-4" /> Volver a la lista
      </button>

      <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 flex items-center gap-2">
        <UserCheck className="w-5 h-5 text-primary flex-shrink-0" />
        <p className="text-sm text-dark">
          {seleccion.es_reactivacion || (seleccion.ya_existe && !seleccion.activo)
            ? <>Reactivando legajo — DNI <b>{seleccion.dni}</b> (autorizado por administración).</>
            : <>DNI <b>{seleccion.dni}</b> autorizado por administración. El documento no puede modificarse.</>}
        </p>
      </div>

      <Seccion titulo="Datos personales" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Field label="Nombre" required><input className="input-field" value={form.nombre} onChange={e => set('nombre', e.target.value)} /></Field>
        <Field label="Apellido" required><input className="input-field" value={form.apellido} onChange={e => set('apellido', e.target.value)} /></Field>
        <Field label="DNI (autorizado)"><input className="input-field bg-gray-100 cursor-not-allowed" value={form.documento} readOnly /></Field>
        <Field label="CUIL"><input className="input-field" value={form.cuil} onChange={e => set('cuil', e.target.value)} placeholder="20-12345678-9" /></Field>
        <Field label="Fecha de nacimiento"><input type="date" className="input-field" value={form.fecha_nacimiento} onChange={e => set('fecha_nacimiento', e.target.value)} /></Field>
        <Field label="Sexo">
          <select className="select-field" value={form.sexo} onChange={e => set('sexo', e.target.value)}>
            <option value="">—</option>{SEXO.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </Field>
        <Field label="Estado civil">
          <select className="select-field" value={form.estado_civil} onChange={e => set('estado_civil', e.target.value)}>
            <option value="">—</option>{ESTADO_CIVIL.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </Field>
        <Field label="Nacionalidad"><input className="input-field" value={form.nacionalidad} onChange={e => set('nacionalidad', e.target.value)} /></Field>
        <Field label="Lugar de nacimiento"><input className="input-field" value={form.lugar_nacimiento} onChange={e => set('lugar_nacimiento', e.target.value)} /></Field>
      </div>

      <Seccion titulo="Contacto y domicilio" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Field label="Teléfono"><input className="input-field" value={form.telefono} onChange={e => set('telefono', e.target.value)} /></Field>
        <Field label="Email"><input type="email" className="input-field" value={form.email} onChange={e => set('email', e.target.value)} /></Field>
        <Field label="Dirección"><input className="input-field" value={form.direccion} onChange={e => set('direccion', e.target.value)} /></Field>
        <Field label="Ciudad"><input className="input-field" value={form.ciudad} onChange={e => set('ciudad', e.target.value)} /></Field>
        <Field label="Provincia"><input className="input-field" value={form.provincia} onChange={e => set('provincia', e.target.value)} /></Field>
        <Field label="Código postal"><input className="input-field" value={form.codigo_postal} onChange={e => set('codigo_postal', e.target.value)} /></Field>
      </div>

      <Seccion titulo="Datos laborales" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Field label="Puesto (rol)" required>
          <select className="select-field" value={form.rol_id} onChange={e => set('rol_id', e.target.value)}>
            <option value="">Seleccionar…</option>{roles.map(r => <option key={r.id} value={r.id}>{r.nombre}</option>)}
          </select>
        </Field>
        <Field label="Local de origen">
          <select className="select-field" value={form.local_origen_id} onChange={e => set('local_origen_id', e.target.value)}>
            <option value="">—</option>{locales.map(l => <option key={l.id} value={l.id}>{l.nombre}</option>)}
          </select>
        </Field>
        <Field label="Turno">
          <select className="select-field" value={form.turno} onChange={e => set('turno', e.target.value)}>
            <option value="">—</option>{TURNOS.map(t => <option key={t.v} value={t.v}>{t.l}</option>)}
          </select>
        </Field>
        <Field label="Fecha de ingreso"><input type="date" className="input-field" value={form.fecha_ingreso} onChange={e => set('fecha_ingreso', e.target.value)} /></Field>
        <Field label="Tipo de contrato">
          <select className="select-field" value={form.tipo_contrato} onChange={e => set('tipo_contrato', e.target.value)}>
            <option value="">—</option>{TIPO_CONTRATO.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </Field>
        <Field label="Categoría"><input className="input-field" value={form.categoria} onChange={e => set('categoria', e.target.value)} /></Field>
        <Field label="Salario"><input type="number" className="input-field" value={form.salario} onChange={e => set('salario', e.target.value)} /></Field>
      </div>

      <Seccion titulo="Obra social y datos bancarios" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Field label="Obra social"><input className="input-field" value={form.obra_social} onChange={e => set('obra_social', e.target.value)} /></Field>
        <Field label="N° de afiliado"><input className="input-field" value={form.numero_afiliado} onChange={e => set('numero_afiliado', e.target.value)} /></Field>
        <Field label="Banco"><input className="input-field" value={form.banco} onChange={e => set('banco', e.target.value)} /></Field>
        <Field label="Tipo de cuenta">
          <select className="select-field" value={form.tipo_cuenta} onChange={e => set('tipo_cuenta', e.target.value)}>
            <option value="">—</option>{TIPO_CUENTA.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </Field>
        <Field label="CBU"><input className="input-field" value={form.cbu} onChange={e => set('cbu', e.target.value)} /></Field>
        <Field label="Alias"><input className="input-field" value={form.alias} onChange={e => set('alias', e.target.value)} /></Field>
      </div>

      <Seccion titulo="Contacto de emergencia" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Field label="Nombre"><input className="input-field" value={form.contacto_emergencia_nombre} onChange={e => set('contacto_emergencia_nombre', e.target.value)} /></Field>
        <Field label="Teléfono"><input className="input-field" value={form.contacto_emergencia_telefono} onChange={e => set('contacto_emergencia_telefono', e.target.value)} /></Field>
        <Field label="Relación"><input className="input-field" value={form.contacto_emergencia_relacion} onChange={e => set('contacto_emergencia_relacion', e.target.value)} /></Field>
      </div>

      <Field label="Observaciones del legajo">
        <textarea className="input-field" rows={2} value={form.observaciones_legajo} onChange={e => set('observaciones_legajo', e.target.value)} />
      </Field>

      {error && <div className="alert alert-error text-sm">{error}</div>}

      <div className="flex gap-3 pt-2">
        <button onClick={() => setSeleccion(null)} className="btn-outline flex-1">Cancelar</button>
        <button onClick={guardar} disabled={saving} className="btn-primary flex-1 flex items-center justify-center gap-2">
          {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <UserCheck className="w-5 h-5" />}
          {saving ? 'Guardando…' : 'Cargar empleado'}
        </button>
      </div>
    </div>
  )

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Alta de empleado autorizado" size="lg">
      {error && !seleccion && <div className="alert alert-error text-sm mb-3">{error}</div>}
      {seleccion ? renderForm() : renderLista()}
    </Modal>
  )
}

export default AltaEmpleadoModal

import React, { useState, useEffect, useRef } from 'react'
import { MessageSquare, X } from 'lucide-react'
import { supabase } from '../../services/supabase'
import { comunicadosService } from '../../services/comunicadosService'

/**
 * Maneja la recepcion de comunicados RRHH -> Local en el dashboard del encargado.
 * - Carga los comunicados pendientes del local al montar / cambiar de local.
 * - Se suscribe a Supabase Realtime: los nuevos comunicados aparecen al instante.
 * - Muestra un pop-up centrado por cada comunicado (de a uno, en cola).
 * - Al cerrarlo (boton "Entendido" o X) registra el acuse de recibo:
 *   estado='visto', hora de cierre y usuario logueado en la app de Personal.
 *
 * Props:
 *   - localId: uuid del local actualmente seleccionado.
 *   - usuario: objeto del usuario logueado (tabla usuarios).
 */
const ComunicadosManager = ({ localId, usuario }) => {
  const [cola, setCola] = useState([])
  const [cerrando, setCerrando] = useState(false)
  const colaRef = useRef([])

  // Mantener una ref sincronizada para deduplicar dentro del callback de realtime
  useEffect(() => { colaRef.current = cola }, [cola])

  const nombreUsuario =
    [usuario?.nombre, usuario?.apellido].filter(Boolean).join(' ') ||
    usuario?.email || 'Encargado'

  const encolar = (item) => {
    setCola((prev) =>
      prev.some((c) => c.id === item.id) ? prev : [...prev, item]
    )
  }

  useEffect(() => {
    if (!localId) {
      setCola([])
      return
    }

    let activo = true

    // 1) Carga inicial de pendientes
    ;(async () => {
      const res = await comunicadosService.getPendientes(localId)
      if (activo && res.success) setCola(res.data)
    })()

    // 2) Suscripcion Realtime a nuevos comunicados de este local
    const channel = supabase
      .channel(`comunicados-local-${localId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'comunicados_locales',
          filter: `local_id=eq.${localId}`,
        },
        (payload) => {
          const row = payload.new
          if (!row || row.estado !== 'pendiente') return
          encolar({
            id: row.id,
            mensaje: row.mensaje,
            emisor_nombre: row.emisor_nombre,
            enviado_at: row.enviado_at,
          })
        }
      )
      .subscribe()

    return () => {
      activo = false
      supabase.removeChannel(channel)
    }
  }, [localId])

  const actual = cola[0] || null

  const handleCerrar = async () => {
    if (!actual || cerrando) return
    setCerrando(true)
    // Registrar acuse de recibo (no bloqueamos el cierre visual si falla)
    await comunicadosService.marcarVisto(actual.id, {
      usuarioId: usuario?.id,
      usuarioNombre: nombreUsuario,
    })
    setCola((prev) => prev.slice(1))
    setCerrando(false)
  }

  if (!actual) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-[fadeIn_0.2s_ease-out]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4" style={{ backgroundColor: '#0B9FD9' }}>
          <div className="flex items-center gap-2 text-white">
            <MessageSquare className="w-5 h-5" />
            <span className="font-semibold">Comunicado de RRHH</span>
          </div>
          <button
            onClick={handleCerrar}
            disabled={cerrando}
            className="text-white/80 hover:text-white disabled:opacity-50"
            title="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Cuerpo */}
        <div className="px-6 py-5">
          <p className="text-gray-800 whitespace-pre-wrap break-words leading-relaxed">
            {actual.mensaje}
          </p>
          <p className="text-xs text-gray-400 mt-4">
            Enviado por {actual.emisor_nombre || 'RRHH'}
          </p>
          {cola.length > 1 && (
            <p className="text-xs text-gray-400 mt-1">
              + {cola.length - 1} comunicado(s) más por leer
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 pb-5">
          <button
            onClick={handleCerrar}
            disabled={cerrando}
            className="w-full py-2.5 rounded-lg text-white font-medium transition-colors disabled:opacity-50"
            style={{ backgroundColor: '#F59120' }}
          >
            {cerrando ? 'Registrando…' : 'Entendido'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default ComunicadosManager

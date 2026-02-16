import { supabase, handleSupabaseError, getCurrentUser } from './supabase'
import { format } from 'date-fns'
import { registrosService } from './registrosService'
import { valesService, ausenciasService } from './catalogosService'

export const reporteEstadoService = {
  // Generar número único de reporte
  async generarNumeroReporte(localId) {
    try {
      const hoy = format(new Date(), 'yyyy-MM-dd')
      
      // Obtener el último reporte del día
      const { data, error } = await supabase
        .from('reportes_estado')
        .select('numero_reporte')
        .eq('local_id', localId)
        .eq('fecha', hoy)
        .order('numero_reporte', { ascending: false })
        .limit(1)
        .maybeSingle()
      
      if (error && error.code !== 'PGRST116') throw error
      
      let numeroSecuencial = 1
      if (data) {
        // Extraer el número secuencial del último reporte
        const partes = data.numero_reporte.split('-')
        numeroSecuencial = parseInt(partes[partes.length - 1]) + 1
      }
      
      // Formato: LOCAL-YYYYMMDD-NNN
      // Ejemplo: LOC1-20260214-001
      const fechaFormato = format(new Date(), 'yyyyMMdd')
      const numeroFormateado = numeroSecuencial.toString().padStart(3, '0')
      const localAbrev = `LOC${localId.substring(0, 4)}`
      
      return `${localAbrev}-${fechaFormato}-${numeroFormateado}`
    } catch (error) {
      console.error('Error al generar número de reporte:', error)
      // Fallback
      return `REP-${Date.now()}`
    }
  },

  // Generar datos del reporte de estado
  async generarDatosReporte(localId, observaciones = '') {
    try {
      const fechaActual = format(new Date(), 'yyyy-MM-dd')
      const horaActual = format(new Date(), 'HH:mm')
      
      // Obtener empleados en turno
      const turnoResult = await registrosService.getEmpleadosEnTurno(localId)
      if (!turnoResult.success) throw new Error(turnoResult.error)
      
      // Obtener todos los registros del día
      const registrosResult = await registrosService.getRegistrosDelDia(localId)
      if (!registrosResult.success) throw new Error(registrosResult.error)
      
      // Obtener vales del día
      const valesResult = await valesService.getValesDelDia(localId)
      if (!valesResult.success) throw new Error(valesResult.error)
      
      // Calcular total de vales
      const totalVales = valesResult.data.reduce((sum, vale) => {
        const importeCentavos = Math.round(parseFloat(vale.importe) * 100)
        return sum + importeCentavos
      }, 0) / 100
      
      // Obtener ausencias del día
      const ausenciasResult = await ausenciasService.getAusenciasDelDia(localId)
      if (!ausenciasResult.success) throw new Error(ausenciasResult.error)
      
      const reporte = {
        fecha: fechaActual,
        hora: horaActual,
        empleadosEnTurno: turnoResult.data.map(emp => ({
          empleado: `${emp.empleado.nombre} ${emp.empleado.apellido}`,
          documento: emp.empleado.documento,
          rol: emp.rol.nombre,
          horaEntrada: emp.hora_entrada
        })),
        registrosDelDia: registrosResult.data.map(registro => ({
          empleado: `${registro.empleado.nombre} ${registro.empleado.apellido}`,
          documento: registro.empleado.documento,
          rol: registro.rol.nombre,
          horaEntrada: registro.hora_entrada,
          horaSalida: registro.hora_salida || 'EN TURNO'
        })),
        vales: valesResult.data.map(vale => ({
          empleado: `${vale.empleado.nombre} ${vale.empleado.apellido}`,
          importe: parseFloat(vale.importe),
          motivo: vale.motivo?.motivo || vale.concepto,
          concepto: vale.concepto
        })),
        totalVales: totalVales,
        cantidadVales: valesResult.data.length,
        ausencias: ausenciasResult.data.map(ausencia => ({
          empleado: `${ausencia.empleado.nombre} ${ausencia.empleado.apellido}`,
          motivo: ausencia.motivo.motivo,
          observaciones: ausencia.observaciones
        })),
        cantidadAusencias: ausenciasResult.data.length,
        personalActivo: turnoResult.data.length,
        totalRegistrosDelDia: registrosResult.data.length,
        observaciones: observaciones
      }
      
      return { success: true, data: reporte }
    } catch (error) {
      return { success: false, error: error.message || handleSupabaseError(error) }
    }
  },

  // Guardar reporte de estado
  async guardarReporte(localId, observaciones = '') {
    try {
      const user = await getCurrentUser()
      
      // Generar número de reporte
      const numeroReporte = await this.generarNumeroReporte(localId)
      
      // Generar datos del reporte
      const reporteResult = await this.generarDatosReporte(localId, observaciones)
      if (!reporteResult.success) throw new Error(reporteResult.error)
      
      // Guardar reporte
      const { data, error } = await supabase
        .from('reportes_estado')
        .insert({
          local_id: localId,
          numero_reporte: numeroReporte,
          fecha: reporteResult.data.fecha,
          hora: reporteResult.data.hora,
          total_vales: reporteResult.data.totalVales,
          observaciones: observaciones,
          generado_por: user.id,
          reporte_json: reporteResult.data
        })
        .select(`
          *,
          local:locales(nombre),
          usuario:usuarios(nombre, apellido)
        `)
        .single()
      
      if (error) throw error
      
      return { success: true, data }
    } catch (error) {
      return { success: false, error: handleSupabaseError(error) }
    }
  },

  // Obtener reportes de estado
  async getReportes(localId, desde = null, hasta = null) {
    try {
      let query = supabase
        .from('reportes_estado')
        .select(`
          *,
          local:locales(nombre),
          usuario:usuarios(nombre, apellido)
        `)
        .eq('local_id', localId)
      
      if (desde) {
        query = query.gte('fecha', desde)
      }
      
      if (hasta) {
        query = query.lte('fecha', hasta)
      }
      
      query = query.order('created_at', { ascending: false })
      
      const { data, error } = await query
      
      if (error) throw error
      
      return { success: true, data }
    } catch (error) {
      return { success: false, error: handleSupabaseError(error) }
    }
  },

  // Obtener un reporte específico
  async getReporteById(reporteId) {
    try {
      const { data, error } = await supabase
        .from('reportes_estado')
        .select(`
          *,
          local:locales(nombre, direccion),
          usuario:usuarios(nombre, apellido, email)
        `)
        .eq('id', reporteId)
        .single()
      
      if (error) throw error
      
      return { success: true, data }
    } catch (error) {
      return { success: false, error: handleSupabaseError(error) }
    }
  },

  // Generar contenido para impresión en 80mm
  generarContenidoImpresion(reporte, localNombre) {
    const ancho = 42 // Caracteres para 72mm en papel de 80mm
    
    // Función para centrar texto
    const centrar = (texto) => {
      const espacios = Math.max(0, Math.floor((ancho - texto.length) / 2))
      return ' '.repeat(espacios) + texto
    }
    
    // Función para línea separadora
    const linea = (char = '-') => char.repeat(ancho)
    
    // Función para formatear precio sin decimales
    const formatoPrecio = (valor) => {
      return `$${Math.round(valor).toLocaleString('es-AR')}`
    }
    
    const datos = reporte.reporte_json || reporte
    
    let contenido = `
${centrar('═══════════════════════════════════')}
${centrar('REPORTE DE ESTADO')}
${centrar('SmartDom')}
${centrar('═══════════════════════════════════')}

${centrar(localNombre.toUpperCase())}
N° REPORTE: ${reporte.numero_reporte}
${centrar(format(new Date(datos.fecha), "dd/MM/yyyy"))}
${centrar(`Hora: ${datos.hora}`)}

${linea('=')}

PERSONAL EN TURNO
${linea()}
Total activos: ${datos.personalActivo}

${datos.empleadosEnTurno.length > 0 ? datos.empleadosEnTurno.map((emp, i) => {
  const entrada = emp.horaEntrada.includes('T') ? 
    format(new Date(emp.horaEntrada), 'HH:mm') : 
    emp.horaEntrada.substring(0, 5)
  
  return `${i + 1}. ${emp.empleado}
   ${emp.rol}
   Entrada: ${entrada} | Doc: ${emp.documento}`
}).join('\n\n') : 'Sin personal en turno'}

${linea('=')}

REGISTROS DEL DÍA
${linea()}
Total registros: ${datos.totalRegistrosDelDia}

${datos.registrosDelDia.map((r, i) => {
  const entrada = r.horaEntrada.includes('T') ? 
    format(new Date(r.horaEntrada), 'HH:mm') : 
    r.horaEntrada.substring(0, 5)
  const salida = r.horaSalida === 'EN TURNO' ? 
    'EN TURNO' : 
    r.horaSalida.includes('T') ? 
      format(new Date(r.horaSalida), 'HH:mm') : 
      r.horaSalida.substring(0, 5)
  
  return `${i + 1}. ${r.empleado}
   ${r.rol}
   E: ${entrada} | S: ${salida}`
}).join('\n\n')}

${linea('=')}

VALES DE CAJA
${linea()}
Cantidad: ${datos.cantidadVales}
TOTAL: ${formatoPrecio(datos.totalVales)}

${datos.vales.length > 0 ? datos.vales.map((v, i) => {
  return `${i + 1}. ${v.empleado}
   ${formatoPrecio(v.importe)} - ${v.motivo || v.concepto}`
}).join('\n\n') : 'Sin vales registrados'}

${linea('=')}

AUSENCIAS
${linea()}
Total: ${datos.cantidadAusencias}

${datos.ausencias.length > 0 ? datos.ausencias.map((a, i) => {
  return `${i + 1}. ${a.empleado}
   ${a.motivo}${a.observaciones ? `
   Obs: ${a.observaciones}` : ''}`
}).join('\n\n') : 'Sin ausencias registradas'}

${linea('=')}

OBSERVACIONES
${linea()}
${datos.observaciones || 'Sin observaciones'}

${linea('=')}

Generado por: ${reporte.usuario?.nombre} ${reporte.usuario?.apellido}
Fecha: ${format(new Date(reporte.created_at), 'dd/MM/yyyy HH:mm')}

${centrar('─────────────────────────')}
${centrar('Desarrollado por SmartDom')}
${centrar('smartdom.io')}
${centrar('─────────────────────────')}


`
    return contenido
  }
}

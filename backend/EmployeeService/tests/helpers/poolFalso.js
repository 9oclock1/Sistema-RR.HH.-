const TIPOS_MEMORANDUM = {
  1: { id_tipo_memo: 1, clasificacion: 'DISCIPLINARIO', nombre: 'Llamada de atención' },
};

const EMPLEADOS = {
  'e0000000-0000-4000-8000-000000000001': {
    nombre: 'José Ángel Peñaranda Núñez',
    documento: '7894561-1A',
    cargo: 'Cajero de sucursal',
    sucursal: 'Sucursal Sopocachi',
    ciudad: 'La Paz',
  },
  'e0000000-0000-4000-8000-000000000002': {
    nombre: 'María Fernanda Quispe',
    documento: '4567890',
    cargo: 'Supervisor de sucursal',
    sucursal: 'Sucursal Sopocachi',
    ciudad: 'La Paz',
  },
  'e0000000-0000-4000-8000-000000000003': {
    nombre: 'Luis Alberto Mamani Flores',
    documento: '6123450',
    cargo: 'Reponedor',
    sucursal: 'Sucursal Miraflores',
    ciudad: 'La Paz',
  },
};

const errorPg = (code, mensaje, detail) => Object.assign(new Error(mensaje), { code, detail });

const llaveForanea = (campo, valor, tabla) =>
  errorPg(
    '23503',
    'insert or update on table "memorandums" violates foreign key constraint',
    `Key (${campo})=(${valor}) is not present in table "${tabla}".`
  );

const restarMeses = (fecha, meses) => {
  const [anio, mes, dia] = fecha.split('-').map(Number);
  return new Date(Date.UTC(anio, mes - 1 - meses, dia)).toISOString().slice(0, 10);
};

const crearPoolFalso = () => {
  let estado;

  const reiniciar = ({
    tipos = TIPOS_MEMORANDUM,
    empleados = EMPLEADOS,
    hoy = '2026-10-10',
    ultimoNumero = 0,
    contadores = {},
    memorandums = [],
    errorAlGuardarPdf = null,
  } = {}) => {
    estado = {
      tipos,
      empleados,
      hoy,
      contadores: { [Number(hoy.slice(0, 4))]: ultimoNumero, ...contadores },
      memorandums: memorandums.map((fila) => ({ ...fila })),
      errorAlGuardarPdf,
      respaldo: null,
      consultas: [],
      conexiones: 0,
      liberaciones: 0,
    };
  };

  const contarRecientes = ([idReceptor, meses]) => {
    const desde = restarMeses(estado.hoy, Number(meses));
    return estado.memorandums.filter(
      (fila) =>
        fila.id_empleado_receptor === idReceptor &&
        fila.estado_sancion !== 'ANULADO' &&
        fila.fecha_emision >= desde
    ).length;
  };

  const siguienteCorrelativo = ([gestion]) => {
    estado.contadores[gestion] = (estado.contadores[gestion] ?? 0) + 1;
    return estado.contadores[gestion];
  };

  const insertarMemorandum = (params) => {
    const [
      id_memorandum,
      id_empleado_receptor,
      id_tipo_memo,
      id_empleado_emisor,
      codigo_cite,
      asunto,
      contenido_descripcion,
      fecha_emision,
      gestion,
      numero_correlativo,
      naturaleza_falta,
      gravedad_falta,
      evidencia_adjunto_url,
    ] = params;

    if (!estado.empleados[id_empleado_receptor]) throw llaveForanea('id_empleado_receptor', id_empleado_receptor, 'empleados');
    if (!estado.empleados[id_empleado_emisor]) throw llaveForanea('id_empleado_emisor', id_empleado_emisor, 'empleados');
    if (!estado.tipos[id_tipo_memo]) throw llaveForanea('id_tipo_memo', id_tipo_memo, 'tipos_memorandum');
    if (estado.memorandums.some((fila) => fila.gestion === gestion && fila.numero_correlativo === numero_correlativo)) {
      throw errorPg(
        '23505',
        'duplicate key value violates unique constraint "uq_memorandum_correlativo"',
        `Key (gestion, numero_correlativo)=(${gestion}, ${numero_correlativo}) already exists.`
      );
    }

    const fila = {
      id_memorandum,
      id_empleado_receptor,
      id_tipo_memo,
      id_empleado_emisor,
      codigo_cite,
      asunto,
      contenido_descripcion,
      fecha_emision,
      gestion,
      numero_correlativo,
      naturaleza_falta,
      gravedad_falta,
      estado_sancion: 'BORRADOR',
      evidencia_adjunto_url,
      documento_pdf_url: null,
    };
    estado.memorandums.push(fila);
    return { ...fila };
  };

  const obtenerParaDocumento = ([idMemorandum]) => {
    const fila = estado.memorandums.find((memo) => memo.id_memorandum === idMemorandum);
    if (!fila) return null;

    const receptor = estado.empleados[fila.id_empleado_receptor];
    const emisor = estado.empleados[fila.id_empleado_emisor];
    return {
      codigo_cite: fila.codigo_cite,
      asunto: fila.asunto,
      contenido_descripcion: fila.contenido_descripcion,
      fecha_emision: fila.fecha_emision,
      naturaleza_falta: fila.naturaleza_falta,
      gravedad_falta: fila.gravedad_falta,
      evidencia_adjunto_url: fila.evidencia_adjunto_url,
      tipo_nombre: estado.tipos[fila.id_tipo_memo].nombre,
      receptor_nombre: receptor.nombre,
      receptor_documento: receptor.documento,
      receptor_cargo: receptor.cargo,
      receptor_sucursal: receptor.sucursal,
      receptor_ciudad: receptor.ciudad,
      emisor_nombre: emisor.nombre,
      emisor_cargo: emisor.cargo,
    };
  };

  const guardarRutaPdf = ([rutaPdf, idMemorandum]) => {
    if (estado.errorAlGuardarPdf) throw estado.errorAlGuardarPdf;

    const fila = estado.memorandums.find((memo) => memo.id_memorandum === idMemorandum);
    if (!fila) return null;
    fila.documento_pdf_url = rutaPdf;
    return { ...fila };
  };

  const filas = (fila) => ({ rows: fila ? [fila] : [] });

  const query = async (sql, params = []) => {
    const texto = sql.replace(/\s+/g, ' ').trim();
    estado.consultas.push(texto);

    if (texto === 'BEGIN') {
      estado.respaldo = { contadores: { ...estado.contadores }, cantidad: estado.memorandums.length };
      return { rows: [] };
    }
    if (texto === 'COMMIT') return { rows: [] };
    if (texto === 'ROLLBACK') {
      estado.contadores = estado.respaldo.contadores;
      estado.memorandums.length = estado.respaldo.cantidad;
      return { rows: [] };
    }
    if (/SELECT CURRENT_DATE/i.test(texto)) return filas({ hoy: estado.hoy });
    if (/SELECT COUNT\(\*\)::int AS total FROM memorandums/i.test(texto)) return filas({ total: contarRecientes(params) });
    if (/INSERT INTO correlativos_memorandum/i.test(texto)) return filas({ ultimo_numero: siguienteCorrelativo(params) });
    if (/INSERT INTO memorandums/i.test(texto)) return filas(insertarMemorandum(params));
    if (/FROM memorandums m JOIN tipos_memorandum/i.test(texto)) return filas(obtenerParaDocumento(params));
    if (/UPDATE memorandums SET documento_pdf_url/i.test(texto)) return filas(guardarRutaPdf(params));

    throw new Error(`Consulta no prevista en el pool falso: ${texto}`);
  };

  const connect = async () => {
    estado.conexiones += 1;
    return {
      query,
      release: () => {
        estado.liberaciones += 1;
      },
    };
  };

  reiniciar();

  return {
    query,
    connect,
    on: () => {},
    reiniciar,
    get consultas() {
      return estado.consultas;
    },
    get memorandums() {
      return estado.memorandums;
    },
    get conexiones() {
      return estado.conexiones;
    },
    get liberaciones() {
      return estado.liberaciones;
    },
    huboConsulta: (patron) => estado.consultas.some((consulta) => patron.test(consulta)),
    posicionDe: (patron) => estado.consultas.findIndex((consulta) => patron.test(consulta)),
  };
};

module.exports = { crearPoolFalso, TIPOS_MEMORANDUM, EMPLEADOS };

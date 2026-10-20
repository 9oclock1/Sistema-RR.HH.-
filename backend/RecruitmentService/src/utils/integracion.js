const { randomUUID } = require("node:crypto");

const TIPO_EVENTO = {
  ALTA_CONTABILIDAD: "ALTA_COLABORADOR_CONTABILIDAD",
  ALTA_OPERATIVA: "ALTA_COLABORADOR_OPERATIVO",
};
const ESTADO_EVENTO = { PENDIENTE: 1, ENTREGADO: 2, FALLIDO: 3 };

// Códigos de CATALOGOS_DESTINO_INTEGRACION.
const DESTINO = {
  CONTABILIDAD: "CONTABILIDAD",
  MARKETPLACE_POS: "MARKETPLACE_POS",
  INVENTARIOS: "INVENTARIOS",
  ENTREGAS: "ENTREGAS",
};

const ORIGEN = { grupo: "F", modulo: "RRHH" };
const VERSION_ESQUEMA = 1;

// Mismo formato que AttendanceService (KAN-44): el encabezado dice de quién es el mensaje y para quién.
function armarMensaje({ idMensaje, destino, tipo, fecha, datos }) {
  return {
    encabezado: {
      id_mensaje: idMensaje,
      origen: ORIGEN,
      destino: { grupo: destino.grupo, modulo: destino.nombre_modulo },
      tipo,
      fecha,
      version_esquema: VERSION_ESQUEMA,
    },
    datos,
  };
}

// Datos comunes del colaborador contratado. id_empleado queda en null hasta que EmployeeService lo registre;
// mientras tanto los módulos lo identifican por id_postulacion y su número de documento.
function armarColaborador({ postulacion, alta, cargo, usuario }) {
  return {
    id_postulacion: postulacion.id_postulacion,
    id_empleado: alta.id_empleado_generado ?? null,
    colaborador: {
      numero_documento: alta.numero_documento,
      nombres: alta.nombres,
      apellidos: alta.apellidos,
      nombre_completo: `${alta.nombres} ${alta.apellidos}`,
      correo_electronico: alta.correo_electronico,
      telefono_contacto: alta.telefono_contacto,
      ciudad: alta.ciudad,
    },
    cargo: {
      codigo: cargo.codigo,
      nombre: cargo.nombre,
      id_cargo_referencial: alta.id_cargo_referencial,
    },
    id_sucursal: alta.id_sucursal_destino,
    convocatoria: {
      id_convocatoria: alta.id_convocatoria,
      codigo: alta.codigo_convocatoria,
      titulo_puesto: alta.titulo_puesto,
    },
    fecha_contratacion: postulacion.contratado_en,
    contratado_por: { id_usuario: usuario.id, nombre: usuario.nombre },
  };
}

function armarMensajesAlta({
  postulacion,
  alta,
  cargo,
  usuario,
  destinos,
  fecha = new Date().toISOString(),
}) {
  const colaborador = armarColaborador({ postulacion, alta, cargo, usuario });
  const contabilidad = destinos[DESTINO.CONTABILIDAD];
  const operativo = destinos[cargo.codigo_destino];

  return [
    {
      destino: contabilidad,
      tipo: TIPO_EVENTO.ALTA_CONTABILIDAD,
      datos: {
        ...colaborador,
        registro_contable: {
          tipo: "CENTRO_COSTO_BENEFICIARIO",
          centro_costo: { id_sucursal: alta.id_sucursal_destino },
        },
      },
    },
    {
      destino: operativo,
      tipo: TIPO_EVENTO.ALTA_OPERATIVA,
      datos: { ...colaborador, modulo_asignado: operativo.codigo },
    },
  ].map(({ destino, tipo, datos }) => {
    const idMensaje = randomUUID();
    return {
      idMensaje,
      destino,
      tipo,
      carga: armarMensaje({ idMensaje, destino, tipo, fecha, datos }),
    };
  });
}

module.exports = {
  TIPO_EVENTO,
  ESTADO_EVENTO,
  DESTINO,
  ORIGEN,
  armarMensaje,
  armarMensajesAlta,
};

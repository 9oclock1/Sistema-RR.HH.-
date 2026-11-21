const { createHash } = require("node:crypto");
const { ErrorApp } = require("./errores");
const { UUID_RE } = require("./formatos");

const dinero = (valor) => Number(valor).toFixed(2);
const opcional = (valor, digitos) => (valor === null || valor === undefined ? null : Number(valor).toFixed(digitos));

const renglon = (r) => ({
  orden: r.orden,
  codigo: r.codigo,
  nombre: r.nombre,
  forma_calculo: r.forma_calculo,
  base: opcional(r.base, 2),
  cantidad: opcional(r.cantidad, 2),
  valor: Number(r.valor).toFixed(4),
  resultado: dinero(r.resultado),
  detalle: r.detalle ?? null,
});

// Contenido de la boleta con las claves siempre en el mismo orden y los montos como texto con sus decimales:
// así el mismo detalle de planilla produce siempre el mismo hash.
function armarContenido(fila) {
  const renglones = [...fila.renglones].sort((a, b) => a.orden - b.orden);
  const deTipo = (tipo) => renglones.filter((r) => r.tipo === tipo).map(renglon);
  return {
    periodo: fila.periodo,
    empleado: {
      id_empleado: fila.id_empleado,
      nombre_completo: fila.nombre_empleado,
      numero_documento: fila.numero_documento ?? null,
      cargo: fila.cargo ?? null,
      area: fila.area ?? null,
      sucursal: fila.sucursal ?? null,
    },
    contrato: {
      numero_contrato: fila.numero_contrato,
      haber_mensual: dinero(fila.haber_mensual),
    },
    dias: {
      contrato: fila.dias_contrato,
      pagados: fila.dias_pagados,
      faltas_injustificadas: fila.faltas_injustificadas,
      licencia_sin_goce: fila.dias_licencia_sin_goce,
    },
    ingresos: deTipo("INGRESO"),
    descuentos: deTipo("DESCUENTO"),
    aportes: deTipo("APORTE"),
    totales: {
      total_ganado: dinero(fila.total_ganado),
      total_descuentos: dinero(fila.total_descuentos),
      liquido_pagable: dinero(fila.liquido_pagable),
      total_aportes: dinero(fila.total_aportes),
    },
  };
}

const calcularHash = (contenido) => createHash("sha256").update(JSON.stringify(contenido)).digest("hex");

// Quién consulta (temporal: cabeceras X-Empleado-Id y X-Rol hasta contar con autenticación).
function validarIdentidad({ idEmpleado, rol } = {}) {
  if (!idEmpleado) {
    throw new ErrorApp(401, "Identifíquese: elija su usuario de prueba al pie de la barra lateral.");
  }
  if (!UUID_RE.test(idEmpleado)) throw new ErrorApp(401, "El usuario indicado no es válido.");
  return { idEmpleado: idEmpleado.toLowerCase(), rol: (rol ?? "").trim().toLowerCase() };
}

// Criterio 3: cada colaborador ve solo sus boletas; el Administrador de RRHH puede ver las de cualquiera.
const puedeVer = ({ idEmpleado, rol }, boleta) =>
  rol === "admin" || String(boleta.id_empleado).toLowerCase() === idEmpleado;

module.exports = { armarContenido, calcularHash, validarIdentidad, puedeVer };

const { aCentavos } = require("./calculo");
const { deCentavos } = require("./tributario");

const TIPO_APORTE = { DESCUENTO: "LABORAL", APORTE: "PATRONAL" };

const sumar = (filas, campo) => deCentavos(filas.reduce((total, fila) => total + aCentavos(fila[campo]), 0));

function separarRenglones(renglones) {
  const asignados = [];
  const sinEntidad = new Map();
  for (const renglon of renglones) {
    if (renglon.codigo_entidad) {
      asignados.push({ ...renglon, tipo_aporte: TIPO_APORTE[renglon.tipo] });
      continue;
    }
    const actual = sinEntidad.get(renglon.codigo) ?? { codigo: renglon.codigo, nombre: renglon.nombre, monto: 0 };
    actual.monto += aCentavos(renglon.resultado);
    sinEntidad.set(renglon.codigo, actual);
  }
  const advertencias = [...sinEntidad.values()].map(
    (concepto) =>
      `El concepto ${concepto.codigo} (${concepto.nombre}) no está asociado a ninguna entidad de aporte: ` +
      `sus Bs ${deCentavos(concepto.monto).toFixed(2)} no figuran en los archivos.`
  );
  return { asignados, advertencias };
}

function resumirPorEntidad(detalles, entidades) {
  return entidades.map((entidad) => {
    const propios = detalles.filter((detalle) => detalle.codigo_entidad === entidad.codigo);
    const laborales = propios.filter((detalle) => detalle.tipo === "LABORAL");
    const patronales = propios.filter((detalle) => detalle.tipo === "PATRONAL");
    return {
      codigo: entidad.codigo,
      nombre: entidad.nombre,
      formato_archivo: entidad.formato_archivo,
      empleados: new Set(propios.map((detalle) => detalle.id_empleado)).size,
      total_laboral: sumar(laborales, "monto"),
      total_patronal: sumar(patronales, "monto"),
      total: sumar(propios, "monto"),
    };
  });
}

function resumirTotales(detalles) {
  return {
    cantidad_empleados: new Set(detalles.map((detalle) => detalle.id_empleado)).size,
    total_laboral: sumar(
      detalles.filter((detalle) => detalle.tipo === "LABORAL"),
      "monto"
    ),
    total_patronal: sumar(
      detalles.filter((detalle) => detalle.tipo === "PATRONAL"),
      "monto"
    ),
  };
}

const aDetalle = (renglon) => ({
  id_empleado: renglon.id_empleado,
  nombre_empleado: renglon.nombre_empleado,
  numero_documento: renglon.numero_documento,
  codigo_entidad: renglon.codigo_entidad,
  tipo: renglon.tipo_aporte,
  codigo_concepto: renglon.codigo,
  nombre_concepto: renglon.nombre,
  id_vigencia: renglon.id_vigencia,
  base: renglon.base,
  tasa: renglon.valor,
  monto: renglon.resultado,
});

module.exports = { TIPO_APORTE, separarRenglones, resumirPorEntidad, resumirTotales, aDetalle };

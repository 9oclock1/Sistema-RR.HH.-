const modelo = require("../models/desvinculacionesModel");
const empleadosCliente = require("../clients/empleados.cliente");
const { enTransaccion } = require("../config/transaccion");
const { ErrorApp } = require("../utils/errores");
const { UUID_RE } = require("../utils/formatos");
const {
  validarAdmin,
  validarConsulta,
  identidadRegistro,
  validarFiltros,
  validarDatosDesvinculacion,
  validarFechaRetiro,
} = require("../utils/desvinculaciones");

const noEncontrado = () => new ErrorApp(404, "Proceso de desvinculación no encontrado.");

async function listarCausales(identidad) {
  validarConsulta(identidad);
  return modelo.listarCausalesActivas();
}

async function listar(filtros, identidad) {
  validarConsulta(identidad);
  const limpios = validarFiltros(filtros);
  return modelo.listarProcesos(limpios);
}

async function obtener(id, identidad) {
  validarConsulta(identidad);
  if (!UUID_RE.test(id ?? "")) throw noEncontrado();
  const proceso = await modelo.obtenerProceso(id.toLowerCase());
  if (!proceso) throw noEncontrado();
  return proceso;
}

async function obtenerDocumento(id, identidad) {
  validarAdmin(identidad);
  if (!UUID_RE.test(id ?? "")) throw new ErrorApp(404, "Documento de respaldo no encontrado.");
  const doc = await modelo.obtenerDocumento(id.toLowerCase());
  if (!doc) throw new ErrorApp(404, "Documento de respaldo no encontrado.");
  return doc;
}

// AC1: colaborador activo + causal + fecha de retiro + respaldo -> crea proceso INICIADO y pasa a BAJA en EmployeeService.
// AC2: corresponde_desahucio se copia de la causal (FALSE para renuncia, conclusión o despido legal; TRUE para desahucio).
// AC3: si ya existe un proceso abierto (INICIADO o EN_CURSO), impide registrar otro (validado y protegido por índice único).
async function registrar(datos, archivo, identidad) {
  validarAdmin(identidad);
  const entrada = validarDatosDesvinculacion(datos, archivo);

  const causal = await modelo.obtenerCausalActiva(entrada.codigo_causal);
  if (!causal) {
    throw new ErrorApp(
      400,
      "La causal de desvinculación seleccionada no es válida o no está activa.",
      [{ campo: "codigo_causal", mensaje: "Seleccione una causal válida y activa." }],
      "CAUSAL_INVALIDA"
    );
  }

  const empleado = await empleadosCliente.obtenerEmpleado(entrada.id_empleado);
  if (!empleado) {
    throw new ErrorApp(404, "El colaborador no existe.", [{ campo: "id_empleado", mensaje: "Colaborador no encontrado." }]);
  }
  if (empleado.activo !== true) {
    throw new ErrorApp(
      409,
      "El colaborador ya se encuentra inactivo.",
      [{ campo: "id_empleado", mensaje: "Solo se puede registrar la baja de colaboradores activos." }],
      "COLABORADOR_INACTIVO"
    );
  }

  validarFechaRetiro(entrada.fecha_retiro, empleado.fecha_ingreso);

  const abierto = await modelo.obtenerProcesoAbiertoPorEmpleado(entrada.id_empleado);
  if (abierto) {
    throw new ErrorApp(
      409,
      "El colaborador ya tiene un proceso de liquidación abierto.",
      [{ campo: "id_empleado", mensaje: "Ya existe un proceso de liquidación abierto para este colaborador.", id_proceso: abierto.id_proceso }],
      "PROCESO_ABIERTO"
    );
  }

  const nombreEmpleado = [empleado.nombres, empleado.apellidos].filter(Boolean).join(" ").trim();
  const { registrado_por, registrado_por_rol } = identidadRegistro(identidad);

  return enTransaccion(async (cliente) => {
    let idProceso;
    try {
      idProceso = await modelo.crearProceso(cliente, {
        id_empleado: entrada.id_empleado,
        nombre_empleado: nombreEmpleado,
        fecha_ingreso: empleado.fecha_ingreso || null,
        codigo_causal: causal.codigo,
        fecha_retiro: entrada.fecha_retiro,
        corresponde_desahucio: Boolean(causal.corresponde_desahucio),
        observaciones: entrada.observaciones,
        registrado_por,
        registrado_por_rol,
      });
    } catch (error) {
      if (error?.code === "23505") {
        throw new ErrorApp(
          409,
          "El colaborador ya tiene un proceso de liquidación abierto.",
          [{ campo: "id_empleado", mensaje: "Ya existe un proceso de liquidación abierto para este colaborador." }],
          "PROCESO_ABIERTO"
        );
      }
      throw error;
    }

    await modelo.crearDocumento(cliente, {
      id_proceso: idProceso,
      nombre_archivo: archivo.originalname,
      tipo_mime: archivo.mimetype,
      tamano_bytes: archivo.size ?? archivo.buffer.length,
      contenido: archivo.buffer,
    });

    // Todavía dentro de la transacción: si EmployeeService falla, se revierte todo el proceso.
    await empleadosCliente.darDeBaja(entrada.id_empleado);

    return modelo.obtenerProceso(idProceso, cliente);
  });
}

module.exports = { listarCausales, listar, obtener, obtenerDocumento, registrar };

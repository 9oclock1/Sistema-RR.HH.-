const fs = require("node:fs/promises");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
const modelo = require("../models/quejasModel");
const { enTransaccion } = require("../config/transaccion");
const { consultarEmpleado } = require("./empleadosExternos");
const { ErrorApp } = require("../utils/errores");
const { cifrar, cifrarTexto } = require("../utils/cifrado");
const { generarCodigo } = require("../utils/codigoSeguimiento");
const { limpiarAdjunto } = require("../utils/limpiarAdjunto");
const { ESTADO_QUEJA, ADJUNTOS, validarQueja } = require("../utils/quejas");

const CARPETA_ADJUNTOS = path.resolve(process.env.QUEJAS_DIR || "uploads/quejas");
const INTENTOS_CODIGO = 5;

const listarCategorias = () => modelo.listarCategorias();

async function prepararAdjuntos(archivos, esAnonima) {
  const adjuntos = [];
  for (const [indice, archivo] of archivos.entries()) {
    const limpio = await limpiarAdjunto(archivo);
    if (limpio.length > ADJUNTOS.MAX_BYTES) {
      const mensaje = `«${archivo.originalname}» supera los ${ADJUNTOS.MAX_MB} MB después de procesarlo.`;
      throw new ErrorApp(413, mensaje, [{ campo: "archivos", mensaje }]);
    }
    adjuntos.push({
      orden: indice + 1,
      tipo: archivo.mimetype,
      tamano: limpio.length,
      clave: randomUUID().replaceAll("-", ""),
      contenido: cifrar(limpio),
      nombreOriginal: esAnonima ? null : cifrarTexto(archivo.originalname),
    });
  }
  return adjuntos;
}

async function guardarArchivos(adjuntos) {
  if (!adjuntos.length) return;
  await fs.mkdir(CARPETA_ADJUNTOS, { recursive: true });
  for (const adjunto of adjuntos) {
    await fs.writeFile(path.join(CARPETA_ADJUNTOS, adjunto.clave), adjunto.contenido, { flag: "wx" });
  }
}

const borrarArchivos = (adjuntos) =>
  Promise.all(adjuntos.map((adjunto) => fs.rm(path.join(CARPETA_ADJUNTOS, adjunto.clave), { force: true })));

const esCodigoRepetido = (error) => error.code === "23505" && error.constraint === "uq_queja_codigo_seguimiento";

async function guardarQueja({ datos, idDenunciante, empleado, adjuntos }) {
  for (let intento = 1; ; intento += 1) {
    const codigo = generarCodigo();
    try {
      return await enTransaccion(async (db) => {
        if (idDenunciante) {
          await modelo.sincronizarEmpleado(db, {
            idEmpleado: idDenunciante,
            nombres: empleado.nombres,
            apellidos: empleado.apellidos,
          });
        }
        const queja = await modelo.insertarQueja(db, {
          idEmpleado: idDenunciante,
          idCategoria: datos.idCategoria,
          idEstado: ESTADO_QUEJA.REGISTRADA,
          esAnonima: datos.anonima,
          codigo,
          asunto: cifrarTexto(datos.asunto),
          descripcion: cifrarTexto(datos.descripcion),
        });
        await modelo.insertarHistorialInicial(db, { idQueja: queja.id_queja, idEstado: ESTADO_QUEJA.REGISTRADA });
        for (const adjunto of adjuntos) {
          await modelo.insertarAdjunto(db, { idQueja: queja.id_queja, ...adjunto });
        }
        return { codigo, registradaEn: queja.creado_en };
      });
    } catch (error) {
      if (!esCodigoRepetido(error) || intento >= INTENTOS_CODIGO) throw error;
    }
  }
}

async function registrarQueja({ cuerpo = {}, archivos = [], idEmpleado }) {
  const categorias = await modelo.listarCategorias();
  const datos = validarQueja(cuerpo, new Set(categorias.map((c) => c.id_categoria_queja)));
  const idDenunciante = datos.anonima ? null : idEmpleado;

  const empleado = idDenunciante ? await consultarEmpleado(idDenunciante) : null;
  if (empleado?.estado === "no_existe") {
    throw new ErrorApp(403, "El usuario no corresponde a un empleado registrado.");
  }

  const adjuntos = await prepararAdjuntos(archivos, datos.anonima);
  let resultado;
  try {
    await guardarArchivos(adjuntos);
    resultado = await guardarQueja({ datos, idDenunciante, empleado, adjuntos });
  } catch (error) {
    await borrarArchivos(adjuntos).catch(() => {});
    throw error;
  }

  const estado = await modelo.obtenerEstado(ESTADO_QUEJA.REGISTRADA);
  return {
    codigo_seguimiento: resultado.codigo,
    estado: { codigo: estado.codigo, nombre: estado.nombre },
    registrada_en: resultado.registradaEn,
    adjuntos: adjuntos.length,
    mensaje: "Guarde este código: es la única forma de consultar el avance de su queja.",
  };
}

module.exports = { listarCategorias, registrarQueja };

import { solicitar } from "./cliente";

const RUTA = "/perf/quejas";

export const listarCategoriasQueja = () => solicitar(`${RUTA}/categorias`);

const nombreGenerico = (archivo, indice) => {
  const extension = archivo.name.includes(".") ? archivo.name.split(".").pop().toLowerCase() : "bin";
  return `adjunto-${indice + 1}.${extension}`;
};

export function registrarQueja({ idEmpleado, anonima, idCategoria, asunto, descripcion, archivos = [] }) {
  const formulario = new FormData();
  formulario.append("anonima", anonima ? "true" : "false");
  formulario.append("id_categoria_queja", idCategoria);
  formulario.append("asunto", asunto);
  formulario.append("descripcion", descripcion);
  archivos.forEach((archivo, indice) => {
    if (anonima) formulario.append("archivos", archivo, nombreGenerico(archivo, indice));
    else formulario.append("archivos", archivo);
  });

  return solicitar(RUTA, {
    metodo: "POST",
    cuerpo: formulario,
    cabeceras: anonima ? {} : { "X-Empleado-Id": idEmpleado },
  });
}

export const consultarQueja = (codigo) =>
  solicitar(`${RUTA}/seguimiento`, { metodo: "POST", cuerpo: { codigo } });

import { useCallback, useState } from "react";
import { Users } from "lucide-react";
import { previsualizarAsignaciones } from "../../api/ciclosEvaluacion";
import {
  Alerta,
  Avatar,
  Boton,
  Contador,
  Esqueleto,
  EstadoVacio,
  Paginacion,
  Tabla,
  TextoTruncado,
} from "../../components/ui";
import useRecurso from "../quejas/casos/useRecurso";
import { plural } from "../solicitud-vacaciones/formato";
import { TAMANO_PAGINA, formatearDia, nombreDe } from "./ciclo";

const columnas = [
  {
    clave: "evaluado",
    titulo: "Evaluado",
    ancho: "34%",
    celda: ({ evaluado }) => (
      <div className="cev-celda">
        <TextoTruncado>{nombreDe(evaluado)}</TextoTruncado>
        <span className="cev-sutil">{evaluado.cargo}</span>
      </div>
    ),
  },
  {
    clave: "ubicacion",
    titulo: "Área y sucursal",
    ancho: "28%",
    celda: ({ evaluado }) => <TextoTruncado>{[evaluado.area, evaluado.sucursal].filter(Boolean).join(" · ")}</TextoTruncado>,
  },
  {
    clave: "evaluador",
    titulo: "Evaluador",
    ancho: "38%",
    celda: ({ evaluador }) => (
      <div className="cev-persona">
        <Avatar nombre={nombreDe(evaluador)} decorativo />
        <div className="cev-celda">
          <TextoTruncado>{nombreDe(evaluador)}</TextoTruncado>
          <span className="cev-sutil">{evaluador.cargo}</span>
        </div>
      </div>
    ),
  },
];

// Paso 4: resumen del ciclo y vista previa de las asignaciones que generará el servicio.
// onTotal recibe la cantidad de asignaciones para que el asistente habilite la confirmación.
export default function PasoRevision({ sesion, datos, alcance, version, periodo, onTotal }) {
  const [pagina, setPagina] = useState(1);
  const cargar = useCallback(
    () =>
      previsualizarAsignaciones(sesion, { idVersion: datos.idVersion, alcance }).then((resultado) => {
        onTotal(resultado.total);
        return resultado;
      }),
    [sesion, datos.idVersion, alcance, onTotal],
  );
  const { datos: vista, error, cargando, reintentar } = useRecurso(cargar);

  const resumen = (
    <dl className="cev-datos" aria-label="Resumen del ciclo">
      <div>
        <dt>Ciclo</dt>
        <dd>{datos.nombre.trim()}</dd>
      </div>
      <div>
        <dt>Plantilla</dt>
        <dd>
          {version.plantilla} · versión {version.numero_version}
        </dd>
      </div>
      <div>
        <dt>Periodo</dt>
        <dd>{periodo.nombre}</dd>
      </div>
      <div>
        <dt>Plazo</dt>
        <dd>
          {formatearDia(datos.fechaInicio)} – {formatearDia(datos.fechaLimite)}
        </dd>
      </div>
    </dl>
  );

  if (error) {
    return (
      <div className="cev-campos">
        {resumen}
        <Alerta
          tono="peligro"
          role="alert"
          titulo="No se pudieron calcular las asignaciones"
          acciones={
            <Boton tamano="sm" onClick={reintentar}>
              Reintentar
            </Boton>
          }
        >
          {error.message}
        </Alerta>
      </div>
    );
  }

  if (cargando || !vista) {
    return (
      <div className="cev-campos" aria-busy="true">
        {resumen}
        <Esqueleto forma="bloque" alto="120px" />
      </div>
    );
  }

  const { asignaciones, omitidos, advertencias, total } = vista;
  const filas = asignaciones
    .slice((pagina - 1) * TAMANO_PAGINA, pagina * TAMANO_PAGINA)
    .map((asignacion) => ({ ...asignacion, clave: asignacion.evaluado.id_empleado }));

  return (
    <div className="cev-campos">
      {resumen}

      {total === 0 && (
        <Alerta tono="peligro" role="alert" titulo="El alcance elegido no genera ninguna asignación">
          Ningún colaborador del alcance tiene un jefe directo en su sucursal. Vuelva al paso de alcance y elija otras
          áreas, sucursales o colaboradores.
        </Alerta>
      )}

      {advertencias.map((advertencia) => (
        <Alerta key={advertencia.codigo} tono="aviso" titulo="Revise el alcance">
          {advertencia.mensaje}
        </Alerta>
      ))}

      {omitidos.length > 0 && (
        <Alerta
          tono="aviso"
          titulo={`${plural(omitidos.length, "colaborador no se evaluará", "colaboradores no se evaluarán")} en este ciclo`}
        >
          <details className="cev-omitidos">
            <summary>Ver quiénes y por qué</summary>
            <ul>
              {omitidos.map((omitido) => (
                <li key={omitido.id_empleado}>
                  <strong>{nombreDe(omitido)}</strong>: {omitido.motivo}
                </li>
              ))}
            </ul>
          </details>
        </Alerta>
      )}

      <div className="cev-subtitulo">
        <h3 className="cev-subtitulo__texto">Asignaciones evaluador–evaluado</h3>
        <Contador aria-label={`${total} asignaciones`}>{total}</Contador>
      </div>
      <Tabla
        className="cev-tabla"
        columnas={columnas}
        filas={filas}
        claveFila="clave"
        descripcion="Asignaciones que se crearán"
        vacio={<EstadoVacio icono={Users} titulo="Sin asignaciones" mensaje="El alcance no genera evaluaciones." />}
      />
      <Paginacion
        etiqueta="Páginas de asignaciones"
        pagina={pagina}
        limite={TAMANO_PAGINA}
        total={total}
        onCambiar={setPagina}
      />
    </div>
  );
}

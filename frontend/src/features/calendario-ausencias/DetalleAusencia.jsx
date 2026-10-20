import { Boton, Etiqueta, Modal } from "../../components/ui";
import { formatearFecha } from "../solicitud-vacaciones/formato";
import { plural, visualDeTipo } from "./calendario";

// Criterio 4: al hacer clic en un bloque se ve el colaborador, su cargo, el tipo de ausencia y el período aprobado.
export default function DetalleAusencia({ ausencia, onCerrar }) {
  const visual = ausencia ? visualDeTipo(ausencia.tipo.codigo) : null;
  const unDia = ausencia?.fecha_inicio === ausencia?.fecha_fin;

  return (
    <Modal
      abierto={Boolean(ausencia)}
      titulo={ausencia ? ausencia.empleado.nombre_completo : "Ausencia"}
      tamano="sm"
      onCerrar={onCerrar}
      pie={
        <Boton onClick={onCerrar} data-autofocus>
          Cerrar
        </Boton>
      }
    >
      {ausencia && (
        <dl className="cal-detalle">
          <div>
            <dt>Colaborador</dt>
            <dd>{ausencia.empleado.nombre_completo}</dd>
          </div>
          <div>
            <dt>Cargo</dt>
            <dd>{ausencia.empleado.cargo ?? "—"}</dd>
          </div>
          {ausencia.empleado.area && (
            <div>
              <dt>Área</dt>
              <dd>{ausencia.empleado.area}</dd>
            </div>
          )}
          <div>
            <dt>Tipo de ausencia</dt>
            <dd>
              <span className={`cal-tipo--${visual.clase}`}>
                <Etiqueta className="cal-etiqueta-tipo">{ausencia.tipo.nombre}</Etiqueta>
              </span>
            </dd>
          </div>
          <div>
            <dt>Período aprobado</dt>
            <dd>
              {unDia
                ? formatearFecha(ausencia.fecha_inicio)
                : `Del ${formatearFecha(ausencia.fecha_inicio)} al ${formatearFecha(ausencia.fecha_fin)}`}
            </dd>
          </div>
          <div>
            <dt>Duración</dt>
            <dd>
              {ausencia.categoria === "VACACIONES"
                ? plural(ausencia.dias, "día hábil", "días hábiles")
                : plural(ausencia.dias, "día corrido", "días corridos")}
            </dd>
          </div>
          <div>
            <dt>Haberes</dt>
            <dd>{ausencia.con_goce_haberes ? "Con goce de haberes" : "Sin goce de haberes"}</dd>
          </div>
        </dl>
      )}
    </Modal>
  );
}

import { cruzaMedianoche, formatearMinutos, horaCorta } from "./jornada";

export default function TablaTurnos({ turnos, idEditando, onEditar, onEliminar }) {
  if (turnos.length === 0) {
    return (
      <div className="tarjeta estado-vacio">
        <p className="estado-vacio-titulo">Aún no hay turnos</p>
        <p>Cree el primer turno para poder asignarlo a los empleados.</p>
      </div>
    );
  }

  return (
    <div className="tarjeta tabla-contenedor">
      <table className="tabla">
        <caption className="solo-lector">Turnos registrados</caption>
        <thead>
          <tr>
            <th scope="col">Nombre</th>
            <th scope="col">Tipo</th>
            <th scope="col">Horario</th>
            <th scope="col">Refrigerio</th>
            <th scope="col">Tolerancia</th>
            <th scope="col">Horas efectivas</th>
            <th scope="col">Estado</th>
            <th scope="col">
              <span className="solo-lector">Acciones</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {turnos.map((turno) => (
            <tr key={turno.id_turno} className={turno.id_turno === idEditando ? "fila-editando" : undefined}>
              <td className="tabla-nombre">{turno.nombre}</td>
              <td>{turno.tipo_nombre}</td>
              <td className="tabla-numero">
                {horaCorta(turno.hora_inicio)} – {horaCorta(turno.hora_fin)}
                {cruzaMedianoche(turno.hora_inicio, turno.hora_fin) && <span className="nota"> +1 día</span>}
              </td>
              <td className="tabla-numero">{turno.minutos_refrigerio} min</td>
              <td className="tabla-numero">{turno.minutos_tolerancia} min</td>
              <td className="tabla-numero">{formatearMinutos(turno.minutos_efectivos)}</td>
              <td>
                <span className={`insignia${turno.esta_activo ? " insignia-activo" : ""}`}>
                  {turno.esta_activo ? "Activo" : "Inactivo"}
                </span>
              </td>
              <td className="tabla-acciones">
                <div className="acciones-fila">
                  <button
                    type="button"
                    className="boton boton-texto"
                    aria-label={`Editar ${turno.nombre}`}
                    onClick={() => onEditar(turno)}
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    className="boton boton-texto boton-peligro"
                    aria-label={`Eliminar ${turno.nombre}`}
                    onClick={() => onEliminar(turno)}
                  >
                    Eliminar
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

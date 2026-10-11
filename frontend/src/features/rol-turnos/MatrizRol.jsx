import { useEffect, useMemo, useRef, useState } from "react";
import { Eraser, TriangleAlert, Users } from "lucide-react";
import { Boton, Etiqueta } from "../../components/ui";
import AplicarCuadrillaModal from "./AplicarCuadrillaModal";
import { claveCelda } from "./useEdicionRol";
import { abreviar, esFinDeSemana, formatearDiaCorto, formatearDiaLargo, franjaDe, horario, numeroDia } from "./formato";

const DESCANSO = "descanso";
const VACIAR = "vaciar";
const TIPO_ARRASTRE = "text/plain";

const valorDePincel = (clave) => {
  if (clave === VACIAR) return null;
  if (clave === DESCANSO) return { id_turno: null, descanso: true };
  return { id_turno: clave, descanso: false };
};

function opcionesDePincel(paleta, abreviaturas) {
  return [
    ...paleta.map((turno) => ({
      clave: turno.id_turno,
      etiqueta: turno.nombre,
      detalle: horario(turno),
      abreviatura: abreviaturas.get(turno.id_turno),
      franja: franjaDe(turno),
    })),
    { clave: DESCANSO, etiqueta: "Descanso", abreviatura: "D", franja: "descanso" },
    { clave: VACIAR, etiqueta: "Vaciar", icono: Eraser, franja: "vacia" },
  ];
}

function alertasPorCelda(alertas) {
  const mapa = new Map();
  const agregar = (clave, mensaje) => mapa.set(clave, [...(mapa.get(clave) ?? []), mensaje]);
  for (const alerta of alertas) {
    agregar(claveCelda(alerta.id_empleado, alerta.fecha), alerta.mensaje);
    agregar(claveCelda(alerta.id_empleado, alerta.fecha_anterior), alerta.mensaje);
  }
  return mapa;
}

export default function MatrizRol({ rol, paleta, valorDe, cambiar }) {
  const { dias, empleados } = rol;
  const turnos = useMemo(
    () => new Map([...rol.turnos, ...paleta].map((turno) => [turno.id_turno, turno])),
    [rol.turnos, paleta]
  );
  const abreviaturas = useMemo(() => abreviar([...turnos.values()]), [turnos]);
  const opciones = useMemo(() => opcionesDePincel(paleta, abreviaturas), [paleta, abreviaturas]);
  const alertas = useMemo(() => alertasPorCelda(rol.alertas), [rol.alertas]);
  const [pincel, setPincel] = useState(() => opciones[0].clave);
  const [foco, setFoco] = useState({ fila: 0, columna: 0 });
  const [seleccion, setSeleccion] = useState(() => new Set());
  const [cuadrillaAbierta, setCuadrillaAbierta] = useState(false);
  const [destinoArrastre, setDestinoArrastre] = useState(null);
  const pintando = useRef(false);
  const tabla = useRef(null);

  useEffect(() => {
    const terminar = () => {
      pintando.current = false;
    };
    window.addEventListener("pointerup", terminar);
    window.addEventListener("pointercancel", terminar);
    return () => {
      window.removeEventListener("pointerup", terminar);
      window.removeEventListener("pointercancel", terminar);
    };
  }, []);

  const opcionActual = opciones.find((opcion) => opcion.clave === pincel) ?? opciones[0];

  const aplicar = (celdas, clave = opcionActual.clave) => {
    const valor = valorDePincel(clave);
    cambiar(celdas.map(({ id_empleado, fecha }) => ({ id_empleado, fecha, valor })));
  };

  const describirCelda = (valor) => {
    if (!valor) return "sin asignar";
    if (valor.descanso) return "descanso";
    const turno = turnos.get(valor.id_turno);
    return turno ? `turno ${turno.nombre}, ${horario(turno)}` : "turno no disponible";
  };

  const enfocar = (fila, columna) => {
    const destino = {
      fila: Math.min(Math.max(fila, 0), empleados.length - 1),
      columna: Math.min(Math.max(columna, 0), dias.length - 1),
    };
    setFoco(destino);
    tabla.current?.querySelector(`[data-fila="${destino.fila}"][data-columna="${destino.columna}"]`)?.focus();
  };

  const alPresionarTecla = (evento) => {
    const { fila, columna } = evento.target.dataset;
    if (fila === undefined) return;
    const f = Number(fila);
    const c = Number(columna);
    const movimientos = {
      ArrowRight: [f, c + 1],
      ArrowLeft: [f, c - 1],
      ArrowDown: [f + 1, c],
      ArrowUp: [f - 1, c],
      Home: [f, 0],
      End: [f, dias.length - 1],
    };
    if (movimientos[evento.key]) {
      evento.preventDefault();
      enfocar(...movimientos[evento.key]);
      return;
    }
    if (evento.key === "Delete" || evento.key === "Backspace") {
      evento.preventDefault();
      aplicar([{ id_empleado: empleados[f].id_empleado, fecha: dias[c] }], VACIAR);
      return;
    }
    const numero = Number(evento.key);
    if (Number.isInteger(numero) && numero >= 1 && numero <= opciones.length) {
      evento.preventDefault();
      setPincel(opciones[numero - 1].clave);
    }
  };

  // Arrastrar una opción de la paleta: sobre una celda, una fila (todos los días) o un día (todo el personal).
  const alSoltar = (evento, celdas) => {
    evento.preventDefault();
    setDestinoArrastre(null);
    const clave = evento.dataTransfer.getData(TIPO_ARRASTRE);
    if (!opciones.some((opcion) => opcion.clave === clave)) return;
    setPincel(clave);
    aplicar(celdas, clave);
  };

  const zonaDeArrastre = (id, celdas) => ({
    onDragOver: (evento) => {
      evento.preventDefault();
      evento.dataTransfer.dropEffect = "copy";
      if (destinoArrastre !== id) setDestinoArrastre(id);
    },
    onDragLeave: () => setDestinoArrastre((actual) => (actual === id ? null : actual)),
    onDrop: (evento) => alSoltar(evento, celdas()),
    "data-destino": destinoArrastre === id ? "" : undefined,
  });

  const vigentes = empleados.filter((empleado) => empleado.vigente);
  const todosSeleccionados = vigentes.length > 0 && vigentes.every((e) => seleccion.has(e.id_empleado));

  const alternarSeleccion = (idEmpleado) =>
    setSeleccion((actual) => {
      const siguiente = new Set(actual);
      if (siguiente.has(idEmpleado)) siguiente.delete(idEmpleado);
      else siguiente.add(idEmpleado);
      return siguiente;
    });

  const aplicarCuadrilla = ({ clave, diasSemana }) => {
    const fechas = dias.filter((fecha) => diasSemana.has(new Date(`${fecha}T00:00:00Z`).getUTCDay()));
    aplicar(
      [...seleccion].flatMap((id_empleado) => fechas.map((fecha) => ({ id_empleado, fecha }))),
      clave
    );
    setPincel(clave);
    setCuadrillaAbierta(false);
  };

  return (
    <div className="rt-editor">
      <div className="rt-herramientas">
        <div className="rt-paleta" role="toolbar" aria-label="Turno a asignar" aria-describedby="rt-ayuda-matriz">
          {opciones.map((opcion, indice) => {
            const Icono = opcion.icono;
            return (
              <button
                key={opcion.clave}
                type="button"
                className={`rt-pincel rt-franja--${opcion.franja} ds-foco`}
                aria-pressed={opcion.clave === opcionActual.clave}
                draggable
                onDragStart={(evento) => {
                  evento.dataTransfer.setData(TIPO_ARRASTRE, opcion.clave);
                  evento.dataTransfer.effectAllowed = "copy";
                }}
                onDragEnd={() => setDestinoArrastre(null)}
                onClick={() => setPincel(opcion.clave)}
              >
                <span className="rt-pincel__muestra" aria-hidden="true">
                  {Icono ? <Icono className="ds-icono" /> : opcion.abreviatura}
                </span>
                <span className="rt-pincel__texto">
                  <span className="rt-pincel__nombre">{opcion.etiqueta}</span>
                  {opcion.detalle && <span className="rt-pincel__detalle">{opcion.detalle}</span>}
                </span>
                <kbd className="rt-pincel__atajo" aria-hidden="true">
                  {indice + 1}
                </kbd>
              </button>
            );
          })}
        </div>
        <div className="rt-cuadrilla">
          <span className="rt-cuadrilla__cuenta" aria-live="polite">
            {seleccion.size === 0 ? "Ningún colaborador seleccionado" : `${seleccion.size} seleccionado(s)`}
          </span>
          <Boton icono={Users} disabled={seleccion.size === 0} onClick={() => setCuadrillaAbierta(true)}>
            Asignar a la cuadrilla
          </Boton>
        </div>
      </div>
      <p id="rt-ayuda-matriz" className="rt-ayuda">
        Elija un turno y haga clic en las celdas (o arrastre el puntero sobre varias). También puede arrastrar un turno
        hasta una celda, el nombre de un colaborador (toda su fila) o un día (todo el personal). Con el teclado: flechas
        para moverse, Enter para asignar, Supr para vaciar y 1–{opciones.length} para elegir el turno.
      </p>

      <div className="rt-matriz" role="region" aria-label="Matriz de turnos" tabIndex={-1}>
        <table ref={tabla} className="rt-tabla" role="grid" aria-label="Turnos por colaborador y día" onKeyDown={alPresionarTecla}>
          <thead>
            <tr>
              <th scope="col" className="rt-tabla__esquina">
                <label className="rt-seleccion">
                  <input
                    type="checkbox"
                    className="ds-casilla__control ds-foco"
                    checked={todosSeleccionados}
                    disabled={vigentes.length === 0}
                    onChange={() =>
                      setSeleccion(todosSeleccionados ? new Set() : new Set(vigentes.map((e) => e.id_empleado)))
                    }
                  />
                  <span>Colaborador</span>
                </label>
              </th>
              {dias.map((fecha) => (
                <th
                  key={fecha}
                  scope="col"
                  className={`rt-tabla__dia ${esFinDeSemana(fecha) ? "rt-tabla__dia--finde" : ""}`}
                  {...zonaDeArrastre(`dia-${fecha}`, () => vigentes.map(({ id_empleado }) => ({ id_empleado, fecha })))}
                >
                  <abbr title={formatearDiaLargo(fecha)} className="rt-tabla__dia-nombre">
                    {formatearDiaCorto(fecha)}
                  </abbr>
                  <span className="rt-tabla__dia-numero">{numeroDia(fecha)}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {empleados.map((empleado, fila) => (
              <tr key={empleado.id_empleado} className={empleado.vigente ? undefined : "rt-fila--fuera"}>
                <th
                  scope="row"
                  className="rt-tabla__empleado"
                  {...zonaDeArrastre(`fila-${empleado.id_empleado}`, () =>
                    dias.map((fecha) => ({ id_empleado: empleado.id_empleado, fecha }))
                  )}
                >
                  <label className="rt-seleccion">
                    {empleado.vigente && (
                      <input
                        type="checkbox"
                        className="ds-casilla__control ds-foco"
                        checked={seleccion.has(empleado.id_empleado)}
                        onChange={() => alternarSeleccion(empleado.id_empleado)}
                        aria-label={`Seleccionar a ${empleado.nombre_completo}`}
                      />
                    )}
                    <span className="rt-empleado">
                      <span className="rt-empleado__nombre" title={empleado.nombre_completo}>
                        {empleado.nombre_completo}
                      </span>
                      {empleado.vigente ? (
                        <span className="rt-empleado__cargo" title={empleado.cargo ?? undefined}>
                          {empleado.cargo}
                        </span>
                      ) : (
                        <Etiqueta tono="neutral">Fuera del área</Etiqueta>
                      )}
                    </span>
                  </label>
                </th>
                {dias.map((fecha, columna) => {
                  const valor = valorDe(empleado.id_empleado, fecha);
                  const turno = valor?.id_turno ? turnos.get(valor.id_turno) : null;
                  const mensajes = alertas.get(claveCelda(empleado.id_empleado, fecha));
                  const celda = { id_empleado: empleado.id_empleado, fecha };
                  const franja = !valor ? "vacia" : valor.descanso ? "descanso" : franjaDe(turno);
                  const enFoco = foco.fila === fila && foco.columna === columna;
                  return (
                    <td key={fecha} className={esFinDeSemana(fecha) ? "rt-tabla__celda--finde" : undefined}>
                      <button
                        type="button"
                        className={`rt-celda rt-franja--${franja} ${mensajes ? "rt-celda--alerta" : ""}`}
                        data-fila={fila}
                        data-columna={columna}
                        data-celda={claveCelda(empleado.id_empleado, fecha)}
                        tabIndex={enFoco ? 0 : -1}
                        aria-label={`${empleado.nombre_completo}, ${formatearDiaLargo(fecha)}: ${describirCelda(valor)}${
                          mensajes ? `. Alerta: ${mensajes.join(" ")}` : ""
                        }`}
                        title={mensajes?.join("\n")}
                        onFocus={() => setFoco({ fila, columna })}
                        onPointerDown={(evento) => {
                          if (evento.pointerType === "touch" || evento.button !== 0) return;
                          pintando.current = true;
                          aplicar([celda]);
                        }}
                        onPointerEnter={() => {
                          if (pintando.current) aplicar([celda]);
                        }}
                        onClick={() => aplicar([celda])}
                        {...zonaDeArrastre(`celda-${empleado.id_empleado}-${fecha}`, () => [celda])}
                      >
                        <span aria-hidden="true">
                          {!valor ? "" : valor.descanso ? "D" : abreviaturas.get(valor.id_turno) ?? "?"}
                        </span>
                        {mensajes && <TriangleAlert className="rt-celda__alerta" aria-hidden="true" />}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="rt-leyenda" aria-label="Leyenda">
        {opciones
          .filter((opcion) => opcion.clave !== VACIAR)
          .map((opcion) => (
            <li key={opcion.clave}>
              <span className={`rt-leyenda__muestra rt-franja--${opcion.franja}`} aria-hidden="true">
                {opcion.abreviatura}
              </span>
              {opcion.etiqueta}
              {opcion.detalle && <span className="rt-leyenda__detalle"> {opcion.detalle}</span>}
            </li>
          ))}
        <li>
          <TriangleAlert className="ds-icono rt-leyenda__alerta" aria-hidden="true" />
          Descanso insuficiente o turnos superpuestos
        </li>
      </ul>

      <AplicarCuadrillaModal
        abierto={cuadrillaAbierta}
        cantidad={seleccion.size}
        opciones={opciones}
        pincel={opcionActual.clave}
        onAplicar={aplicarCuadrilla}
        onCerrar={() => setCuadrillaAbierta(false)}
      />
    </div>
  );
}

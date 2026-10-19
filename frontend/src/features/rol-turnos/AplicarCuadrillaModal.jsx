import { useState } from "react";
import { Boton, Casilla, Modal, Selector } from "../../components/ui";

// getUTCDay: 0 = domingo. Se muestran de lunes a domingo.
const DIAS_SEMANA = [
  { numero: 1, nombre: "Lunes" },
  { numero: 2, nombre: "Martes" },
  { numero: 3, nombre: "Miércoles" },
  { numero: 4, nombre: "Jueves" },
  { numero: 5, nombre: "Viernes" },
  { numero: 6, nombre: "Sábado" },
  { numero: 0, nombre: "Domingo" },
];

function Formulario({ cantidad, opciones, pincel, onAplicar, onCerrar }) {
  const [clave, setClave] = useState(pincel);
  const [diasSemana, setDiasSemana] = useState(() => new Set(DIAS_SEMANA.map((d) => d.numero)));
  const [error, setError] = useState(null);

  const alternar = (numero) =>
    setDiasSemana((actual) => {
      const siguiente = new Set(actual);
      if (siguiente.has(numero)) siguiente.delete(numero);
      else siguiente.add(numero);
      return siguiente;
    });

  const enviar = (evento) => {
    evento.preventDefault();
    if (diasSemana.size === 0) {
      setError("Elija al menos un día de la semana.");
      evento.currentTarget.querySelector("input[type=checkbox]")?.focus();
      return;
    }
    onAplicar({ clave, diasSemana });
  };

  return (
    <form id="rt-form-cuadrilla" className="rt-form-cuadrilla" onSubmit={enviar} noValidate>
      <p>Se asignará a {cantidad} colaborador(es) en todos los días elegidos del periodo.</p>
      <Selector
        etiqueta="Asignar"
        value={clave}
        onChange={(evento) => setClave(evento.target.value)}
        opciones={opciones.map((opcion) => ({
          valor: opcion.clave,
          etiqueta: opcion.detalle ? `${opcion.etiqueta} (${opcion.detalle})` : opcion.etiqueta,
        }))}
        data-autofocus
      />
      <fieldset className="rt-form-cuadrilla__dias" aria-describedby={error ? "rt-error-dias" : undefined}>
        <legend>Días de la semana</legend>
        {DIAS_SEMANA.map((dia) => (
          <Casilla
            key={dia.numero}
            etiqueta={dia.nombre}
            checked={diasSemana.has(dia.numero)}
            onChange={() => {
              alternar(dia.numero);
              setError(null);
            }}
          />
        ))}
        {error && (
          <p id="rt-error-dias" className="ds-campo__error" role="alert">
            {error}
          </p>
        )}
      </fieldset>
      <div className="ds-modal__pie rt-form-cuadrilla__pie">
        <Boton variante="sutil" onClick={onCerrar}>
          Cancelar
        </Boton>
        <Boton variante="primario" type="submit">
          Asignar
        </Boton>
      </div>
    </form>
  );
}

export default function AplicarCuadrillaModal({ abierto, onCerrar, ...props }) {
  return (
    <Modal abierto={abierto} titulo="Asignar a la cuadrilla" onCerrar={onCerrar}>
      {abierto && <Formulario {...props} onCerrar={onCerrar} />}
    </Modal>
  );
}

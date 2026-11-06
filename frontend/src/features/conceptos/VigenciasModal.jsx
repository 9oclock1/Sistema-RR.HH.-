import { useCallback, useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { obtenerConcepto, registrarVigencia } from "../../api/conceptos";
import { Alerta, Boton, CampoTexto, Etiqueta, Modal, Tabla, useAvisos } from "../../components/ui";
import { BASES, FORMAS, TIPOS, estadoVigencia, formatearFecha, formatearValor } from "./formato";
import useFormulario from "./useFormulario";

const ETIQUETAS = {
  valor: "Nuevo valor",
  vigente_desde: "Vigente desde",
  vigente_hasta: "Vigente hasta",
};

const VACIO = { valor: "", vigente_desde: "", vigente_hasta: "" };

const columnas = (forma) => [
  { clave: "valor", titulo: "Valor", alinear: "fin", celda: (v) => formatearValor(v.valor, forma) },
  { clave: "vigente_desde", titulo: "Desde", celda: (v) => formatearFecha(v.vigente_desde) },
  {
    clave: "vigente_hasta",
    titulo: "Hasta",
    celda: (v) => (v.vigente_hasta ? formatearFecha(v.vigente_hasta) : "Sin fecha de fin"),
  },
  {
    clave: "estado",
    titulo: "Estado",
    celda: (v) => {
      const estado = estadoVigencia(v);
      return <Etiqueta tono={estado.tono}>{estado.etiqueta}</Etiqueta>;
    },
  },
];

export default function VigenciasModal({ concepto, onCerrar, onRegistrada }) {
  const avisar = useAvisos();
  const [detalle, setDetalle] = useState(null);
  const [errorCarga, setErrorCarga] = useState(null);
  const forma = concepto.forma_calculo;
  const esPorcentaje = forma === "PORCENTAJE";

  const cargar = useCallback(
    () =>
      obtenerConcepto(concepto.id_concepto)
        .then((datos) => {
          setDetalle(datos);
          setErrorCarga(null);
        })
        .catch((error) => setErrorCarga(error.message)),
    [concepto.id_concepto]
  );

  useEffect(() => {
    cargar();
  }, [cargar]);

  const { setValores, enviar, enviando, propsCampo, resumen } = useFormulario({
    inicial: VACIO,
    etiquetas: ETIQUETAS,
    prefijo: "vigencia",
    onGuardar: async (valores) => {
      const actualizado = await registrarVigencia(concepto.id_concepto, {
        valor: valores.valor === "" ? null : Number(valores.valor),
        vigente_desde: valores.vigente_desde,
        vigente_hasta: valores.vigente_hasta || null,
      });
      setDetalle(actualizado);
      setValores(VACIO);
      onRegistrada();
      avisar({
        tono: "exito",
        titulo: "Vigencia registrada",
        mensaje: `${concepto.codigo}: ${formatearValor(Number(valores.valor), forma)} desde ${formatearFecha(valores.vigente_desde)}`,
      });
    },
  });

  return (
    <Modal abierto titulo={`Historial de ${concepto.codigo}`} onCerrar={onCerrar} bloqueado={enviando}>
      <div className="vigencias">
        <dl className="vigencias-resumen">
          <div>
            <dt>Concepto</dt>
            <dd>{concepto.nombre}</dd>
          </div>
          <div>
            <dt>Tipo</dt>
            <dd>{TIPOS[concepto.tipo].etiqueta}</dd>
          </div>
          <div>
            <dt>Forma de cálculo</dt>
            <dd>
              {FORMAS[forma]}
              {concepto.base_calculo && ` sobre ${BASES[concepto.base_calculo].toLowerCase()}`}
            </dd>
          </div>
        </dl>

        {errorCarga ? (
          <Alerta
            tono="peligro"
            role="alert"
            titulo="No se pudo cargar el historial"
            acciones={
              <Boton tamano="sm" onClick={cargar}>
                Reintentar
              </Boton>
            }
          >
            {errorCarga}
          </Alerta>
        ) : (
          <Tabla
            className="vigencias-tabla"
            descripcion={`Vigencias de ${concepto.codigo}`}
            columnas={columnas(forma)}
            filas={detalle?.vigencias ?? []}
            claveFila="id_vigencia"
            cargando={!detalle}
            filasCargando={2}
          />
        )}

        <form className="vigencias-formulario" onSubmit={enviar} noValidate aria-labelledby="vigencia-titulo">
          <h3 id="vigencia-titulo" className="vigencias-titulo">
            Nueva vigencia
          </h3>
          <p className="concepto-nota">
            La vigencia actual se cierra el día anterior. Las planillas ya generadas conservan el valor anterior.
          </p>
          {resumen}
          <div className="concepto-grupo__campos concepto-grupo__campos--tres">
            <CampoTexto
              {...propsCampo("valor")}
              etiqueta={esPorcentaje ? "Nuevo porcentaje (%)" : "Nuevo monto (Bs)"}
              type="number"
              inputMode="decimal"
              min="0"
              step={esPorcentaje ? "0.0001" : "0.01"}
              requerido
            />
            <CampoTexto {...propsCampo("vigente_desde")} type="date" requerido />
            <CampoTexto {...propsCampo("vigente_hasta")} type="date" ayuda="Opcional." />
          </div>
          <div className="vigencias-formulario__pie">
            <Boton type="submit" variante="primario" icono={Plus} cargando={enviando}>
              {enviando ? "Registrando…" : "Registrar vigencia"}
            </Boton>
          </div>
        </form>
      </div>
    </Modal>
  );
}

import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { Download, Eye, ReceiptText, UserRound } from "lucide-react";
import { descargarBoleta, listarMisBoletas } from "../../api/boletas";
import { Alerta, Boton, EncabezadoPagina, EstadoVacio, Tabla, Tarjeta, useAvisos } from "../../components/ui";
import { useRol, useUsuario } from "../../context/sesion";
import { guardarComo } from "../Kardex/utils/descarga";
import VistaPreviaBoleta from "./VistaPreviaBoleta";
import { bs, fechaHora, mayuscula, mensajeDescarga, nombreMes } from "./formato";
import "./boletas.css";

const MIGAS = [{ etiqueta: "Inicio", href: "/" }, { etiqueta: "Planillas" }];
const DESCRIPCION = "Sus boletas de las planillas cerradas, con el detalle de haberes, descuentos de ley, aportes y líquido pagable.";

function columnas({ abrir, descargar, descargando }) {
  return [
    {
      clave: "periodo",
      titulo: "Periodo",
      ancho: "22%",
      celda: (b) => <span className="boleta-periodo">{mayuscula(nombreMes(b.periodo))}</span>,
    },
    { clave: "ganado", titulo: "Total ganado", alinear: "fin", celda: (b) => <span className="boleta-cifra">{bs(b.totales.total_ganado)}</span> },
    { clave: "descuentos", titulo: "Descuentos", alinear: "fin", celda: (b) => <span className="boleta-cifra">{bs(b.totales.total_descuentos)}</span> },
    {
      clave: "liquido",
      titulo: "Líquido pagable",
      alinear: "fin",
      celda: (b) => <strong className="boleta-cifra">{bs(b.totales.liquido_pagable)}</strong>,
    },
    { clave: "emitida", titulo: "Emitida", celda: (b) => <span className="boleta-cifra">{fechaHora(b.emitida_en)}</span> },
    {
      clave: "acciones",
      titulo: <span className="ds-solo-lector">Acciones</span>,
      alinear: "fin",
      celda: (b) => {
        const mes = nombreMes(b.periodo);
        return (
          <div className="boleta-acciones">
            <Boton variante="sutil" soloIcono icono={Eye} aria-label={`Vista previa de la boleta de ${mes}`} title="Vista previa" onClick={() => abrir(b)} />
            <Boton
              variante="sutil"
              soloIcono
              icono={Download}
              cargando={descargando === b.id_boleta}
              aria-label={`Descargar en PDF la boleta de ${mes}`}
              title="Descargar PDF"
              onClick={() => descargar(b)}
            />
          </div>
        );
      },
    },
  ];
}

function ListaBoletas({ idEmpleado, rol }) {
  const avisar = useAvisos();
  const identidad = useMemo(() => ({ idEmpleado, rol }), [idEmpleado, rol]);
  const [boletas, setBoletas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [abierta, setAbierta] = useState(null);
  const [descargando, setDescargando] = useState(null);

  const pedir = useCallback(
    () =>
      listarMisBoletas(identidad)
        .then((lista) => {
          setBoletas(lista);
          setError(null);
        })
        .catch(setError)
        .finally(() => setCargando(false)),
    [identidad]
  );

  useEffect(() => {
    pedir();
  }, [pedir]);

  const reintentar = () => {
    setCargando(true);
    pedir();
  };

  const descargar = async (boleta) => {
    setDescargando(boleta.id_boleta);
    try {
      guardarComo(await descargarBoleta(boleta.id_boleta, identidad), `boleta-de-pago_${boleta.periodo}.pdf`);
      avisar({ tono: "exito", titulo: "Boleta descargada", mensaje: `Boleta de pago de ${nombreMes(boleta.periodo)}.` });
    } catch (e) {
      avisar({ tono: "peligro", titulo: "No se pudo descargar la boleta", mensaje: mensajeDescarga(e) });
    } finally {
      setDescargando(null);
    }
  };

  return (
    <>
      {error ? (
        <Alerta
          tono="peligro"
          role="alert"
          titulo="No se pudieron cargar sus boletas"
          acciones={
            <Boton tamano="sm" onClick={reintentar} cargando={cargando}>
              Reintentar
            </Boton>
          }
        >
          {error.message}
        </Alerta>
      ) : (
        <Tarjeta titulo="Boletas por periodo" nivelTitulo={2} className="boleta-tarjeta">
          <Tabla
            className="boleta-tabla"
            descripcion="Sus boletas de pago por periodo"
            columnas={columnas({ abrir: setAbierta, descargar, descargando })}
            filas={boletas}
            claveFila="id_boleta"
            cargando={cargando}
            filasCargando={3}
            vacio={
              <EstadoVacio
                icono={ReceiptText}
                titulo="Aún no tiene boletas"
                mensaje="Su boleta aparece aquí cuando la planilla del mes se cierra."
              />
            }
          />
        </Tarjeta>
      )}
      <VistaPreviaBoleta
        boleta={abierta}
        identidad={identidad}
        descargando={Boolean(abierta) && descargando === abierta.id_boleta}
        onDescargar={descargar}
        onCerrar={() => setAbierta(null)}
      />
    </>
  );
}

// RF-46: el colaborador consulta y descarga sus boletas de pago de las planillas cerradas.
export default function MisBoletasPage() {
  const idEmpleado = useUsuario();
  const rol = useRol();

  return (
    <section className="boletas" aria-labelledby="mis-boletas-titulo">
      <EncabezadoPagina migas={MIGAS} enlace={Link} titulo="Mis boletas de pago" idTitulo="mis-boletas-titulo" descripcion={DESCRIPCION} />
      {idEmpleado ? (
        <ListaBoletas key={idEmpleado} idEmpleado={idEmpleado} rol={rol} />
      ) : (
        <EstadoVacio
          icono={UserRound}
          titulo="Elija su usuario de prueba"
          mensaje="Seleccione quién es en «Usuario de prueba», al pie de la barra lateral, para ver sus boletas."
        />
      )}
    </section>
  );
}

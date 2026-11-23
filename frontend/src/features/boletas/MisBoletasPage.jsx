import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router";
import { Download, Eye, LogIn, ReceiptText } from "lucide-react";
import { descargarBoleta, listarMisBoletas } from "../../api/boletas";
import { Alerta, Boton, EncabezadoPagina, EstadoVacio, Esqueleto, Tabla, Tarjeta, useAvisos } from "../../components/ui";
import { abrirInicioSesion, fijarSesion, useSesion } from "../../context/sesion";
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

// 401: la sesión venció o se cerró en otra pestaña; la página vuelve a pedir inicio de sesión.
const sinSesion = (error) => {
  if (error?.estado !== 401) return false;
  fijarSesion(null);
  return true;
};

function ListaBoletas() {
  const avisar = useAvisos();
  const [boletas, setBoletas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [abierta, setAbierta] = useState(null);
  const [descargando, setDescargando] = useState(null);

  const pedir = useCallback(
    () =>
      listarMisBoletas()
        .then((lista) => {
          setBoletas(lista);
          setError(null);
        })
        .catch((e) => sinSesion(e) || setError(e))
        .finally(() => setCargando(false)),
    []
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
      guardarComo(await descargarBoleta(boleta.id_boleta), `boleta-de-pago_${boleta.periodo}.pdf`);
      avisar({ tono: "exito", titulo: "Boleta descargada", mensaje: `Boleta de pago de ${nombreMes(boleta.periodo)}.` });
    } catch (e) {
      avisar({ tono: "peligro", titulo: "No se pudo descargar la boleta", mensaje: mensajeDescarga(e) });
      sinSesion(e);
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
        descargando={Boolean(abierta) && descargando === abierta.id_boleta}
        onDescargar={descargar}
        onCerrar={() => setAbierta(null)}
      />
    </>
  );
}

// RF-46: el colaborador consulta y descarga sus boletas de pago de las planillas cerradas. Exige sesión real.
export default function MisBoletasPage() {
  const sesion = useSesion();

  return (
    <section className="boletas" aria-labelledby="mis-boletas-titulo">
      <EncabezadoPagina migas={MIGAS} enlace={Link} titulo="Mis boletas de pago" idTitulo="mis-boletas-titulo" descripcion={DESCRIPCION} />
      {sesion === undefined && <Esqueleto forma="bloque" alto="calc(var(--size-row) * 4)" />}
      {sesion === null && (
        <EstadoVacio
          icono={LogIn}
          titulo="Inicie sesión para ver sus boletas"
          mensaje="Sus boletas de pago solo se muestran con su propia cuenta, no con el usuario de prueba."
          accion={
            <Boton variante="primario" icono={LogIn} onClick={() => abrirInicioSesion()}>
              Iniciar sesión
            </Boton>
          }
        />
      )}
      {sesion && <ListaBoletas key={sesion.id_empleado} />}
    </section>
  );
}

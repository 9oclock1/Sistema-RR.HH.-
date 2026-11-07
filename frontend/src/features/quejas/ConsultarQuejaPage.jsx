import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { Search, ShieldCheck } from "lucide-react";
import { consultarQueja } from "../../api/quejas";
import { Alerta, Boton, CampoTexto, EncabezadoPagina, Etiqueta, Tarjeta } from "../../components/ui";
import { formatearFechaHora, tonoEstado } from "./formato";
import { normalizarCodigo } from "./reglas";
import "./quejas.css";

function ResultadoSeguimiento({ queja, refTitulo }) {
  return (
    <Tarjeta className="qj-resultado">
      <div className="qj-resultado__encabezado">
        <h2 ref={refTitulo} tabIndex={-1} className="qj-resultado__codigo">
          {queja.codigo_seguimiento}
        </h2>
        <Etiqueta tono={tonoEstado(queja.estado.codigo)}>{queja.estado.nombre}</Etiqueta>
      </div>
      <dl className="qj-datos">
        <div>
          <dt>Categoría</dt>
          <dd>{queja.categoria}</dd>
        </div>
        <div>
          <dt>Registrada</dt>
          <dd>
            <time dateTime={queja.registrada_en}>{formatearFechaHora(queja.registrada_en)}</time>
          </dd>
        </div>
        <div>
          <dt>Última actualización</dt>
          <dd>
            <time dateTime={queja.actualizada_en}>{formatearFechaHora(queja.actualizada_en)}</time>
          </dd>
        </div>
      </dl>
      <h3 className="qj-historial__titulo">Historial</h3>
      <ol className="qj-historial">
        {queja.historial.map((paso) => (
          <li key={`${paso.codigo}-${paso.fecha}`} className="qj-historial__paso">
            <span className="qj-historial__estado">{paso.estado}</span>
            <time className="qj-historial__fecha" dateTime={paso.fecha}>
              {formatearFechaHora(paso.fecha)}
            </time>
          </li>
        ))}
      </ol>
      {queja.estado.es_final ? (
        <p className="qj-nota">El caso está cerrado.</p>
      ) : (
        <p className="qj-nota">RRHH actualizará el estado a medida que atienda el caso. Vuelva a consultar más adelante.</p>
      )}
    </Tarjeta>
  );
}

export default function ConsultarQuejaPage() {
  const { state } = useLocation();
  const navegar = useNavigate();
  const [codigoInicial] = useState(() => normalizarCodigo(state?.codigo ?? ""));
  const [codigo, setCodigo] = useState(codigoInicial ?? "");
  const [error, setError] = useState(null);
  const [aviso, setAviso] = useState(null);
  const [queja, setQueja] = useState(null);
  const [consultando, setConsultando] = useState(Boolean(codigoInicial));
  const refTitulo = useRef(null);
  const refAlerta = useRef(null);
  const pendiente = useRef(codigoInicial);

  const buscar = useCallback(async (normalizado) => {
    try {
      setQueja(await consultarQueja(normalizado));
      setCodigo(normalizado);
    } catch (fallo) {
      setAviso({ tono: fallo.estado === 429 ? "aviso" : "peligro", mensaje: fallo.message });
    } finally {
      setConsultando(false);
    }
  }, []);

  const consultar = (entrada) => {
    const normalizado = normalizarCodigo(entrada);
    setQueja(null);
    setAviso(null);
    if (!normalizado) {
      setError("Escriba el código con el formato QJ-XXXX-XXXX.");
      return;
    }
    setError(null);
    setConsultando(true);
    buscar(normalizado);
  };

  useEffect(() => {
    const inicial = pendiente.current;
    if (!inicial) return;
    pendiente.current = null;
    navegar(".", { replace: true, state: null });
    buscar(inicial);
  }, [buscar, navegar]);

  useEffect(() => {
    if (queja) refTitulo.current?.focus();
  }, [queja]);

  useEffect(() => {
    if (aviso) refAlerta.current?.focus();
  }, [aviso]);

  const enviar = (evento) => {
    evento.preventDefault();
    consultar(codigo);
  };

  return (
    <div className="qj-publica">
      <header className="qj-publica__barra">
        <Link to="/" className="qj-publica__marca ds-foco">
          Sistema RR.HH.
        </Link>
      </header>

      <main className="qj-publica__contenido">
        <EncabezadoPagina
          titulo="Consultar mi queja"
          descripcion="Ingrese el código de seguimiento que recibió al registrar su queja. No necesita iniciar sesión ni identificarse."
        />

        <Tarjeta className="qj-tarjeta">
          <form className="qj-consulta" onSubmit={enviar} noValidate>
            <CampoTexto
              id="qj-codigo"
              etiqueta="Código de seguimiento"
              requerido
              placeholder="QJ-XXXX-XXXX"
              value={codigo}
              onChange={(e) => setCodigo(e.target.value)}
              error={error}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              maxLength={20}
              disabled={consultando}
            />
            <Boton variante="primario" type="submit" icono={Search} cargando={consultando}>
              {consultando ? "Consultando…" : "Consultar"}
            </Boton>
          </form>
          <p className="qj-nota qj-nota--privacidad">
            <ShieldCheck className="ds-icono" aria-hidden="true" />
            La consulta solo muestra el estado y las fechas, nunca el contenido de la queja ni quién la presentó.
          </p>
        </Tarjeta>

        {aviso && (
          <Alerta ref={refAlerta} tabIndex={-1} tono={aviso.tono} role="alert" titulo="No se pudo mostrar la queja">
            <p>{aviso.mensaje}</p>
          </Alerta>
        )}

        {queja && <ResultadoSeguimiento queja={queja} refTitulo={refTitulo} />}
      </main>
    </div>
  );
}

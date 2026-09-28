import { useState } from 'react';
import { Link } from 'react-router';
import { Plus } from 'lucide-react';
import {
  cerrarConvocatoria,
  createConvocatoria,
  publicarConvocatoria,
  updateConvocatoria,
} from '../../api/convocatoriasApi';
import { Alerta, Boton, EncabezadoPagina, ModalConfirmacion, useAvisos } from '../../components/ui';
import { useCargos } from '../Cargos/hooks/useCargos';
import VacanteForm from './components/VacanteForm';
import VacantesTable from './components/VacantesTable';
import { useConvocatorias } from './hooks/useConvocatorias';
import { useNivelesEducacion } from './hooks/useNivelesEducacion';
import { formatearFecha } from './utils/formato';
import './Vacantes.css';

export default function VacantesView() {
  const avisar = useAvisos();
  const [estadoFiltro, setEstadoFiltro] = useState('');
  const { convocatorias, cargando, error, recargar } = useConvocatorias(estadoFiltro);
  const catalogoCargos = useCargos('');
  const { niveles } = useNivelesEducacion();

  // null: formulario cerrado. { convocatoria: null }: vacante nueva.
  const [formulario, setFormulario] = useState(null);

  const [vacanteACerrar, setVacanteACerrar] = useState(null);
  const [idEnProceso, setIdEnProceso] = useState(null);
  const [alerta, setAlerta] = useState(null);

  const abrirFormulario = (convocatoria) => {
    setAlerta(null);
    setFormulario({ convocatoria });
  };

  // Si falla, el error llega al formulario y este sigue abierto; si sale bien, se cierra y la tabla se recarga.
  const guardar = async (payload) => {
    const actual = formulario.convocatoria;
    const guardada = actual
      ? await updateConvocatoria(actual.id_convocatoria, payload)
      : await createConvocatoria(payload);

    setFormulario(null);
    recargar();
    avisar({
      tono: 'exito',
      titulo: actual ? 'Borrador actualizado' : 'Borrador guardado',
      mensaje: `${guardada.codigo_convocatoria} · ${guardada.titulo_puesto}`,
    });
  };

  // Publicar y cerrar comparten el mismo manejo: una fila en proceso, alerta de error y recarga siempre,
  // porque un 409 significa que el estado cambió por otro lado.
  const ejecutarAccion = async (vacante, accion, { tituloError, exito }) => {
    setAlerta(null);
    setIdEnProceso(vacante.id_convocatoria);
    try {
      const actualizada = await accion(vacante.id_convocatoria);
      avisar({ tono: 'exito', ...exito(actualizada) });
    } catch (err) {
      setAlerta({ titulo: tituloError, texto: err.message });
    } finally {
      setIdEnProceso(null);
      setVacanteACerrar(null);
      recargar();
    }
  };

  const publicar = (vacante) =>
    ejecutarAccion(vacante, publicarConvocatoria, {
      tituloError: `No se pudo publicar ${vacante.codigo_convocatoria}`,
      exito: (v) => ({
        titulo: `${v.codigo_convocatoria} publicada`,
        mensaje: `Recibe postulaciones hasta el ${formatearFecha(v.fecha_limite_postulacion)}.`,
      }),
    });

  const pedirCierre = (vacante) => {
    setAlerta(null);
    setVacanteACerrar(vacante);
  };

  const confirmarCierre = () =>
    ejecutarAccion(vacanteACerrar, cerrarConvocatoria, {
      tituloError: `No se pudo cerrar ${vacanteACerrar.codigo_convocatoria}`,
      exito: (v) => ({
        titulo: `${v.codigo_convocatoria} cerrada`,
        mensaje: 'Las postulaciones registradas se conservan.',
      }),
    });

  const sinVacantes = !cargando && !error && !estadoFiltro && convocatorias.length === 0;
  const botonNueva = (
    <Boton variante="primario" icono={Plus} onClick={() => abrirFormulario(null)}>
      Nueva vacante
    </Boton>
  );

  return (
    <section className="vacantes" aria-labelledby="vacantes-titulo">
      <EncabezadoPagina
        migas={[{ etiqueta: 'Inicio', href: '/' }, { etiqueta: 'Reclutamiento' }]}
        enlace={Link}
        titulo="Vacantes"
        idTitulo="vacantes-titulo"
        descripcion="Convocatorias con los requisitos del cargo. Un borrador se publica cuando tiene todos sus requisitos."
        acciones={!sinVacantes && botonNueva}
      />

      {alerta && (
        <Alerta tono="peligro" role="alert" titulo={alerta.titulo} onCerrar={() => setAlerta(null)}>
          {alerta.texto}
        </Alerta>
      )}

      {error && convocatorias.length === 0 ? (
        <Alerta
          tono="peligro"
          role="alert"
          titulo="No se pudieron cargar las vacantes"
          acciones={
            <Boton tamano="sm" cargando={cargando} onClick={recargar}>
              Reintentar
            </Boton>
          }
        >
          {error.message}
        </Alerta>
      ) : (
        <VacantesTable
          vacantes={convocatorias}
          cargando={cargando}
          estado={estadoFiltro}
          onCambiarEstado={setEstadoFiltro}
          niveles={niveles}
          idEnProceso={idEnProceso}
          accionVacia={botonNueva}
          onEditar={abrirFormulario}
          onPublicar={publicar}
          onCerrar={pedirCierre}
        />
      )}

      {formulario && (
        <VacanteForm
          key={formulario.convocatoria?.id_convocatoria ?? 'nueva'}
          convocatoria={formulario.convocatoria}
          cargos={catalogoCargos.cargos}
          errorCargos={catalogoCargos.error}
          cargandoCargos={catalogoCargos.cargando}
          onGuardar={guardar}
          onCancelar={() => setFormulario(null)}
        />
      )}

      <ModalConfirmacion
        abierto={Boolean(vacanteACerrar)}
        titulo="¿Cerrar la convocatoria?"
        textoConfirmar="Cerrar convocatoria"
        procesando={Boolean(vacanteACerrar) && idEnProceso === vacanteACerrar.id_convocatoria}
        onConfirmar={confirmarCierre}
        onCancelar={() => setVacanteACerrar(null)}
      >
        <strong>{vacanteACerrar?.titulo_puesto}</strong> ({vacanteACerrar?.codigo_convocatoria}) dejará de aceptar
        postulaciones. Las postulaciones ya registradas se conservan.
      </ModalConfirmacion>
    </section>
  );
}

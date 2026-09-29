import { useState } from 'react';
import { Link } from 'react-router';
import { Plus } from 'lucide-react';
import { createCargo, updateCargo } from '../../api/cargosApi';
import { Alerta, Boton, Contador, EncabezadoPagina, Selector, Tarjeta, useAvisos } from '../../components/ui';
import { useDepartamentosActivos } from '../../hooks/useDepartamentosActivos';
import CargoForm from './components/CargoForm';
import CargosTable from './components/CargosTable';
import { useCargos } from './hooks/useCargos';
import './Cargos.css';

export default function CargosList() {
  const avisar = useAvisos();
  const [areaFiltro, setAreaFiltro] = useState('');
  const { cargos, cargando, error, recargar } = useCargos(areaFiltro);
  const areas = useDepartamentosActivos();
  
  const [formulario, setFormulario] = useState(null);

  const guardar = async (payload) => {
    const { cargo } = formulario;
    const guardado = cargo ? await updateCargo(cargo.id_cargo, payload) : await createCargo(payload);
    setFormulario(null);
    recargar();
    avisar({ tono: 'exito', titulo: cargo ? 'Cargo actualizado' : 'Cargo creado', mensaje: guardado.nombre });
  };

  const botonNuevo = (
    <Boton variante="primario" icono={Plus} onClick={() => setFormulario({ cargo: null })}>
      Nuevo cargo
    </Boton>
  );

  const filtroArea = (
    <Selector
      className="cargos-filtro"
      aria-label="Filtrar por área"
      value={areaFiltro}
      onChange={(e) => setAreaFiltro(e.target.value)}
      disabled={Boolean(areas.error)}
      title={areas.error ? 'No se pudieron cargar las áreas' : undefined}
      textoVacio="Todas las áreas"
      opciones={areas.departamentos.map((d) => ({ valor: d.id_departamento, etiqueta: d.nombre }))}
    />
  );

  return (
    <section className="cargos" aria-labelledby="cargos-titulo">
      <EncabezadoPagina
        migas={[{ etiqueta: 'Inicio', href: '/' }, { etiqueta: 'Organización' }]}
        enlace={Link}
        titulo="Cargos"
        idTitulo="cargos-titulo"
        descripcion="Catálogo de cargos activos con su nivel salarial, funciones y perfil requerido."
        acciones={!error && botonNuevo}
      />

      {error ? (
        <Alerta
          tono="peligro"
          role="alert"
          titulo="No se pudieron cargar los cargos"
          acciones={
            <Boton tamano="sm" onClick={recargar}>
              Reintentar
            </Boton>
          }
        >
          {error.message}
        </Alerta>
      ) : (
        <Tarjeta
          className="cargos-tarjeta"
          titulo={
            <>
              Cargos activos {!cargando && <Contador aria-label={`${cargos.length} cargos`}>{cargos.length}</Contador>}
            </>
          }
          acciones={filtroArea}
        >
          <CargosTable
            cargos={cargos}
            cargando={cargando}
            hayFiltro={Boolean(areaFiltro)}
            accionVacia={botonNuevo}
            onQuitarFiltro={() => setAreaFiltro('')}
            onEditar={(cargo) => setFormulario({ cargo })}
          />
        </Tarjeta>
      )}

      {formulario && (
        <CargoForm
          key={formulario.cargo?.id_cargo ?? 'nuevo'}
          cargo={formulario.cargo}
          departamentos={areas.departamentos}
          errorDepartamentos={areas.error}
          cargandoCatalogos={areas.cargando}
          onGuardar={guardar}
          onCancelar={() => setFormulario(null)}
        />
      )}
    </section>
  );
}

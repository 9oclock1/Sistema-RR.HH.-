import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { BookOpenCheck } from 'lucide-react';
import { listarMisMemorandums } from '../../../api/memorandumsApi';
import { Alerta, Boton } from '../../../components/ui';
import { leerEmpleado } from '../../marcaje/sesionEmpleado';

// RF-39 (criterio 1): alerta de alta prioridad en el portal mientras el colaborador tenga memorándums sin acuse.
// Usa el empleado identificado en el portal; si no hay o la consulta falla, no muestra nada.
export default function AvisoMemorandumsPendientes() {
  const [idEmpleado] = useState(leerEmpleado);
  const [pendientes, setPendientes] = useState(0);

  useEffect(() => {
    if (!idEmpleado) return undefined;
    let vigente = true;
    listarMisMemorandums(idEmpleado)
      .then((datos) => vigente && setPendientes(datos.pendientes))
      .catch(() => {});
    return () => {
      vigente = false;
    };
  }, [idEmpleado]);

  if (pendientes === 0) return null;

  return (
    <Alerta
      tono="peligro"
      role="status"
      titulo="Prioridad alta: memorándums pendientes de acuse"
      acciones={
        <Boton as={Link} to="/comunicaciones/memorandums" tamano="sm" variante="primario" icono={BookOpenCheck}>
          Leer y acusar recibo
        </Boton>
      }
    >
      {pendientes === 1
        ? 'Se emitió un memorándum a su nombre que aún no tiene acuse de recibo.'
        : `Se emitieron ${pendientes} memorándums a su nombre que aún no tienen acuse de recibo.`}
    </Alerta>
  );
}

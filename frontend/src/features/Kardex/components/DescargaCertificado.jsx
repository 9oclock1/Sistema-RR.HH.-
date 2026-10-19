import { useState } from 'react';
import { Download } from 'lucide-react';
import { descargarCertificadoCapacitacion } from '../../../api/kardexApi';
import { Boton, TextoTruncado, useAvisos } from '../../../components/ui';
import { useRol } from '../../../context/sesion';
import { guardarComo } from '../utils/descarga';

export default function DescargaCertificado({ capacitacion }) {
  const rol = useRol();
  const avisar = useAvisos();
  const [descargando, setDescargando] = useState(false);
  const nombre = capacitacion.certificado_nombre_original || capacitacion.certificado_adjunto_url.split('/').pop();

  const descargar = async () => {
    setDescargando(true);
    try {
      guardarComo(await descargarCertificadoCapacitacion(capacitacion.id_capacitacion, { rol }), nombre);
    } catch (error) {
      avisar({ tono: 'peligro', titulo: 'No se pudo descargar el certificado', mensaje: error.message });
    } finally {
      setDescargando(false);
    }
  };

  return (
    <div className="kardex-certificado">
      <Boton
        variante="sutil"
        tamano="sm"
        soloIcono
        icono={Download}
        cargando={descargando}
        aria-label={`Descargar ${nombre}`}
        title={`Descargar ${nombre}`}
        onClick={descargar}
      />
      <TextoTruncado className="kardex-archivo">{nombre}</TextoTruncado>
    </div>
  );
}

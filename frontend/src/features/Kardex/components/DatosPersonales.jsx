import { formatearFecha } from '../../Vacantes/utils/formato';
import { documentoIdentidad } from '../utils/formato';
import { SinDato } from './comunes';

const CAMPOS = [
  { etiqueta: 'Documento de identidad', valor: documentoIdentidad },
  { etiqueta: 'Nombres', valor: (d) => d.nombres },
  { etiqueta: 'Primer apellido', valor: (d) => d.primer_apellido },
  { etiqueta: 'Segundo apellido', valor: (d) => d.segundo_apellido },
  { etiqueta: 'Fecha de nacimiento', valor: (d) => formatearFecha(d.fecha_nacimiento) },
  { etiqueta: 'Género', valor: (d) => d.genero },
  { etiqueta: 'Celular', valor: (d) => d.telefono_celular },
  { etiqueta: 'Correo personal', valor: (d) => d.correo_personal },
  { etiqueta: 'Dirección', valor: (d) => d.direccion_domicilio },
  { etiqueta: 'Fecha de ingreso', valor: (d) => formatearFecha(d.fecha_ingreso) },
  { etiqueta: 'Estado', valor: (d) => d.estado.nombre },
];

export default function DatosPersonales({ datos }) {
  return (
    <dl className="kardex-datos">
      {CAMPOS.map(({ etiqueta, valor }) => (
        <div key={etiqueta} className="kardex-dato">
          <dt>{etiqueta}</dt>
          <dd>{valor(datos) || <SinDato />}</dd>
        </div>
      ))}
    </dl>
  );
}

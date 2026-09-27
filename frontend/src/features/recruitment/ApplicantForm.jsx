import { UserPlus } from "lucide-react";
import { Alerta, Boton, CampoTexto } from "../../components/ui";

/**
 * ApplicantForm Component
 * Formulario de registro de postulante alineado con el sistema de diseño.
 * Usa los componentes base CampoTexto, Boton y Alerta.
 * Muestra errores de validación en línea debajo de cada campo según DESIGN.md.
 */
export default function ApplicantForm({
  formData,
  fieldErrors = {},
  onChange,
  onSubmit,
  onCancel,
  submitting = false,
}) {
  const totalErrores = Object.keys(fieldErrors).length;

  return (
    <form className="postulante-formulario" onSubmit={onSubmit} noValidate>
      {totalErrores > 0 && (
        <Alerta tono="peligro" role="alert">
          El formulario contiene {totalErrores} campo(s) con error. Por favor revise los campos marcados.
        </Alerta>
      )}

      <div className="postulante-formulario__seccion">
        <h3 className="postulante-formulario__subtitulo">Información personal</h3>
        <div className="postulante-formulario__cuadricula">
          <CampoTexto
            id="rf-numero-documento"
            name="numero_documento"
            etiqueta="Número de documento"
            placeholder="Ej: 12345678"
            maxLength={20}
            requerido
            value={formData.numero_documento}
            onChange={onChange}
            error={fieldErrors.numero_documento}
            disabled={submitting}
          />
          <CampoTexto
            id="rf-nombres"
            name="nombres"
            etiqueta="Nombres"
            placeholder="Ej: Juan Carlos"
            maxLength={70}
            requerido
            value={formData.nombres}
            onChange={onChange}
            error={fieldErrors.nombres}
            disabled={submitting}
          />
          <CampoTexto
            id="rf-apellidos"
            name="apellidos"
            etiqueta="Apellidos"
            placeholder="Ej: Pérez Rodríguez"
            maxLength={100}
            requerido
            value={formData.apellidos}
            onChange={onChange}
            error={fieldErrors.apellidos}
            disabled={submitting}
          />
        </div>
      </div>

      <div className="postulante-formulario__seccion">
        <h3 className="postulante-formulario__subtitulo">Datos de contacto</h3>
        <div className="postulante-formulario__cuadricula">
          <CampoTexto
            id="rf-correo"
            name="correo_electronico"
            type="email"
            etiqueta="Correo electrónico"
            placeholder="ejemplo@correo.com"
            maxLength={120}
            requerido
            value={formData.correo_electronico}
            onChange={onChange}
            error={fieldErrors.correo_electronico}
            disabled={submitting}
          />
          <CampoTexto
            id="rf-telefono"
            name="telefono_contacto"
            type="tel"
            etiqueta="Teléfono de contacto"
            placeholder="Ej: +591 71234567"
            maxLength={20}
            requerido
            value={formData.telefono_contacto}
            onChange={onChange}
            error={fieldErrors.telefono_contacto}
            disabled={submitting}
          />
        </div>
      </div>

      <div className="postulante-formulario__seccion">
        <h3 className="postulante-formulario__subtitulo">Residencia</h3>
        <div className="postulante-formulario__cuadricula">
          <CampoTexto
            id="rf-ciudad"
            name="ciudad"
            etiqueta="Ciudad"
            placeholder="Ej: La Paz"
            maxLength={50}
            value={formData.ciudad}
            onChange={onChange}
            error={fieldErrors.ciudad}
            disabled={submitting}
          />
          <CampoTexto
            id="rf-direccion"
            name="direccion_residencia"
            etiqueta="Dirección de residencia"
            placeholder="Ej: Av. 6 de Agosto #2450, Sopocachi"
            maxLength={255}
            className="postulante-formulario__ancho"
            value={formData.direccion_residencia}
            onChange={onChange}
            error={fieldErrors.direccion_residencia}
            disabled={submitting}
          />
        </div>
      </div>

      <div className="postulante-formulario__acciones">
        {onCancel && (
          <Boton
            type="button"
            variante="predeterminado"
            onClick={onCancel}
            disabled={submitting}
          >
            Cancelar
          </Boton>
        )}
        <Boton
          type="submit"
          variante="primario"
          icono={UserPlus}
          cargando={submitting}
        >
          {submitting ? "Registrando postulante…" : "Registrar postulante"}
        </Boton>
      </div>
    </form>
  );
}

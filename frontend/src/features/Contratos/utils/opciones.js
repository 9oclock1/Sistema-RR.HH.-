export const RUTA_CONTRATOS = '/expediente/contratos';

export const TIPOS_MODIFICACION = {
  CONTRATO_INICIAL: 'Contrato inicial',
  RENOVACION: 'Renovación',
  CAMBIO_JORNADA: 'Cambio de jornada',
  AJUSTE_SALARIAL: 'Ajuste salarial',
  AJUSTE_CONDICIONES: 'Ajuste de condiciones',
};

export const DESCRIPCION_MODIFICACION = {
  RENOVACION: 'Nuevo contrato que empieza cuando termina el vigente. Puede cambiar el tipo de contrato, la jornada y el haber.',
  CAMBIO_JORNADA: 'Adenda que cambia la jornada laboral dentro del contrato vigente.',
  AJUSTE_SALARIAL: 'Adenda que cambia el haber mensual dentro del contrato vigente.',
  AJUSTE_CONDICIONES: 'Adenda que formaliza otras condiciones de trabajo; descríbelas en la justificación.',
};

export const MODIFICACIONES = ['RENOVACION', 'CAMBIO_JORNADA', 'AJUSTE_SALARIAL', 'AJUSTE_CONDICIONES'];

export const esAdenda = (tipo) => tipo !== 'CONTRATO_INICIAL' && tipo !== 'RENOVACION';

export const CAMPOS_POR_TIPO = {
  RENOVACION: { tipoContrato: true, fechaFin: true, jornada: true, haber: true },
  CAMBIO_JORNADA: { jornada: true },
  AJUSTE_SALARIAL: { haber: true },
  AJUSTE_CONDICIONES: { jornada: true, haber: true },
};

export const DOCUMENTO = {
  aceptar: '.pdf,.jpg,.jpeg,.png',
  tipos: ['application/pdf', 'image/jpeg', 'image/png'],
  maxMb: 5,
};

export const NUMERO_MAX = 40;
export const JUSTIFICACION_MAX = 2000;
export const MONTO_REGEX = /^\d{1,10}(\.\d{1,2})?$/;

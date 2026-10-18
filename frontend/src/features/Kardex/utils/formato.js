export const documentoIdentidad = ({ numero_documento, complemento_documento }) =>
  complemento_documento ? `${numero_documento}-${complemento_documento}` : numero_documento;

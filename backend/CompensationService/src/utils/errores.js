class ErrorApp extends Error {
  // codigo: identificador estable para que el front distinga el motivo sin tener que parsear el texto
  // del mensaje (que puede cambiar de redacción sin que eso deba romper la UI).
  constructor(estado, mensaje, detalles, codigo) {
    super(mensaje);
    this.estado = estado;
    this.detalles = detalles;
    this.codigo = codigo;
  }
}

module.exports = { ErrorApp };

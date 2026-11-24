class ErrorApp extends Error {
  constructor(estado, mensaje, detalles, codigo) {
    super(mensaje);
    this.estado = estado;
    this.detalles = detalles;
    this.codigo = codigo;
  }
}

module.exports = { ErrorApp };

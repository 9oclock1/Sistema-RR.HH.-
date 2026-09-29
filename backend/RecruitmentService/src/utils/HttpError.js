class HttpError extends Error {
  constructor(status, message, detalles = {}) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.detalles = detalles;
  }
}

module.exports = HttpError;

// Formato: "CODIGO:clave,CODIGO2:clave2". Devuelve clave -> código de dispositivo.
function leerDispositivos(texto = "") {
  const dispositivos = new Map();
  for (const entrada of texto.split(",")) {
    const separador = entrada.indexOf(":");
    const codigo = entrada.slice(0, separador).trim();
    const clave = entrada.slice(separador + 1).trim();
    if (separador > 0 && codigo && clave) dispositivos.set(clave, codigo);
  }
  return dispositivos;
}

module.exports = { leerDispositivos };

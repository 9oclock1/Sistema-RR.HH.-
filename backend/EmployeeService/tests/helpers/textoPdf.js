const zlib = require('node:zlib');

const flujosDe = (pdf) =>
  [...pdf.toString('latin1').matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)].flatMap(([, contenido]) => {
    try {
      return [zlib.inflateSync(Buffer.from(contenido, 'latin1')).toString('latin1')];
    } catch {
      return [];
    }
  });

const decodificar = (hex) => Buffer.from(hex.length % 2 ? `${hex}0` : hex, 'hex').toString('latin1');

const lineasDe = (flujo) =>
  [...flujo.matchAll(/\[([^\]]*)\]\s*TJ/g)].map(([, trozos]) =>
    [...trozos.matchAll(/<([0-9a-fA-F]*)>/g)].map(([, hex]) => decodificar(hex)).join('')
  );

const textoDelPdf = (pdf) => flujosDe(pdf).flatMap(lineasDe).join('\n');

const paginasDelPdf = (pdf) => (pdf.toString('latin1').match(/\/Type \/Page(?!s)/g) || []).length;

module.exports = { textoDelPdf, paginasDelPdf };

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { leerAnonima, validarQueja } = require("../utils/quejas");

const CATEGORIAS = new Set([1, 2, 3, 4]);
const VALIDA = {
  id_categoria_queja: "2",
  asunto: "Gritos en el turno noche",
  descripcion: "El encargado grita al personal de cajas casi todos los días.",
  anonima: "true",
};

const erroresDe = (cuerpo) => {
  try {
    validarQueja(cuerpo, CATEGORIAS);
  } catch (error) {
    assert.equal(error.estado, 400);
    assert.equal(error.message, "Revise los datos de la queja.");
    return Object.fromEntries(error.detalles.map(({ campo, mensaje }) => [campo, mensaje]));
  }
  assert.fail("la validación debía fallar");
};

describe("RF-68: validación de la queja", () => {
  it("acepta una queja completa y recorta los espacios", () => {
    const datos = validarQueja({ ...VALIDA, asunto: "  Gritos en el turno noche  " }, CATEGORIAS);
    assert.deepEqual(datos, {
      asunto: "Gritos en el turno noche",
      descripcion: VALIDA.descripcion,
      idCategoria: 2,
      anonima: true,
    });
  });

  it("sin datos, informa cada campo obligatorio con un mensaje en español", () => {
    assert.deepEqual(erroresDe({}), {
      id_categoria_queja: "Seleccione la categoría de la queja.",
      asunto: "Escriba el asunto de la queja.",
      descripcion: "Describa lo ocurrido.",
      anonima: "Indique si desea enviar la queja de forma anónima.",
    });
  });

  it("solo con espacios cuenta como vacío", () => {
    const errores = erroresDe({ ...VALIDA, asunto: "   ", descripcion: "\n\t " });
    assert.equal(errores.asunto, "Escriba el asunto de la queja.");
    assert.equal(errores.descripcion, "Describa lo ocurrido.");
  });

  it("rechaza una categoría que no está en el catálogo", () => {
    assert.equal(erroresDe({ ...VALIDA, id_categoria_queja: "9" }).id_categoria_queja, "La categoría seleccionada no existe.");
    assert.equal(erroresDe({ ...VALIDA, id_categoria_queja: "acoso" }).id_categoria_queja, "La categoría seleccionada no existe.");
  });

  it("controla el largo del asunto y la descripción", () => {
    assert.equal(erroresDe({ ...VALIDA, asunto: "abcd" }).asunto, "El asunto debe tener al menos 5 caracteres.");
    assert.equal(erroresDe({ ...VALIDA, asunto: "a".repeat(151) }).asunto, "El asunto puede tener hasta 150 caracteres.");
    assert.equal(erroresDe({ ...VALIDA, descripcion: "muy corta" }).descripcion, "La descripción debe tener al menos 20 caracteres.");
    assert.equal(
      erroresDe({ ...VALIDA, descripcion: "a".repeat(5001) }).descripcion,
      "La descripción puede tener hasta 5000 caracteres.",
    );
  });

  it("exige indicar explícitamente si la queja es anónima", () => {
    for (const valor of [undefined, "", "si", "1", 1]) {
      assert.equal(erroresDe({ ...VALIDA, anonima: valor }).anonima, "Indique si desea enviar la queja de forma anónima.");
    }
  });

  it("lee anonima desde formulario (texto) o JSON (booleano)", () => {
    assert.equal(leerAnonima("true"), true);
    assert.equal(leerAnonima(true), true);
    assert.equal(leerAnonima("false"), false);
    assert.equal(leerAnonima(false), false);
    assert.equal(leerAnonima("TRUE"), null);
  });
});

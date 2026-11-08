# Aclaracion

La base no usa triggers, procedimientos almacenados ni vistas (decisión del equipo): las reglas marcadas como "servicio" las valida CompensationService.

## Referencias a otros servicios (sin FK)

- `id_empleado` de `ASIGNACIONES_CONDICION`, `BONOS_CONDICION` y `PLANILLA_EMPLEADOS` debería hacer referencia a id_empleado de EmployeeDB.
- `generada_por` y `aprobada_por` de `PLANILLAS` deberían hacer referencia a id_empleado de EmployeeDB (el Administrador que actuó).
- `id_contrato` de `PLANILLA_EMPLEADOS` debería hacer referencia a id_contrato de `CONTRATOS` en EmployeeDB (la última versión del contrato en el mes).
- Nombre, cargo, área, sucursal y haber se copian al generar la planilla: no cambian si después cambian en EmployeeDB.

## Conceptos y condiciones

- Un concepto usado (vigencias referenciadas por `BONOS_CONDICION` o `NOVEDADES_PLANILLA`) no se puede eliminar, solo inactivar (FK sin CASCADE).

## Planillas

- Una planilla por mes (`periodo` AAAA-MM). Estados: `BORRADOR` → `APROBADA` → `CERRADA`.
- Servicio: solo un borrador se vuelve a generar, se descarta o se aprueba. Cada escritura lleva la condición `estado = 'BORRADOR'` y se hace con la fila bloqueada (`FOR UPDATE`), así una planilla aprobada no cambia ni pierde su detalle.
- Servicio: solo se aprueba un mes completo (`datos_hasta` = `fecha_fin`) con al menos un colaborador y ninguno con `alertas` de inconsistencia (líquido negativo, totales que no cuadran, concepto de cálculo faltante).
- `CALCULOS_PLANILLA` guarda un renglón por concepto con su vigencia. Cada renglón se redondea a centavos y los totales de `PLANILLA_EMPLEADOS` son la suma de los renglones (`liquido_pagable = total_ganado - total_descuentos`, también como CHECK). Los aportes patronales no se descuentan.
- Los conceptos `HABER-BASICO`, `HORAS-EXTRA`, `DOMINICAL`, `RECARGO-NOCTURNO` y `ANS-*` los calcula el servicio con las novedades del mes; los demás conceptos activos con valor al cierre del mes se aplican a todos los colaboradores, salvo los de condiciones especiales (llegan como bonos).
- Base: `CERRADA` exige las confirmaciones de Contabilidad y Pagos (`chk_planilla_cierre`); un borrador no tiene respuestas, un rechazo lleva motivo y solo una confirmación lleva referencia (`chk_planilla_respuestas`).
- Servicio: una integración rechazada deja la planilla `APROBADA`; se reenvía con un mensaje nuevo y vuelve a `PENDIENTE`. Una integración confirmada ya no cambia.
- `EVENTOS_SALIENTES` es la bandeja de salida: el evento se guarda en la misma transacción que la aprobación y se envía después.
- Servicio: no se aprueba si algún concepto con monto en la planilla no tiene cuenta contable (el asiento no se podría armar).

## Integración con Contabilidad (D) y Pagos (A)

Al aprobar la planilla se guardan dos mensajes en `EVENTOS_SALIENTES` y un despachador los publica cada 5 segundos en el tópico de RRHH (`ucb-sis323-sub-f`). Si Pub/Sub no responde, el mensaje sigue pendiente y se reintenta con espera creciente (30 s, 1 min, 2 min… hasta 1 h), sin perderse. Solo un error permanente (tópico inexistente, mensaje rechazado) lo deja `FALLIDO`; se reenvía con `POST /planillas/:id/integraciones/:destino/reenviar`.

Sobre común del equipo (el `id_mensaje` sirve para descartar duplicados; Pub/Sub puede entregar dos veces):

```json
{
  "encabezado": {
    "id_mensaje": "uuid",
    "origen": { "grupo": "F", "modulo": "RRHH" },
    "destino": { "grupo": "D", "modulo": "Contabilidad" },
    "tipo": "PLANILLA_APROBADA_ASIENTO",
    "fecha": "2026-11-02T14:05:00.000Z",
    "version_esquema": 1
  },
  "datos": { }
}
```

Atributos de Pub/Sub (para filtrar sin leer el cuerpo): `id_mensaje`, `origen`, `origen_modulo`, `destino`, `destino_modulo`, `tipo`, `version_esquema`.

### Asiento para Contabilidad: `PLANILLA_APROBADA_ASIENTO` (destino D)

```json
{
  "id_planilla": "uuid", "periodo": "2026-10",
  "aprobada": { "por": { "id_empleado": "uuid", "nombre_completo": "…" }, "en": "2026-11-02T14:05:00.000Z" },
  "fecha_contable": "2026-10-31",
  "glosa": "Planilla de sueldos y salarios de octubre de 2026",
  "moneda": "BOB",
  "renglones": [
    { "cuenta": { "codigo": "5.1.1.01", "nombre": "Sueldos y salarios" }, "debe": 25000.00, "haber": 0, "conceptos": ["HABER-BASICO"] },
    { "cuenta": { "codigo": "5.1.2.01", "nombre": "Cargas sociales patronales" }, "debe": 4177.50, "haber": 0, "conceptos": ["CNS-SALUD", "…"] },
    { "cuenta": { "codigo": "2.1.3.01", "nombre": "Aportes laborales por pagar" }, "debe": 0, "haber": 3177.50, "conceptos": ["SIP-VEJEZ", "…"] },
    { "cuenta": { "codigo": "2.1.3.02", "nombre": "Aportes patronales por pagar" }, "debe": 0, "haber": 4177.50, "conceptos": [] },
    { "cuenta": { "codigo": "2.1.2.01", "nombre": "Sueldos y salarios por pagar" }, "debe": 0, "haber": 21822.50, "conceptos": [] }
  ],
  "total_debe": 29177.50, "total_haber": 29177.50,
  "resumen": { "colaboradores": 8, "total_ganado": 25000.00, "total_descuentos": 3177.50, "liquido_pagable": 21822.50, "total_aportes": 4177.50 }
}
```

- Debe: haberes y aportes patronales en la cuenta de cada concepto. Haber: descuentos en la cuenta de cada concepto, los aportes patronales por pagar (2.1.3.02) y el líquido pagable como sueldos por pagar (2.1.2.01). Siempre cuadra.
- Las cuentas 2.1.2.01 y 2.1.3.02 y las de los conceptos sembrados son referenciales: ajustarlas al plan de cuentas de Contabilidad (las de los conceptos se cambian en Conceptos de pago).

### Orden de dispersión para Pagos: `PLANILLA_APROBADA_ORDEN_PAGO` (destino A)

```json
{
  "id_planilla": "uuid", "periodo": "2026-10",
  "aprobada": { "por": { "id_empleado": "uuid", "nombre_completo": "…" }, "en": "2026-11-02T14:05:00.000Z" },
  "concepto": "Pago de sueldos de octubre de 2026",
  "moneda": "BOB",
  "cantidad_beneficiarios": 8,
  "total": 21822.50,
  "beneficiarios": [
    { "id_empleado": "uuid", "nombre_completo": "Ana Pérez", "numero_documento": "1234567", "monto": 3491.60 }
  ]
}
```

- Un beneficiario por colaborador con líquido mayor a cero. RRHH no guarda cuentas bancarias: Pagos identifica a cada colaborador por `id_empleado` y `numero_documento`.

### Confirmaciones de Contabilidad y Pagos

Cada sistema responde en su propio tópico (`ucb-sis323-sub-d`, `ucb-sis323-sub-a`); RRHH los lee con suscripciones propias (`<tópico>-rrhh-planillas`, se crean si faltan) y solo toma los mensajes con `destino.grupo = "F"` y uno de estos tipos:

| Tipo | Lo envía | Responde a |
|---|---|---|
| `CONFIRMACION_ASIENTO_PLANILLA` | D (Contabilidad) | `PLANILLA_APROBADA_ASIENTO` |
| `CONFIRMACION_ORDEN_PAGO_PLANILLA` | A (Pagos) | `PLANILLA_APROBADA_ORDEN_PAGO` |

```json
{
  "encabezado": {
    "id_mensaje": "id propio del remitente",
    "origen": { "grupo": "D", "modulo": "Contabilidad" },
    "destino": { "grupo": "F", "modulo": "RRHH" },
    "tipo": "CONFIRMACION_ASIENTO_PLANILLA",
    "fecha": "2026-11-02T14:06:10.000Z",
    "version_esquema": 1
  },
  "datos": {
    "id_planilla": "uuid de la planilla",
    "id_mensaje_origen": "id_mensaje del envío de RRHH que se responde",
    "resultado": "CONFIRMADA",
    "referencia": "AS-2026-0458",
    "motivo": null
  }
}
```

- `resultado`: `CONFIRMADA` (con `referencia` opcional: número de asiento u orden, hasta 60 caracteres) o `RECHAZADA` (con `motivo` obligatorio, hasta 255).
- Con las dos confirmaciones la planilla pasa a `CERRADA`. Una respuesta a un envío anterior (la planilla se reenvió después) o a una integración ya confirmada se registra como `IGNORADO`.
- `EVENTOS_ENTRANTES` guarda cada mensaje una sola vez por `id_mensaje` (los duplicados de Pub/Sub no cambian nada). Un mensaje inválido (tipo enviado por otro grupo, datos faltantes, planilla o envío inexistente) queda `FALLIDO` sin reintentos; un error pasajero se reintenta con nueva entrega (2 s, 4 s, 8 s…) y tras 5 intentos queda `FALLIDO`. Es la cola de mensajes fallidos: `GET /confirmaciones?estado=FALLIDO` y `POST /confirmaciones/:id/reprocesar`.

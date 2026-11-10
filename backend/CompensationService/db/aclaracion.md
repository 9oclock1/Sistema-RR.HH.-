# Aclaracion

La base no usa triggers, procedimientos almacenados ni vistas (decisión del equipo): las reglas marcadas como "servicio" las valida CompensationService.

## Referencias a otros servicios (sin FK)

- `id_empleado` de `ASIGNACIONES_CONDICION`, `BONOS_CONDICION`, `PLANILLA_EMPLEADOS`, `METRICAS_VENTAS_PERIODO` y `BONOS_PRODUCTIVIDAD` debería hacer referencia a id_empleado de EmployeeDB.
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
- `BONO-ANTIGUEDAD`: porcentaje del tramo de la escala vigente el día 1 del mes (`TRAMOS_ANTIGUEDAD`) sobre el haber del contrato, por los días pagados. Sin escala vigente o sin fecha de ingreso, el colaborador queda con alerta; por debajo del primer tramo no lleva bono.
- `CUOTA-PRESTAMO`: cada cuota `PENDIENTE` del mes de `CUOTAS_PRESTAMO` se descuenta por su monto. Estos dos renglones no tienen vigencia de concepto (`id_vigencia` NULL, `chk_calculo_origen`).
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
- `BONO-ANTIGUEDAD` y `CUOTA-PRESTAMO` no tienen vigencia: el bono usa la cuenta de su concepto (5.1.1.05) y las cuotas, que no son un concepto, van al haber de préstamos y anticipos al personal (1.1.4.01).
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

## Bonos de productividad (RF-51, KAN-71)

- `REGLAS_BONO_PRODUCTIVIDAD`: una regla activa por `periodo` y `tipo_meta` (ventas, puntualidad o desempeño en caja), con su umbral de cumplimiento y su monto fijo o porcentaje. Una regla ya usada en `BONOS_PRODUCTIVIDAD` solo se inactiva, no se elimina (FK sin CASCADE).
- `EVENTOS_VENTAS_ENTRANTES` es la bandeja de entrada del cierre de ventas del periodo que publica Ventas y Marketing (grupo E) por Pub/Sub: `id_mensaje` (del remitente) evita procesar dos veces el mismo mensaje (criterio 4). Mismo patrón RECIBIDO/PROCESADO/IGNORADO/FALLIDO que una bandeja de salida, pero de entrada.
- `METRICAS_VENTAS_PERIODO` guarda una fila por colaborador y periodo (clave `periodo, id_empleado`); un cierre reenviado con un `id_mensaje` nuevo (una corrección, no un duplicado) reemplaza la fila anterior del colaborador.
- El motor (servicio) se ejecuta en la misma transacción que registra las métricas: aplica cada regla activa del periodo a sus métricas y reemplaza los bonos anteriores del periodo en `BONOS_PRODUCTIVIDAD` (solo a quienes superan el umbral, criterio 3). También se puede volver a ejecutar manualmente si una regla cambia después del cierre.
- `BONO-PRODUCTIVIDAD` es un concepto de ingreso sin vigencia manual (como `BONO-ANTIGUEDAD`): el monto fijo o el porcentaje sobre el haber básico lo define la regla vigente del periodo, y llega a la planilla como bono (igual que `BONOS_CONDICION`). En `NOVEDADES_PLANILLA` va con `origen` `PRODUCTIVIDAD` y sin vigencia (`chk_novedad_planilla_vigencia`), y en `CALCULOS_PLANILLA` también sin vigencia (`chk_calculo_origen`). Su cuenta contable es 5.1.1.06 (referencial).

## Integración con Ventas y Marketing (E)

RRHH pide el cierre del periodo publicando `SOLICITUD_CIERRE_VENTAS_PERIODO` en su tópico (ver abajo) y se suscribe a la respuesta en `projects/project-a96e5fe1-5ba6-4698-a85/topics/ucb-sis323-sub-e`, con la
suscripción propia `ucb-sis323-sub-e<PUBSUB_SUFIJO_SUSCRIPCION_VENTAS>` (se crea si falta, ver
`ventasProductividad.service.escuchar`). Mismo sobre común que el resto del ERP:

```json
{
  "encabezado": {
    "id_mensaje": "id propio del remitente (evita procesar dos veces el mismo mensaje)",
    "origen": { "grupo": "E", "modulo": "Ventas y Marketing" },
    "destino": { "grupo": "F", "modulo": "RRHH" },
    "tipo": "CIERRE_VENTAS_PERIODO",
    "fecha": "2026-11-02T06:00:00.000Z",
    "version_esquema": 1
  },
  "datos": {
    "periodo": "2026-10",
    "fecha_inicio": "2026-10-01",
    "fecha_fin": "2026-10-31",
    "metricas": [
      { "id_empleado": "uuid del vendedor o cajero", "rol": "VENDEDOR", "monto_ventas": 15000.00, "cuota_asignada": 12000.00 },
      { "id_empleado": "uuid del vendedor o cajero", "rol": "CAJERO", "monto_ventas": 6000.00, "cuota_asignada": 10000.00 }
    ]
  }
}
```

- `datos.periodo` (AAAA-MM) es la clave del cierre; `fecha_inicio`/`fecha_fin` son solo referenciales (el cálculo usa `periodo`, no se validan contra el rango de días del mes).
- `rol`: `VENDEDOR` o `CAJERO`. `monto_ventas` ≥ 0, `cuota_asignada` > 0; `% cumplimiento = monto_ventas / cuota_asignada × 100`, calculado por RRHH (Ventas no lo envía).
- Hasta 500 colaboradores por mensaje; mensajes más grandes se parten del lado de Ventas.
- `EVENTOS_VENTAS_ENTRANTES` guarda cada mensaje una sola vez por `id_mensaje` (los duplicados de Pub/Sub no cambian nada, criterio 4). Un mensaje sin ningún colaborador válido (sobre inválido, periodo inválido, o los datos de todos los colaboradores inválidos) queda `FALLIDO` sin reintentos.
- Un colaborador con datos inválidos (UUID mal formado, `rol` que no es `VENDEDOR`/`CAJERO`, número faltante o fuera de rango) o repetido en el mismo mensaje no descarta a los demás: ese colaborador queda fuera del cálculo y el motivo se anota en `detalle` del evento (consultable con `GET /bonos-productividad/eventos`), mientras el resto sí recibe su bono. Solo si ningún colaborador del mensaje es válido el evento completo queda `FALLIDO`.
- Un error pasajero (la base, por ejemplo) se reintenta con nueva entrega (2 s, 4 s, 8 s… hasta 1 min) y tras 5 intentos queda `FALLIDO`: cola de mensajes fallidos con `GET /bonos-productividad/eventos?estado=FALLIDO` y `POST /bonos-productividad/eventos/:id/reprocesar`.

### Solicitud del cierre de ventas: `SOLICITUD_CIERRE_VENTAS_PERIODO` (destino E)

El Administrador la envía desde Bonos por productividad (`POST /bonos-productividad/solicitudes-cierre` con `{ periodo }`). Se guarda en `EVENTOS_SALIENTES` sin planilla ni destino de planilla (`id_planilla` y `destino` NULL) y el mismo despachador de la planilla aprobada la publica en el tópico de RRHH (`ucb-sis323-sub-f`), con los mismos reintentos. No se encola otra del mismo mes mientras la anterior siga pendiente; `GET /bonos-productividad/solicitudes-cierre?periodo=AAAA-MM` devuelve la última y su estado de envío.

```json
{
  "encabezado": {
    "id_mensaje": "uuid",
    "origen": { "grupo": "F", "modulo": "RRHH" },
    "destino": { "grupo": "E", "modulo": "Ventas y Marketing" },
    "tipo": "SOLICITUD_CIERRE_VENTAS_PERIODO",
    "fecha": "2026-11-09T14:00:00.000Z",
    "version_esquema": 1
  },
  "datos": {
    "periodo": "2026-10",
    "fecha_inicio": "2026-10-01",
    "fecha_fin": "2026-10-31",
    "solicitada": { "por": { "id_empleado": "uuid", "nombre_completo": "…" }, "en": "2026-11-09T14:00:00.000Z" },
    "respuesta_esperada": { "tipo": "CIERRE_VENTAS_PERIODO", "topico": "ucb-sis323-sub-e" },
    "cantidad_colaboradores": 2,
    "colaboradores": [
      { "id_empleado": "uuid", "nombre_completo": "Ana Pérez", "numero_documento": "1234567", "cargo": "Cajero", "sucursal": "Sopocachi" }
    ]
  }
}
```

- `colaboradores`: el personal activo de EmployeeService, para que Ventas relacione a sus vendedores y cajeros con el `id_empleado` de RRHH.

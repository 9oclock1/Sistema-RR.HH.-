# Aclaracion

La base no usa triggers, procedimientos almacenados ni vistas (decisión del equipo): las reglas marcadas como "servicio" las valida CompensationService.

## Referencias a otros servicios (sin FK)

- `id_empleado` de `ASIGNACIONES_CONDICION`, `BONOS_CONDICION`, `PLANILLA_EMPLEADOS`, `METRICAS_VENTAS_PERIODO`, `BONOS_PRODUCTIVIDAD` y `BOLETAS_PAGO` debería hacer referencia a id_empleado de EmployeeDB.
- `generada_por` y `aprobada_por` de `PLANILLAS` deberían hacer referencia a id_empleado de EmployeeDB (el Administrador que actuó).
- `id_contrato` de `PLANILLA_EMPLEADOS` debería hacer referencia a id_contrato de `CONTRATOS` en EmployeeDB (la última versión del contrato en el mes).
- Nombre, cargo, área, sucursal y haber se copian al generar la planilla: no cambian si después cambian en EmployeeDB.

## Conceptos y condiciones

- Un concepto usado (vigencias referenciadas por `BONOS_CONDICION` o `NOVEDADES_PLANILLA`) no se puede eliminar, solo inactivar (FK sin CASCADE).

## Historial y auditoría de bonificaciones (RF-53, KAN-73)

- `BONOS_CONDICION` ya es el historial por colaborador: `reemplazarProceso` solo borra los bonos del periodo que se reprocesa, los de otros periodos quedan. El endpoint `GET /bonificaciones/empleados/:idEmpleado` lee de ahí, con filtros por periodo, tipo de condición y sucursal (del colaborador en EmployeeService), y exporta a CSV con `?formato=csv`.
- `AUDITORIA_BONIFICACIONES` registra lo que `BONOS_CONDICION` no puede, porque se reemplaza por completo en cada reproceso: quién, cuándo y el valor anterior de cada alta, modificación o anulación. Servicio: dentro de la misma transacción que reemplaza los bonos, se compara el proceso anterior del periodo con el nuevo (misma condición, colaborador, vigencia y asignación) y solo se guarda una fila si algo cambió (valor, monto o factor); un reproceso sin novedades no escribe nada.
- `GET /bonificaciones/auditoria` exige un colaborador o un periodo (si no, la consulta no tiene cómo acotarse). Ambos endpoints de bonificaciones son solo para los roles `admin` o `auditor` (cabecera `X-Rol`, temporal hasta contar con autenticación).

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

## Boletas de pago (RF-46, KAN-66)

- `BOLETAS_PAGO`: una boleta por colaborador y planilla `CERRADA` (`uq_boleta_planilla_empleado`, `uq_boleta_empleado_periodo`). Servicio: no se emite boleta de una planilla en borrador o aprobada.
- El detalle no se copia: se lee de `PLANILLA_EMPLEADOS` y `CALCULOS_PLANILLA`, que en una planilla cerrada ya no cambian. Las FK sin `CASCADE` impiden borrar una planilla con boletas.
- `hash_contenido` es el SHA-256 del contenido de la boleta al emitirla. Servicio: se vuelve a calcular en cada consulta y descarga; si no coincide, la boleta no se entrega (409).
- `descargas` y `ultima_descarga_en` registran las descargas del PDF.
- Servicio: la boleta se emite la primera vez que el colaborador consulta sus boletas (`GET /boletas`), para cada planilla cerrada que aún no la tenga; así también quedan cubiertas las planillas cerradas antes de esta historia. `GET /boletas/:id` devuelve el detalle y `GET /boletas/:id/pdf` el PDF.
- Acceso (JWT/RBAC): la identidad sale del JWT que firma AuthService al iniciar sesión (cookie `rrhh_sesion` o `Authorization: Bearer`), verificado con `JWT_SECRET` (el mismo de AuthService). Las cabeceras `X-Empleado-Id` y `X-Rol` se ignoran en estas rutas. Sin token, o con un token alterado o vencido, 401; cada colaborador ve solo sus boletas y la de otro responde 403; el rol `admin` (RRHH) del token puede ver cualquiera.

## Planilla de aguinaldos (RF-47, KAN-67)

- `PLANILLA_AGUINALDO` (cabecera, una por `gestion`) y `AGUINALDO_EMPLEADOS` (detalle) son tablas propias, separadas de `PLANILLAS`: el aguinaldo no tiene asistencia, horas extra ni conceptos por renglón, solo el monto de la duodécima. Mismo ciclo de vida que la planilla mensual: `BORRADOR` → `APROBADA` (se publica el asiento y la orden de dispersión) → `CERRADA` (ambas confirmaciones llegaron). Los mismos CHECK de `PLANILLAS` (aprobación, integraciones, cierre, respuestas) se repiten aquí.
- Gestión: del 1 de diciembre del año anterior al 30 de noviembre de `gestion` (criterio implícito: no se genera si esa fecha es futura). Ejemplo: `gestion=2026` cubre 2025-12-01 a 2026-11-30.
- Duodécimas (criterio 1): meses calendario completos (por aniversario de día del mes, igual que `aniosDeServicio`) más los días reales del mes incompleto — no un mes comercial de 30 días fijo, para que trabajar toda la gestión dé exactamente 12 meses y 0 días. `monto = promedio_sueldo * (meses + dias/30) / 12`.
- Promedio de los tres últimos sueldos (criterio 1): el haber vigente en el último mes trabajado y los dos anteriores (vía el historial completo de contrato del colaborador — `/contratos/vigentes` tiene un tope de 92 días, insuficiente para una gestión de 12 meses), promediando con los que existan si ingresó hace menos de 3 meses.
- Exclusión (criterio 2): menos de 3 meses de servicio en la gestión; queda en `AGUINALDO_EMPLEADOS` con `excluido = TRUE` y el motivo, monto 0 (no se omite la fila: así se ve quién se evaluó y por qué no le corresponde).
- Retiro durante la gestión: EmployeeService no guarda una fecha de baja explícita. Para un colaborador inactivo se usa el fin de su última versión de contrato (si no se renovó) como aproximación; sin esa fecha, o si sigue activo, se cuenta hasta hoy o el fin de la gestión.
- `EVENTOS_SALIENTES` y `EVENTOS_ENTRANTES` ganan la columna `id_aguinaldo` (además de `id_planilla`): la misma bandeja de salida y el mismo despachador de la planilla mensual sirven para el aguinaldo (criterio 3 y 5), nunca con los dos id a la vez (`chk_evento_recurso_unico`). Los tipos de mensaje son propios (`AGUINALDO_APROBADO_ASIENTO`, `AGUINALDO_APROBADO_ORDEN_PAGO`, `CONFIRMACION_ASIENTO_AGUINALDO`, `CONFIRMACION_ORDEN_PAGO_AGUINALDO`); `utils/integraciones.leerConfirmacion` identifica el recurso (`PLANILLA` o `AGUINALDO`) por el tipo y lee `datos.id_planilla` o `datos.id_aguinaldo` según corresponda. `confirmaciones.service.aplicar` es el mismo código para ambos recursos.
- El asiento del aguinaldo es simple: debe la cuenta de gasto de aguinaldos (5.1.1.06, referencial), haber sueldos y salarios por pagar (2.1.2.01); sin descuentos de ley en este alcance (no está en los criterios de aceptación).
- **Base de datos creada antes de KAN-67:** Postgres solo corre `init.sql` una vez, al crear el volumen por primera vez. Un entorno que ya existía antes de que estas tablas se agregaran no las recibe solo, y el reporte contable de aguinaldos (RF-49, KAN-69) falla con un error de "relación no existe" (el backend ahora lo devuelve como 503 con el mensaje de qué falta, en vez de un 500 genérico). Para corregirlo sin perder datos: `docker exec -i rrhh-postgres psql -U adminRRHH -d CompensationDB < backend/CompensationService/db/migraciones/001_planilla_aguinaldos.sql` (es idempotente, se puede correr las veces que haga falta). Para recrear todo desde cero en vez de migrar (pierde todos los datos de `CompensationDB`): `docker compose down -v && docker compose up -d`.

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

## Desvinculación (RF-54, KAN-74)

- `CAUSALES_DESVINCULACION` es el catálogo de motivos formales de baja (`RENUNCIA`, `CONCLUSION_CONTRATO`, `DESPIDO_LEGAL`, `DESAHUCIO`) y define si corresponde pago de desahucio.
- `PROCESOS_DESVINCULACION` registra cada proceso de liquidación con sus datos históricos copiados al momento del registro (incluyendo `corresponde_desahucio`, que queda fijo aunque el catálogo cambie después), y `DOCUMENTOS_DESVINCULACION` almacena el respaldo binario en tabla aparte (1 a 1) para no sobrecargar los listados.
- Se consideran procesos abiertos los que tienen estado `INICIADO` o `EN_CURSO`; el índice único parcial `uq_proceso_abierto_empleado` impide en base de datos que un mismo colaborador tenga dos procesos abiertos al mismo tiempo.
- El servicio valida la existencia y estado activo del colaborador contra EmployeeService y lo pasa a estado `BAJA` dentro de la misma transacción en que registra el proceso.

## Sueldo promedio indemnizable (RF-55, KAN-75)

- **Regla de cálculo:** sobre un proceso de desvinculación abierto (`INICIADO` o `EN_CURSO`), toma las últimas planillas en estado `CERRADA` del colaborador hasta el mes de la `fecha_retiro` (máximo 3) y promedia su `total_ganado` en centavos con redondeo mitad hacia arriba. Si hay menos de 3 meses, promedia los disponibles y registra la observación; también advierte si falta el mes del retiro, si hay huecos entre los periodos o si algún mes tiene menos de 30 días pagados.
- **Copia por mes:** `DETALLE_PROMEDIO_INDEMNIZABLE` guarda `dias_pagados`, `haber_mensual` y `total_ganado` al momento del cálculo para dejar fija la base legal del finiquito.
- **Recálculo:** mientras el proceso siga abierto, volver a calcular reemplaza la cabecera en `PROMEDIOS_INDEMNIZABLES` y su detalle, útil cuando se cierra posteriormente la planilla del mes de retiro.
- **Estado del proceso:** al realizar el primer cálculo, el proceso pasa automáticamente de `INICIADO` a `EN_CURSO`.

## Indemnización y desahucio (RF-56, KAN-76)

- **Base:** el sueldo promedio indemnizable de KAN-75 (`PROMEDIOS_INDEMNIZABLES.promedio`); sin promedio calculado no se calcula. `BENEFICIOS_SOCIALES.promedio_base` guarda la copia usada: si el promedio se recalcula después, el cálculo se informa como desactualizado.
- **Tiempo de servicio:** de `fecha_ingreso` a `fecha_retiro`, contando ambos días. Años y meses calendario completos; los días restantes van a `dias_fraccion`.
- **Indemnización (LGT art. 13, DS 110):** corresponde con más de 90 días de servicio, también en renuncia o conclusión de contrato. Monto = promedio × años + promedio × meses / 12 + promedio × días / 360. No corresponde en despido por causa justificada (`DESPIDO_LEGAL`, LGT art. 16).
- **Desahucio (LGT art. 12):** tres sueldos promedio cuando `PROCESOS_DESVINCULACION.corresponde_desahucio` es verdadero (causal `DESAHUCIO`), salvo en los primeros 90 días (período de prueba, LGT art. 13).
- **Detalle:** `DETALLE_BENEFICIOS_SOCIALES` guarda un renglón por años, meses, días y desahucio con su cantidad y divisor. Montos en centavos con redondeo mitad hacia arriba; el total es la suma de los renglones.
- **Recálculo:** solo en procesos abiertos; reemplaza la cabecera y su detalle.

## Rotación de personal (RF-75, KAN-95)

- No agrega tablas. `GET /indicadores/rotacion` lee las bajas de `PROCESOS_DESVINCULACION` (todo estado salvo `ANULADO`; si un colaborador tiene varias, la de retiro más reciente) con su causal, y cruza el personal de EmployeeService (`GET /empleados`: fecha de ingreso, sucursal y área actuales, estado).
- `fecha_retiro` es el último día trabajado: la baja cuenta en ese mes y el colaborador ya no está en la plantilla al cierre de ese día. Un colaborador en `BAJA` sin proceso registrado no tiene fecha de retiro y queda fuera de los cálculos; la respuesta lo informa en `avisos.bajas_sin_registro`.
- Acceso: exige sesión real (`middlewares/autenticar.js`, el mismo JWT de AuthService que usan las boletas); el colaborador y su rol salen del token y se ignoran `X-Empleado-Id` y `X-Rol`. Administrador y Gerente ven toda la cadena; un supervisor, solo la sucursal donde trabaja según EmployeeService (pedir otra responde 403); los demás roles, 403.
- Datos de ejemplo: `seed-rotacion.sql` de EmployeeService (sucursal Calacoto y 65 colaboradores, con ingresos mes a mes), el de AuthService (cuenta de la supervisora de Calacoto, ver `CUENTAS-DE-PRUEBA.md`) y luego el de este servicio (10 bajas con las 4 causales). Las fechas de los últimos 12 meses son relativas al mes actual de La Paz. Con los seeds base de ambos servicios, el mes actual muestra rotación 3% (verde), retención 90,3% (verde) y rotación temprana 15,8% (amarillo).

## Saldos proporcionales del finiquito (KAN-77)

- `SALDOS_PROPORCIONALES` guarda el último cálculo de cada proceso de liquidación (1 a 1, recalcular lo reemplaza) con la copia de los datos usados: sueldo promedio, saldo de vacaciones y tiempos. Calcula el Administrador de RRHH sobre un proceso abierto (lo pasa de `INICIADO` a `EN_CURSO`); el Contador lo consulta en solo lectura.
- **Valorización:** con el sueldo promedio indemnizable del proceso (RF-55, `PROMEDIOS_INDEMNIZABLES`); si todavía no se calculó, se calcula primero con su propia regla. Sueldo diario = promedio / 30.
- **Duodécimas de aguinaldo (criterio 1):** gestión en curso al retiro (1 de diciembre al 30 de noviembre, igual que RF-47), meses y días trabajados en ella hasta la fecha de retiro: `promedio × (meses + días/30) / 12`. Sin pago con menos de 3 meses en la gestión, ni si su aguinaldo de esa gestión ya se liquidó en una planilla de aguinaldos aprobada o cerrada (se informa en observaciones).
- **Vacaciones no gozadas (criterio 2):** días acreditados menos gozados según el módulo de vacaciones de AttendanceService al día del retiro (`GET /vacaciones/empleados/:id/saldo?fecha=AAAA-MM-DD`, parámetro nuevo); los días en proceso de goce se pagan como no gozados y se informa. `días × sueldo diario`.
- **Duodécima de vacaciones (criterio 3):** desde el último aniversario de servicio (o el ingreso, antes del primer año) hasta el retiro, en proporción a los días de la escala que le habrían correspondido al cumplir ese año (15, 20 o 30; el módulo de vacaciones la informa en `proximo_periodo.dias`): `escala × (meses + días/30) / 12` días, × sueldo diario.

## Planilla tributaria y de aportes (RF-48, KAN-68)

- Solo se generan sobre una planilla mensual `CERRADA`. `PLANILLAS_TRIBUTARIAS` y `PLANILLAS_APORTES` son una fotografía por planilla (una sola cada una, `uq_*_planilla`): volver a generarlas reemplaza la anterior, con los parámetros y las tasas que regían en ese periodo.
- Los aportes no tienen tasas propias: salen de los renglones `DESCUENTO` (laboral) y `APORTE` (patronal) de `CALCULOS_PLANILLA`, que ya guardan la vigencia y el porcentaje del concepto del mes. Un periodo anterior siempre usa el porcentaje que regía entonces, aunque la tasa haya cambiado después.
- `CONCEPTOS_ENTIDAD_APORTE` dice a qué entidad (`ENTIDADES_APORTE`) va cada concepto de ley, por su `codigo`. `ENTIDADES_APORTE.formato_archivo` (`XLSX` o `TXT`) es el formato que exige esa entidad al exportar. `deduce_sueldo_neto` marca los aportes laborales que se restan del total ganado para el RC-IVA. Un concepto de ley con monto que no esté asociado a una entidad no se pierde: queda como advertencia de la planilla de aportes.
- `PARAMETROS_TRIBUTARIOS` guarda, con vigencia sin solapamiento por código (`ex_parametro_sin_solapamiento`), el salario mínimo nacional, el múltiplo que define el mínimo no imponible (2), la alícuota del RC-IVA y la del crédito fiscal (13 % ambas). Se toman los vigentes el último día del periodo.
- RC-IVA de cada dependiente (D.S. 21531, art. 8; Formulario 608): sueldo neto = total ganado - aportes laborales que deducen; base imponible = máx(0, sueldo neto - mínimo no imponible); impuesto determinado = base x alícuota. Primero se resta el cómputo del 13 % de dos salarios mínimos (`computo_salarios_minimos` = alícuota x mínimo no imponible, como máximo el impuesto): en la práctica solo se retiene sobre lo que pasa de 4 salarios mínimos de sueldo neto. El cómputo no se arrastra: lo que no se usa se pierde.
- Después se aplica el crédito disponible = crédito fiscal de las facturas declaradas (monto x alícuota del crédito) + saldo a favor anterior actualizado. Se aplica hasta el impuesto que quedó tras el cómputo; el resto es lo que se retiene y el crédito no usado pasa como saldo a favor del siguiente periodo. `chk_retencion_balance`: impuesto = cómputo + crédito aplicado + retenido, y facturas + saldo anterior = crédito aplicado + saldo siguiente. Todo se redondea a centavos y los totales son la suma de los renglones.
- Saldo anterior (`origen_saldo`): si existe la planilla tributaria del mes anterior, es el `saldo_favor_siguiente` de cada dependiente en ella (`MES_ANTERIOR`), actualizado con la UFV: saldo x UFV del último día del periodo / UFV del último día del periodo anterior (`actualizacion_ufv`; si la UFV no sube, no cambia). Si todavía no se generó la del mes anterior, se usa el `saldo_inicial_favor` declarado (`SALDO_INICIAL`) y la planilla lo advierte. Generar un mes que ya tiene el siguiente generado también lo advierte, para volver a generar el siguiente.
- `VALORES_UFV` guarda el valor de la UFV por fecha (los del seed son de ejemplo; cargue los que publica el Banco Central de Bolivia). Si falta alguno de los dos valores, el saldo pasa sin actualizar y la planilla lo advierte. `PLANILLAS_TRIBUTARIAS` guarda el periodo del que vino el saldo y las dos UFV usadas.
- `CREDITOS_FISCALES_DECLARADOS` guarda lo que declara cada dependiente por periodo: facturas y, solo para arrancar, un `saldo_inicial_favor` (el saldo que traía de antes del sistema). El saldo de los meses siguientes ya no se escribe a mano: sale de la planilla tributaria anterior. Sin declaración, el crédito es 0. `id_empleado` hace referencia a EmployeeDB, sin FK.
- Acceso: exige sesión real (`middlewares/autenticar.js`, el JWT de AuthService); el responsable y su rol salen del token y se ignoran `X-Empleado-Id` y `X-Rol`. Generan, consultan y descargan el Administrador de RRHH (`admin`) y el Contador (`contador`).
- Servicio: sin parámetros tributarios vigentes o sin entidades configuradas, la generación se rechaza con un mensaje claro en vez de calcular con valores supuestos.

## Reporte contable consolidado (RF-49, KAN-69)

`GET /reporte-contable/planilla/:periodo` (AAAA-MM) y `GET /reporte-contable/aguinaldo/:gestion` (año de cierre) devuelven, para UNA planilla ya no-borrador, los mismos gastos y pasivos que se le enviaron a Contabilidad, agrupados por cuenta contable **y** por centro de costo (sucursal y área del colaborador), más el estado de conciliación de cada asiento. Acepta `?formato=xlsx|pdf` para descargarlo con el mismo contenido (`exceljs` para el Excel y `pdfkit` para el PDF).

- No reimplementa el cálculo: reutiliza las consultas de la integración (`conceptosPorCentroDeCosto`/`pasivosPorCentroDeCosto` en `planillas.model.js`, `montosPorCentroDeCosto` en `aguinaldo.model.js`) y la misma `cuentaDe()` que arma el asiento real, así que el total del reporte **siempre** cuadra con lo que Contabilidad recibió (criterio 3); lo único nuevo es que separa cada renglón por centro de costo en vez de un único total (`utils/integraciones.js#agruparPorCentroDeCosto`, `utils/aguinaldo.js#agruparAguinaldoPorCentroDeCosto`).
- Centro de costo = el par sucursal y área del colaborador al momento en que se generó la planilla/aguinaldo (copiados en `PLANILLA_EMPLEADOS` / `AGUINALDO_EMPLEADOS`). Si falta alguno, el monto cae en `(sin sucursal)` / `(sin área)` en vez de perderse.
- El reporte de la planilla mensual incluye el aguinaldo cerrado ese mismo mes: sus montos se suman por cuenta y centro de costo.
- Conciliación (criterio 2): un asiento por recurso (`asientos`: la planilla y, si se incluyó, el aguinaldo), cada uno con su `estado_contabilidad`/`estado_pagos` traducido a `registrado` (CONFIRMADA), `pendiente` (PENDIENTE) o `con_error` (RECHAZADA, con el motivo). El Excel y el PDF muestran la conciliación de cada asiento.
- Se puede generar con la planilla/aguinaldo `APROBADA` (conciliación todavía pendiente) o `CERRADA`; en `BORRADOR` da 409, porque los montos aún pueden cambiar y no hay nada que conciliar.

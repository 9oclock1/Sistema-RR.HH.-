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
- Base: `CERRADA` exige las confirmaciones de Contabilidad y Pagos (`chk_planilla_cierre`).
- `EVENTOS_SALIENTES` es la bandeja de salida: el evento se guarda en la misma transacción que la aprobación y se envía después.

## Bonos de productividad (RF-51, KAN-71)

- `REGLAS_BONO_PRODUCTIVIDAD`: una regla activa por `periodo` y `tipo_meta` (ventas, puntualidad o desempeño en caja), con su umbral de cumplimiento y su monto fijo o porcentaje. Una regla ya usada en `BONOS_PRODUCTIVIDAD` solo se inactiva, no se elimina (FK sin CASCADE).
- `EVENTOS_VENTAS_ENTRANTES` es la bandeja de entrada del cierre de ventas del periodo que publica Marketplace y Ventas (grupo E) por Pub/Sub: `id_mensaje` (del remitente) evita procesar dos veces el mismo mensaje (criterio 4). Mismo patrón RECIBIDO/PROCESADO/IGNORADO/FALLIDO que una bandeja de salida, pero de entrada.
- `METRICAS_VENTAS_PERIODO` guarda una fila por colaborador y periodo (clave `periodo, id_empleado`); un cierre reenviado con un `id_mensaje` nuevo (una corrección, no un duplicado) reemplaza la fila anterior del colaborador.
- El motor (servicio) se ejecuta en la misma transacción que registra las métricas: aplica cada regla activa del periodo a sus métricas y reemplaza los bonos anteriores del periodo en `BONOS_PRODUCTIVIDAD` (solo a quienes superan el umbral, criterio 3). También se puede volver a ejecutar manualmente si una regla cambia después del cierre.
- `BONO-PRODUCTIVIDAD` es un concepto de ingreso sin vigencia manual (como `BONO-ANTIGUEDAD`): el monto fijo o el porcentaje sobre el haber básico lo define la regla vigente del periodo, y llega a la planilla como bono (igual que `BONOS_CONDICION`).

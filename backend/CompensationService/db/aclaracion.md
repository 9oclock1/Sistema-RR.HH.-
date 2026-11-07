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
- Servicio: solo se aprueba un mes completo (`datos_hasta` = `fecha_fin`) con al menos un colaborador.
- Base: `CERRADA` exige las confirmaciones de Contabilidad y Pagos (`chk_planilla_cierre`).
- `EVENTOS_SALIENTES` es la bandeja de salida: el evento se guarda en la misma transacción que la aprobación y se envía después.

# Aclaracion

Dentro de la base de datos se encuentran las siguientes observaciones que deben ser tomadas a consideración al momento de llenar los datos y saber a que conectar y a qué no. La base no usa procedimientos almacenados, triggers ni vistas, así que las reglas marcadas como "backend" las valida el servicio.

## Réplica mínima de EmployeeDB

- `EMPLEADOS`, `DEPARTAMENTOS` y `SUCURSALES` solo copian lo necesario para conectar las tablas con FK y mostrar nombres sin consultar otro servicio. Sus id son los mismos de EmployeeDB, por eso no tienen valor por defecto.
- Lo demás (cargo, jerarquía, fecha de ingreso, estado) se consulta a EmployeeService cuando se necesita.
- `id_usuario` debería hacer referencia a id_usuario de AuthDB; queda NULL mientras no exista inicio de sesión.
- Backend: la fila se crea o actualiza antes de usarla, por ejemplo al generar las evaluaciones de un ciclo o al registrar una queja identificada.

## Plantillas y versiones

- `PLANTILLAS_EVALUACION` guarda los datos base (nombre, área destino, objetivo y vigencia). Dos plantillas con el mismo nombre y área no pueden tener vigencias que se crucen (`ex_plantilla_nombre_area_vigencia`, requiere la extensión `btree_gist`).
- La estructura (secciones, criterios y preguntas) cuelga de `VERSIONES_PLANTILLA`, y un ciclo apunta a una versión. Así, una versión nueva no altera las evaluaciones en curso.
- Estados de la versión: `BORRADOR`, `PUBLICADA` y `ARCHIVADA`. Una versión publicada conserva quién la publicó y cuándo.
- Backend: solo se editan versiones en `BORRADOR`, y para cambiar una publicada se copia su estructura a una versión nueva.
- Backend: al publicar se verifica que la suma de `peso_porcentual` de todas las preguntas de la versión sea 100.

## Competencias y escalas

- `COMPETENCIAS` es un catálogo común a todas las plantillas: permite comparar una misma competencia entre versiones y ciclos. Cada sección de una versión usa una competencia, que es de tipo competencia laboral o factor operativo.
- Toda escala se define por sus niveles (`NIVELES_ESCALA`): `etiqueta` es lo que ve el evaluador y `valor` es lo que se usa para calcular, también en las escalas cualitativas.
- Se cargan dos escalas de partida: Likert de 1 a 5 (cuantitativa) y Nivel de cumplimiento (cualitativa).
- Backend: no se modifican los niveles de una escala usada en una versión publicada.

## Ciclos y evaluaciones

- El ciclo no guarda a quién se seleccionó (área, sucursal o grupo): esa selección se convierte al momento en filas de `EVALUACIONES`, con el evaluador que indique la jerarquía de EmployeeService.
- `EVALUACIONES.id_departamento` e `id_sucursal` son el área y la sucursal del evaluado en ese ciclo. Dependen de la evaluación y no del empleado: si la persona cambia de área, sus resultados anteriores siguen contando para el área en la que estaba.
- Estados de la evaluación: `PENDIENTE`, `BORRADOR` (ya tiene respuestas sin enviar), `ENVIADA` y `VENCIDA`.
- Solo se guardan respuestas de preguntas contestadas, por lo que no hay `id_nivel` vacíos.
- `puntaje_final` es el resultado congelado al enviar, en una escala de 0 a 100 para que sean comparables los resultados de escalas distintas. No se puede obtener de otra columna de la fila, así que no rompe la 3FN; el desglose por criterio o competencia se calcula desde `RESPUESTAS_EVALUACION`.
- `recordatorio_enviado_en` evita repetir el aviso de los 3 días previos a `fecha_limite`.
- `umbral_brecha` es el puntaje bajo el cual un área se resalta como brecha en ese ciclo. El valor por defecto de 60 es una suposición.
- Backend: `id_nivel` debe pertenecer a la escala de la pregunta, y la pregunta a la versión del ciclo. Tampoco se editan evaluaciones `ENVIADA` o `VENCIDA`.

## Integración con CRM

- `EVENTOS_SALIENTES` guarda la solicitud de métricas en la misma transacción que el cierre del ciclo (patrón outbox), y un proceso la publica después. `id_evento` es el `id_mensaje` del encabezado. Un ciclo no repite el mismo evento al mismo destino (`uq_evento_ciclo_destino_tipo`).
- Todo lo que sale de RRHH va al tópico único de RRHH; el destino va en el encabezado.
- `MENSAJES_ENTRANTES` registra cada mensaje del CRM. `uq_mensaje_origen_externo` descarta los duplicados y `carga` es texto para poder guardar también un mensaje con JSON inválido.
- Estados del mensaje: `RECIBIDO`, `PROCESADO` y `EN_DLQ` (agotó los reintentos y queda para revisión, sin bloquear el consolidado).
- `METRICAS_CRM` guarda las métricas por ciclo y colaborador, y `id_mensaje` indica de qué mensaje salieron. `minutos_resolucion_promedio` es NULL si no hubo casos.
- `CATALOGOS_MODULO_EXTERNO.grupo` es la letra del grupo; la del CRM queda en NULL hasta confirmarla.

## Quejas internas

- Una queja anónima tiene `id_empleado_denunciante` en NULL y no se guarda ningún dato que identifique a quien la presenta. Por eso `id_empleado_responsable` del primer registro de `HISTORIALES_ESTADO_QUEJA` también queda en NULL.
- `codigo_seguimiento` permite consultar el avance sin identificarse. Backend: debe generarse al azar.
- `id_categoria_queja` queda en NULL hasta que RRHH clasifica el caso.
- `id_departamento` e `id_sucursal` indican dónde ocurre el problema, no a quién pertenece la queja.
- El responsable vigente es la fila más reciente de `ASIGNACIONES_QUEJA`, y el tiempo de atención se calcula con `HISTORIALES_ESTADO_QUEJA`.
- Las tablas de esta parte salen de los RF-68 a RF-71; pueden ampliarse cuando existan las historias de usuario de la épica 12.

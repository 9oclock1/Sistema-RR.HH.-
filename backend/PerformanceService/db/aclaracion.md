# Aclaracion

Dentro de la base de datos se encuentran las siguientes observaciones que deben ser tomadas a consideración al momento de llenar los datos y saber a que conectar y a qué no. La base no usa procedimientos almacenados, triggers ni vistas, así que las reglas marcadas como "backend" las valida el servicio.

`init.sql` solo crea el esquema (sin datos). Los catálogos y las escalas de partida están en `catalogos.sql`, que `init-all.sh` carga solo justo después de `init.sql` al crear la base. Los datos de prueba están en `seed.sql`, que se corre a mano después.

## Réplica mínima de EmployeeDB

- `EMPLEADOS`, `DEPARTAMENTOS` y `SUCURSALES` solo copian lo necesario para conectar las tablas con FK y mostrar nombres sin consultar otro servicio. Sus id son los mismos de EmployeeDB, por eso no tienen valor por defecto.
- Lo demás (cargo, jerarquía, fecha de ingreso, estado) se consulta a EmployeeService cuando se necesita.
- `id_usuario` debería hacer referencia a id_usuario de AuthDB; queda NULL mientras no exista inicio de sesión.
- Backend: la fila se crea o actualiza antes de usarla, por ejemplo al generar las evaluaciones de un ciclo o al registrar una queja identificada.
- `nombres` y `apellidos` quedan en NULL si EmployeeService no respondió al crear la fila (por ejemplo, al registrar una queja identificada); se completan en la siguiente sincronización.

## Plantillas y versiones

- `PLANTILLAS_EVALUACION` guarda los datos base (nombre, área destino, objetivo y vigencia). Dos plantillas con el mismo nombre y área no pueden tener vigencias que se crucen (`ex_plantilla_nombre_area_vigencia`, requiere la extensión `btree_gist`).
- La estructura (secciones, criterios y preguntas) cuelga de `VERSIONES_PLANTILLA`, y un ciclo apunta a una versión. Así, una versión nueva no altera las evaluaciones en curso.
- Estados de la versión: `BORRADOR`, `PUBLICADA` y `ARCHIVADA`. Una versión publicada conserva quién la publicó y cuándo.
- Backend: solo se editan versiones en `BORRADOR`, y para cambiar una publicada se copia su estructura a una versión nueva.
- Backend: al publicar se verifica que la suma de `peso_porcentual` de todas las preguntas de la versión sea 100.

## Competencias y escalas

- `COMPETENCIAS` es un catálogo común a todas las plantillas: permite comparar una misma competencia entre versiones y ciclos. Cada sección de una versión usa una competencia, que es de tipo competencia laboral o factor operativo.
- Toda escala se define por sus niveles (`NIVELES_ESCALA`): `etiqueta` es lo que ve el evaluador y `valor` es lo que se usa para calcular, también en las escalas cualitativas.
- `catalogos.sql` carga dos escalas de partida: Likert de 1 a 5 (cuantitativa) y Nivel de cumplimiento (cualitativa).
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

### Cálculo del puntaje final (KAN-24)

- Cada respuesta se convierte a 0-100 con `valor del nivel / valor máximo de su escala × 100`. El máximo es el mayor `valor` de `NIVELES_ESCALA` de esa escala (5 en Likert, 4 en Nivel de cumplimiento).
- `puntaje_final` es el promedio ponderado de esas respuestas con `peso_porcentual`: `Σ(peso × puntaje de la respuesta) / Σ(peso de las preguntas respondidas)`.
- Las preguntas opcionales sin responder se excluyen y su peso se reparte entre las respondidas, porque el divisor solo suma los pesos de las preguntas que sí tienen respuesta. Las obligatorias deben estar todas respondidas para enviar.
- El resultado se redondea a 2 decimales y se congela al enviar. Ejemplo del seed (evaluación `…0125`): `(20×100 + 15×80 + 15×80 + 20×100 + 20×75) / 90 = 87.78`.
- El desglose por criterio o competencia usa la misma fórmula, pero solo con las preguntas de ese criterio o competencia.

## Datos de prueba

- `seed.sql` carga datos ficticios para probar KAN-24: una plantilla publicada con 6 preguntas (pesos que suman 100 y una opcional), tres ciclos y seis evaluaciones en distintos estados. No se ejecuta al crear la base ni está montado en `docker-compose.yml`; se corre a mano después de que `init.sql` y `catalogos.sql` crearon la base, y se puede repetir sin duplicar filas.
- Los empleados del seed son réplicas con id de demostración. Para ver la bandeja con el "Usuario de prueba" del portal, pasa su `id_empleado` de EmployeeService como `-v id_evaluador=<uuid>`; las demás variables (`id_evaluador_2`, `id_creador`, `id_evaluado_1` a `id_evaluado_4`) son opcionales. El encabezado del archivo trae el comando completo.

## Integración con CRM

- `EVENTOS_SALIENTES` guarda la solicitud de métricas en la misma transacción que el cierre del ciclo (patrón outbox), y un proceso la publica después. `id_evento` es el `id_mensaje` del encabezado. Un ciclo no repite el mismo evento al mismo destino (`uq_evento_ciclo_destino_tipo`).
- Todo lo que sale de RRHH va al tópico único de RRHH; el destino va en el encabezado.
- `MENSAJES_ENTRANTES` registra cada mensaje del CRM. `uq_mensaje_origen_externo` descarta los duplicados y `carga` es texto para poder guardar también un mensaje con JSON inválido.
- Estados del mensaje: `RECIBIDO`, `PROCESADO` y `EN_DLQ` (agotó los reintentos y queda para revisión, sin bloquear el consolidado).
- `METRICAS_CRM` guarda las métricas por ciclo y colaborador, y `id_mensaje` indica de qué mensaje salieron. `minutos_resolucion_promedio` es NULL si no hubo casos.
- `CATALOGOS_MODULO_EXTERNO.grupo` es la letra del grupo; la del CRM es B.

## Quejas internas

- Una queja anónima tiene `es_anonima` en TRUE e `id_empleado_denunciante` en NULL (`chk_queja_anonimato` obliga a que vayan juntos), y no se guarda ningún dato que identifique a quien la presenta. Por eso `id_empleado_responsable` del primer registro de `HISTORIALES_ESTADO_QUEJA` también queda en NULL.
- `codigo_seguimiento` permite consultar el avance sin identificarse. Tiene el formato `QJ-XXXX-XXXX` con el alfabeto Crockford (sin I, L, O ni U). Backend: debe generarse al azar con `crypto`, nunca de forma secuencial.
- `asunto`, `descripcion` y `ADJUNTOS_QUEJA.nombre_original` se guardan cifrados con AES-256-GCM en ambos modos: cada valor es `iv (12 bytes) + authTag (16 bytes) + texto cifrado` en un solo `bytea`. `chk_queja_cifrado` rechaza valores que no alcanzan ese tamaño mínimo.
- `id_categoria_queja` la elige el empleado al registrar; RRHH puede reclasificarla al atender el caso.
- `ADJUNTOS_QUEJA` guarda solo los metadatos; el archivo va cifrado en disco (`uploads/quejas/`) con el nombre `clave_almacenamiento`. Se aceptan hasta 3 archivos PDF, JPG o PNG de 5 MB cada uno, numerados por `orden`.
- Backend: en una queja anónima, `nombre_original` queda en NULL (se muestra un nombre genérico como `adjunto-1.pdf`) y el archivo se guarda sin metadatos (EXIF, XMP, autor del PDF).
- `id_departamento` e `id_sucursal` indican dónde ocurre el problema, no a quién pertenece la queja.
- El responsable vigente es la fila más reciente de `ASIGNACIONES_QUEJA`, y el tiempo de atención se calcula con `HISTORIALES_ESTADO_QUEJA`.

### Clasificación y derivación (KAN-89, RF-69)

- Solo el Administrador de RRHH (rol `admin`) clasifica y deriva. `id_prioridad_queja` queda en NULL hasta que RRHH clasifica la queja; prioridades: `BAJA`, `MEDIA`, `ALTA` y `CRITICA` (en `catalogos.sql`).
- Backend: derivar exige que la queja esté clasificada (con prioridad) y no esté en un estado final. Cada derivación agrega una fila en `ASIGNACIONES_QUEJA` con quién derivó (`id_empleado_asignador`) y cuándo.
- La primera derivación pasa la queja de `REGISTRADA` a `ASIGNADA` y escribe la fila de `HISTORIALES_ESTADO_QUEJA` con el administrador en `id_empleado_responsable`. Una reasignación solo agrega la fila en `ASIGNACIONES_QUEJA`: el historial guarda cambios de estado y no repite `ASIGNADA` en la consulta pública.
- `INVOLUCRADOS_QUEJA` son los empleados a los que se refiere la queja, registrados por RRHH al revisarla (`id_empleado_registrador`). No toca los datos del denunciante ni rompe el anonimato.
- Backend (conflicto de interés): no se deriva a un empleado de `INVOLUCRADOS_QUEJA` de esa queja ni, en una queja identificada, a su propio denunciante. Se responde 409 con el código `CONFLICTO_INTERES`.
- Los responsables candidatos son empleados activos del área de RRHH o con un cargo que es jefe directo de otro cargo activo; se consultan a EmployeeService y la fila espejo de `EMPLEADOS` se crea o actualiza al derivar o registrar un involucrado.
- Aviso al responsable: se envía después de confirmar la derivación, así que la derivación no falla si el aviso falla. `id_estado_notificacion` usa `CATALOGOS_ESTADO_EVENTO` (`PENDIENTE`, `ENTREGADO`, `FALLIDO`) y `notificada_en` se llena solo al entregarse (`chk_asignacion_notificacion`). Un aviso fallido se puede reintentar.
- El aviso lleva solo el código de seguimiento, la categoría, la prioridad y la fecha de derivación: nunca el asunto, la descripción, los adjuntos ni datos del denunciante.
- Las tablas de esta parte salen de los RF-68 a RF-71; pueden ampliarse cuando existan las historias de usuario de la épica 12.

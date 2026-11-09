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

### Diseño de plantillas

- Al crear una plantilla se crea en la misma transacción su versión 1 en `BORRADOR`.
- La duplicidad se compara con `lower(btrim(nombre))`, el área y el rango de vigencia (`[desde, hasta]` inclusivo): "Evaluación Cajeros" y " evaluación cajeros " son el mismo nombre. El mismo nombre y área en periodos que no se cruzan sí se permite. La base responde con el error `23P01` y el backend lo convierte en una alerta de duplicidad (409).
- `nombre` y `objetivo` no pueden ser solo espacios (`chk_plantilla_nombre`, `chk_plantilla_objetivo`).
- Backend: la cabecera (nombre, área, objetivo y vigencia) se bloquea cuando alguna versión de la plantilla ya fue publicada, y una plantilla que alguna vez se publicó no se elimina.
- Backend: al publicar se valida que la cabecera esté completa, que la vigencia no haya terminado, que la versión tenga al menos una sección con una competencia activa, que cada sección tenga criterios y cada criterio al menos una pregunta, y que los pesos sumen 100. Al publicar una versión nueva, la publicada anterior pasa a `ARCHIVADA`.
- Backend: la estructura de un borrador se guarda completa con `PUT /plantillas/:id/versiones/:idVersion/estructura` (secciones, criterios y preguntas con su peso y su escala). Un borrador puede quedar con los pesos desbalanceados; la respuesta trae el `balance` (suma, diferencia y si suma 100) y el desbalance recién bloquea la publicación.
- Backend: no se crea una versión nueva de una plantilla cuya vigencia ya terminó. La cabecera no se puede cambiar después de publicar, así que esa versión nunca podría publicarse; hay que crear una plantilla nueva.
- Backend: eliminar un borrador que nunca se publicó borra en cascada preguntas, criterios, secciones y versiones.
- Backend: una plantilla tiene a lo sumo un borrador a la vez.

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

### Programación de ciclos y asignaciones (KAN-23)

- No hay tablas nuevas: el ciclo es `CICLOS_EVALUACION` y cada asignación evaluador–evaluado es una fila de `EVALUACIONES`. Todas las reglas de esta sección las valida el servicio.
- Ciclo: se crea en `PROGRAMADO` con una versión `PUBLICADA`, un periodo, `fecha_inicio` y `fecha_limite`. La fecha de inicio no puede ser pasada ni anterior al inicio del periodo, y la fecha límite no puede ser pasada. El límite sí puede superar el fin del periodo, porque se evalúa cuando el periodo ya terminó. El nombre no se repite en el periodo.
- Estados del ciclo: `PROGRAMADO` pasa a `ACTIVO` cuando llega su `fecha_inicio`, y `ACTIVO` pasa a `CERRADO` cuando se supera su `fecha_limite`. Un ciclo `PROGRAMADO` no aparece en la bandeja del evaluador.
- Alcance: el administrador elige áreas, sucursales y colaboradores. Área y sucursal se combinan como intersección (por ejemplo, «Cajas de la sucursal Centro»); si se elige solo una de las dos, se toman todos sus colaboradores activos. Los colaboradores elegidos uno por uno se suman a ese resultado sin repetirse.
- Área de la plantilla: se preselecciona el área destino de la plantilla. Si el alcance incluye colaboradores de otra área, la interfaz muestra una advertencia, pero no se bloquea.
- Evaluador: se calcula en el servicio con `GET /empleados` y `GET /jerarquia/cargos` de EmployeeService. Es el colaborador activo que ocupa el cargo jefe directo del cargo del evaluado **en la misma sucursal del evaluado**. Si hay más de uno en esa sucursal se toma el primero por nombre completo, para que el resultado sea siempre el mismo.
- Omitidos: el colaborador se omite y se informa el motivo cuando no existe o no está activo, cuando su cargo no tiene cargo superior o cuando nadie ocupa ese cargo superior en su sucursal (nadie se evalúa a sí mismo). Si no queda ninguna asignación, el ciclo no se crea.
- `EVALUACIONES.id_departamento` e `id_sucursal` guardan el área y la sucursal del evaluado al crear el ciclo, y las filas de `EMPLEADOS`, `DEPARTAMENTOS` y `SUCURSALES` se crean o actualizan en la misma transacción.
- Si EmployeeService no responde, el ciclo no se crea (no queda a medias).
- Activación, recordatorio y cierre los hace un job (`CRON_CICLOS`, por defecto todos los días a las 8:00 de La Paz; `CRON_CICLOS_ACTIVO=false` lo desactiva) que también corre una vez al arrancar el servicio. Usa la fecha de La Paz y, dentro de cada vuelta, el orden es activar, recordar y cerrar. Cada paso se puede repetir sin efectos duplicados, y un bloqueo de PostgreSQL impide que dos vueltas corran a la vez. El administrador puede lanzar una vuelta a mano con `POST /ciclos/procesar` (responde 409 si ya hay otra en curso).
- Recordatorio: los ciclos `ACTIVO` a los que les faltan 3 días o menos para la `fecha_limite` generan un aviso por evaluador y ciclo con sus evaluaciones `PENDIENTE` o `BORRADOR`. El aviso es un mensaje directo de NotificationService (prioridad alta, con enlace a las evaluaciones y correo) cuyo remitente es quien programó el ciclo. `recordatorio_enviado_en` se llena solo cuando NotificationService confirmó la entrega; si falló, se reintenta en la siguiente ejecución.
- Cierre: en una sola transacción el ciclo pasa a `CERRADO` con `cerrado_en`, las evaluaciones `PENDIENTE` o `BORRADOR` pasan a `VENCIDA` (las `ENVIADA` no cambian) y se registra en `EVENTOS_SALIENTES` el evento `SOLICITUD_METRICAS_CRM` para el CRM (patrón outbox, ver «Integración con CRM»). La `carga` del evento lleva `id_ciclo`, `nombre`, `fecha_inicio`, `fecha_limite`, `cerrado_en` y la lista `empleados` con los id de los colaboradores evaluados. La publicación de ese evento en el broker no forma parte de KAN-23.
- Un ciclo se cierra cuando su `fecha_limite` ya pasó: durante el último día del plazo todavía se puede responder. Un ciclo programado que nunca llegó a activarse y ya venció se activa y se cierra en la misma vuelta.
- Una evaluación `VENCIDA` no se puede editar ni enviar (KAN-24 responde 409), tanto si el job ya la marcó como si el plazo venció y el job aún no corrió.

### Cálculo del puntaje final (KAN-24)

- Cada respuesta se convierte a 0-100 con `valor del nivel / valor máximo de su escala × 100`. El máximo es el mayor `valor` de `NIVELES_ESCALA` de esa escala (5 en Likert, 4 en Nivel de cumplimiento).
- `puntaje_final` es el promedio ponderado de esas respuestas con `peso_porcentual`: `Σ(peso × puntaje de la respuesta) / Σ(peso de las preguntas respondidas)`.
- Las preguntas opcionales sin responder se excluyen y su peso se reparte entre las respondidas, porque el divisor solo suma los pesos de las preguntas que sí tienen respuesta. Las obligatorias deben estar todas respondidas para enviar.
- El resultado se redondea a 2 decimales y se congela al enviar. Ejemplo del seed (evaluación `…0125`): `(20×100 + 15×80 + 15×80 + 20×100 + 20×75) / 90 = 87.78`.
- El desglose por criterio o competencia usa la misma fórmula, pero solo con las preguntas de ese criterio o competencia.

### Retroalimentación cualitativa final (KAN-26)

- `fortalezas`, `aspectos_mejora` y `comentarios_generales` de `EVALUACIONES` son opcionales; un texto vacío se guarda como NULL.
- Cada compromiso de `COMPROMISOS_DESARROLLO` tiene descripción y fecha objetivo obligatorias. Al guardar, la lista enviada reemplaza a la anterior.
- Backend: solo el evaluador la registra, y solo cuando ya respondió todas las preguntas obligatorias. La fecha objetivo no puede ser anterior a hoy (hora de Bolivia).
- Backend: al enviar la evaluación la retroalimentación queda congelada. El colaborador evaluado la consulta en `GET /evaluaciones/mis-resultados[/:id]`, que solo muestra evaluaciones `ENVIADA` y no tiene escritura.

### Consulta de evaluaciones individuales e historial de desempeño

- `GET /evaluaciones/historial/:idEmpleado` devuelve el consolidado del colaborador. Solo cuenta evaluaciones `ENVIADA` de ciclos `CERRADO`: mientras el ciclo sigue activo, otro evaluador todavía puede enviar y el consolidado cambiaría.
- Puntaje del ciclo: promedio simple de los `puntaje_final` de sus evaluaciones enviadas (un colaborador puede tener varios evaluadores en un ciclo). El desglose por competencia promedia el puntaje de cada competencia entre esas evaluaciones, agrupando por `id_competencia` del catálogo.
- La evolución agrupa los ciclos por `PERIODOS_EVALUACION` en orden cronológico; si un periodo tiene varios ciclos, su puntaje es el promedio de ellos. Cada punto trae la variación respecto al periodo anterior.
- La retroalimentación se muestra por evaluación (cada evaluador con sus textos y compromisos), no se mezcla.
- RBAC: el colaborador solo consulta su propio historial (`X-Empleado-Id` = `:idEmpleado`). Consultar a otra persona exige `X-Rol` de RRHH (`admin` o `gerente`); cualquier otro rol recibe 403 sin que se lean datos. RRHH recibe 404 si el colaborador no está en la réplica de `EMPLEADOS`.
- Promedios redondeados a 2 decimales, calculados en centésimas.

## Datos de prueba

- `seed.sql` carga datos ficticios para probar KAN-24: una plantilla publicada con 6 preguntas (pesos que suman 100 y una opcional), tres ciclos y seis evaluaciones en distintos estados. Para KAN-23 agrega cuatro ciclos con sus evaluaciones: dos `PROGRAMADO` (uno que inicia en 15 días y otro que inicia hoy, para probar la activación), un `ACTIVO` que vence en 3 días (con evaluaciones pendientes, en borrador, enviada y ya recordada, y con dos evaluadores distintos) y un `ACTIVO` que venció ayer (para probar el cierre). Estas fechas usan el día de La Paz, no el del servidor de Postgres. No se ejecuta al crear la base ni está montado en `docker-compose.yml`; se corre a mano después de que `init.sql` y `catalogos.sql` crearon la base, y se puede repetir sin duplicar filas.
- Los empleados del seed son réplicas con los mismos ids que `backend/EmployeeService/db/seed.sql`, que hay que cargar primero: así las bandejas y los ciclos hablan de las mismas personas. Los usuarios de prueba para ver la bandeja y programar ciclos son Marcela Quiroga (evaluadora, Sopocachi) y Jorge Mamani (Miraflores). Ambos seeds son SQL puro y se pueden volver a ejecutar sin duplicar datos; el proceso de ciclos cambia los estados de los datos (activa, recuerda y cierra), así que para repetir la demostración desde cero hay que recrear la base con `docker compose down -v`.
- Consolidado de KAN-27: el ciclo cerrado «Evaluación trimestral 2026-T3» (periodo `2026-T3`, umbral 60) tiene 8 evaluaciones `ENVIADA` (`…0140` a `…0147`) y una `VENCIDA` (`…0148`, no cuenta). Promedios: Atención al cliente 74.56, Recursos Humanos 50.00 (brecha); Sopocachi 79.38, Miraflores 58.33 (brecha). Incluye la respuesta del CRM ya procesada (`…0151`, con las métricas de 6 cajeros y asesores) y un mensaje en `EN_DLQ` (`…0152`, JSON inválido tras 5 intentos). No se siembra ningún `EVENTOS_SALIENTES` para este ciclo, así no se publica nada al tópico real al arrancar el servicio.
- Historial del evaluado 31 (Carlos Rojas, KAN-26): periodo `2025-S2` (ciclo cerrado, evaluación `…0138`, 72.22) y periodo `2026-S1` con dos evaluadores (`…0125` 87.78 y `…0139` 85.00, consolidado 86.39).

## Integración con CRM

- `EVENTOS_SALIENTES` guarda la solicitud de métricas en la misma transacción que el cierre del ciclo (patrón outbox), y un proceso la publica después. `id_evento` es el `id_mensaje` del encabezado. Un ciclo no repite el mismo evento al mismo destino (`uq_evento_ciclo_destino_tipo`).
- Todo lo que sale de RRHH va al tópico único de RRHH; el destino va en el encabezado.
- `MENSAJES_ENTRANTES` registra cada mensaje del CRM. `uq_mensaje_origen_externo` descarta los duplicados y `carga` es texto para poder guardar también un mensaje con JSON inválido.
- Estados del mensaje: `RECIBIDO`, `PROCESADO` y `EN_DLQ` (agotó los reintentos y queda para revisión, sin bloquear el consolidado).
- `METRICAS_CRM` guarda las métricas por ciclo y colaborador, y `id_mensaje` indica de qué mensaje salieron. `minutos_resolucion_promedio` es NULL si no hubo casos.
- `CATALOGOS_MODULO_EXTERNO.grupo` es la letra del grupo; la del CRM es B.

### Consolidado de desempeño y métricas del CRM (KAN-27, RF-07)

- No hay tablas, columnas ni vistas nuevas: el esquema de arriba ya cubre la historia. Los promedios por área, sucursal y competencia los calcula el backend a partir de `EVALUACIONES` y `RESPUESTAS_EVALUACION`, con la misma fórmula de KAN-24.
- Backend: el consolidado solo cuenta evaluaciones `ENVIADA` de ciclos `CERRADO`. Las `VENCIDA` no tienen puntaje y no entran en ningún promedio. Se promedia primero por colaborador (puede tener varios evaluadores) y después por área, sucursal o competencia, para que nadie pese el doble.
- Backend: un área o sucursal es brecha de productividad cuando su promedio es **menor** que `CICLOS_EVALUACION.umbral_brecha` del ciclo. Un promedio igual al umbral no es brecha, y un grupo sin evaluaciones enviadas se muestra «sin datos», no como brecha.
- Endpoints (`X-Rol` `admin` o `gerente`; cualquier otro rol recibe 403): `GET /desempeno/ciclos` (ciclos cerrados), `GET /desempeno/ciclos/:id/consolidado` (promedios por área, sucursal y competencia), `GET /desempeno/ciclos/:id/comparativa?por=departamento|sucursal` y `GET /desempeno/ciclos/:id/colaboradores?departamento=&sucursal=` (puntaje de cada colaborador con sus métricas del CRM). Un ciclo que no está cerrado responde 409. Solo el `admin` cambia el umbral con `PUT /desempeno/ciclos/:id/umbral` (`{ "umbral_brecha": 0 a 100 }`, hasta 2 decimales).
- Backend: el promedio global, el de cada área y el de cada sucursal salen de los puntajes de los colaboradores (no de las evaluaciones sueltas), y el puntaje por competencia se calcula con la misma fórmula de KAN-24 que ve el evaluador. Las métricas del CRM de un área suman quejas y felicitaciones de sus colaboradores y promedian los minutos de resolución de quienes tuvieron casos.
- Solicitud al CRM: al cerrar el ciclo ya queda el evento `SOLICITUD_METRICAS_CRM` en `EVENTOS_SALIENTES` (KAN-23). Al publicarlo (origen F, destino B, tópico único) el backend envía el periodo y solo a los colaboradores de atención al cliente y cajeros (cargos `ATC-CAJ` y `ATC-ASE`), porque son los que el CRM mide.
- Respuesta del CRM: el docente solo exige publicar. Cuando la publicación se confirma, el sistema simula la respuesta del CRM, la muestra en la consola y la procesa como si hubiera llegado por Pub/Sub. Es un mensaje con encabezado origen B → destino F, tipo `METRICAS_DESEMPENO_CRM`, y estos datos: `id_ciclo`, `periodo` y una lista `metricas` con `id_empleado`, `cantidad_quejas`, `cantidad_felicitaciones` y `minutos_resolucion_promedio` (null si no hubo casos).
- Backend: cada respuesta se guarda primero en `MENSAJES_ENTRANTES`. Si su `id_mensaje` ya existe es un duplicado y no cambia nada. Las métricas se escriben en `METRICAS_CRM` (una fila por ciclo y colaborador, la repetición actualiza) y el mensaje queda `PROCESADO`. Si falla se reintenta y, al agotar los intentos, queda `EN_DLQ` con `ultimo_error` para revisión; el consolidado sigue funcionando sin esas métricas.

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

### Acciones y avance del caso (KAN-90, RF-70)

- Estados de la queja (en `catalogos.sql`): `REGISTRADA`, `ASIGNADA`, `EN_ANALISIS`, `EN_ACCION`, `RESUELTA` (final) y `DESESTIMADA` (final). `chk_queja_resolucion` usa el id 5 de `RESUELTA`, igual que `chk_asignacion_notificacion` usa el id 2 de `ENTREGADO`.
- Backend: solo el responsable vigente (última fila de `ASIGNACIONES_QUEJA`) registra acciones y cambia el estado. El Administrador de RRHH consulta el caso, pero no actúa en nombre del responsable.
- Backend (transiciones válidas): `ASIGNADA` → `EN_ANALISIS` → `EN_ACCION` → `RESUELTA`, con retroceso de `EN_ACCION` a `EN_ANALISIS`. `RESUELTA` no admite cambios. Cualquier otra transición se rechaza con 409.
- Cada transición agrega una fila en `HISTORIALES_ESTADO_QUEJA` con el estado anterior, el nuevo, el responsable que la hizo (`id_empleado_responsable`) y `fecha_cambio`. No hay otra tabla de estados: el historial de KAN-88 ya guarda todo eso.
- `ACCIONES_QUEJA` es la bitácora de acciones preventivas o correctivas (`CATALOGOS_TIPO_ACCION_QUEJA`). Es de solo agregar: no hay endpoints para editarla ni borrarla. `id_empleado_registrador` y `creado_en` los pone el servicio, nunca el cliente. `descripcion` va cifrada igual que la queja (`chk_accion_queja_cifrado`).
- `QUEJAS.resolucion` es la descripción de la resolución, cifrada igual que la queja. `chk_queja_resolucion` obliga a que exista si y solo si la queja está `RESUELTA`. El autor y la fecha de la resolución son los de la fila `RESUELTA` del historial.
- Aviso de resolución al denunciante: se envía después de confirmar la resolución, así que la resolución no falla si el aviso falla, igual que en KAN-89. `id_estado_aviso_resolucion` usa `CATALOGOS_ESTADO_EVENTO` y `aviso_resolucion_en` se llena solo al entregarse (`chk_queja_aviso_resolucion_entregado`). Un aviso fallido se puede reintentar.
- En una queja anónima no se avisa a nadie: `chk_queja_aviso_resolucion` deja `id_estado_aviso_resolucion` en NULL. El aviso lleva solo el código de seguimiento y que el caso se resolvió, nunca las acciones ni la resolución.
- La consulta pública por código muestra solo los estados y sus fechas, no las acciones ni la resolución.

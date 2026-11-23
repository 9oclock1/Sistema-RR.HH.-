# Aclaraciones de AuthDB

- `id_empleado` de `USUARIOS` debería hacer referencia a id_empleado de EmployeeDB: sin FK por ser otro servicio. Una cuenta por colaborador (`uq_usuario_empleado`).
- `correo` se guarda en minúsculas (`chk_usuario_correo`); el inicio de sesión lo normaliza igual.
- `hash_contrasena`: scrypt de `node:crypto` con sal aleatoria de 16 bytes, guardado como `scrypt$<sal>$<clave>` en hexadecimal. Nunca se guarda ni se devuelve la contraseña.
- `rol`: uno de los roles del portal (`admin`, `gerente`, `reclutador`, `supervisor`, `empleado`, `auditor`, `contador`). `contador` es el Contador / Encargado de planillas (RF-44, RF-47 y RF-48). Va dentro del token.
- `esta_activo = FALSE`: el inicio de sesión responde 403 y `GET /sesion` deja de reconocer la sesión.

## Sesión

- `POST /login` `{ correo, contrasena }`: si son correctos, deja la cookie `rrhh_sesion` (HttpOnly, SameSite=Strict, 8 horas) con un JWT HS256 firmado con `JWT_SECRET`: `sub` = id del empleado, `rol`. Correo o contraseña incorrectos: 401 con el mismo mensaje en ambos casos.
- `GET /sesion`: `{ usuario }` de la sesión, o `{ usuario: null }` si no hay una válida (200: el portal lo consulta al cargar y no debe ensuciar la consola). `POST /logout`: borra la cookie.
- Los servicios que exigen sesión verifican el JWT por su cuenta con el mismo `JWT_SECRET` (`/boletas`, `/indicadores/rotacion` y las planillas tributaria y de aportes de CompensationService). El resto del portal sigue con el usuario y el rol de prueba.
- Cuentas de prueba: `db/seed.sql`, una por colaborador de EmployeeService/db/seed.sql (contraseña `rrhh123`; los de baja, desactivadas). Lista en `CUENTAS-DE-PRUEBA.md`, en la raíz del repositorio.

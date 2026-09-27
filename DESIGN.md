# Sistema de diseño — Módulo de RR.HH.

Toda la interfaz del proyecto (módulo de RR.HH. del ERP del supermercado) sigue este documento.

Lenguaje visual inspirado en herramientas de productividad tipo Jira / Atlassian Design System: limpio, denso y profesional. **No** se usan logos ni nombres de Jira o Atlassian. Los textos de la interfaz van en español.

---

## Colores

Se definen como tokens (variables CSS) y nunca se escriben a mano en otro lugar.

- **Primario:** `#1868DB` (hover `#1558BC`, presionado `#144794`). Los enlaces usan el primario.
- **Texto:** `#292A2E` principal, `#505258` secundario, `#6B6E76` sutil / placeholder.
- **Fondos:** `#FFFFFF` superficies, `#F8F8F8` página y columnas, `#F0F1F2` hover de elementos neutros.
- **Bordes:** `#DDDEE1` por defecto, `#B7B9BE` para inputs.
- **Elemento de navegación activo:** fondo `#E9F2FE` con texto `#1868DB`.
- **Estados:** éxito `#22A06B`, advertencia `#E2B203`, peligro `#C9372C`, información `#1868DB`, morado `#8270DB`.
- **Etiquetas:** fondo blanco, borde de 1px del color del estado y texto oscuro del mismo tono.

## Tipografía

- Fuente: `"Inter", system-ui, sans-serif`.
- Base 14px / interlineado 20px. Texto pequeño o meta: 12px.
- Títulos: título de página 24px/600, sección 16px/600, título de tarjeta 14px/400.
- Ningún texto supera 24px.

## Distribución

- **Barra superior de 48px:** botón de menú, nombre de la aplicación, buscador centrado (máx. 600px) y acciones a la derecha.
- **Barra lateral de 240px, plegable:** elementos de 32px de alto, íconos de 16px, radio 6px, hover gris.
- **Encabezado de página:** migas de pan (12px, sutil) → título con acciones → pestañas horizontales (pestaña activa = texto primario + borde inferior de 2px).
- **Grilla de 8px** (4, 8, 12, 16, 24, 32). Relleno del contenido: 24px.

## Componentes

- **Botones:** 32px de alto, radio 4px, 14px/500. Primario = relleno azul, predeterminado = blanco con borde, sutil = transparente con hover gris. Botones de solo ícono de 32×32.
- **Tarjetas:** blancas, borde de 1px, radio 8px, relleno de 12px, sombra muy suave (`0 1px 1px rgba(0,0,0,.08)`). Hover = borde algo más oscuro. Seleccionada = borde primario de 2px.
- **Inputs:** 32px, radio 4px, borde de 1px, foco = anillo primario de 2px.
- **Avatares:** circulares de 24px, iniciales en blanco sobre un color sólido.
- **Tablas:** filas de 40px, divisores de 1px, encabezados de 12px/600 sin mayúsculas forzadas y en texto secundario.
- **Contadores:** píldora gris pequeña (`#E9EAEC`), 12px.
- **Avisos (toasts):** abajo a la izquierda, tarjeta blanca, ícono de estado, se cierran solos.
- **Íconos:** estilo de contorno (Lucide), 16px por defecto, trazo de 1.5 a 2.

## Reglas de experiencia de uso

- Diseño plano, sombras mínimas. La jerarquía se logra con espaciado, peso y color, no con decoración.
- Todo elemento interactivo tiene estados de hover, foco visible (anillo primario de 2px) y deshabilitado.
- Transiciones de 150ms `ease`. Sin animaciones con rebote.
- Los textos largos se cortan con puntos suspensivos y muestran el texto completo al pasar el cursor.
- Mostrar esqueletos de carga, estados vacíos con un mensaje corto y una acción, y errores de formulario en línea, en color de peligro y debajo del campo.
- Las acciones destructivas requieren un modal de confirmación.
- Adaptable: la barra lateral se pliega por debajo de 1024px.

## Precisiones de implementación

Decisiones tomadas al pasar la especificación a código:

- **Texto de estado:** el verde, el amarillo y el morado no llegan a 4.5:1 como texto sobre blanco. Para texto se usa la variante oscura del mismo tono (`--color-*-text`); el color base queda para bordes, íconos y rellenos.
- **Tema oscuro:** los mismos tokens tienen valores oscuros que se aplican con `prefers-color-scheme: dark`. Ningún componente necesita cambios para soportarlo.
- **Pantallas táctiles:** con `pointer: coarse` los controles crecen a 44px de alto y los inputs usan 16px para evitar el zoom automático de iOS. En escritorio se mantiene la densidad de 32px.
- **Borde de inputs:** `#B7B9BE` sobre blanco tiene un contraste de 1.96:1 (por debajo del 3:1 recomendado para controles). Se mantiene por especificación; si se decide subirlo, basta con cambiar `--color-border-input` (p. ej. `#8C8F97`, 3.2:1).
- **Movimiento reducido:** con `prefers-reduced-motion` las transiciones se vuelven instantáneas y los esqueletos dejan de brillar.

---

## Cómo usar

### Tokens

Están en `frontend/src/styles/tokens.css` y se cargan en `main.jsx`. En CSS se usan siempre con `var(--token)`.

| Grupo | Tokens |
|---|---|
| Primario | `--color-primary`, `--color-primary-hover`, `--color-primary-pressed`, `--color-on-primary`, `--color-link` |
| Texto | `--color-text`, `--color-text-secondary`, `--color-text-subtle`, `--color-text-inverse`, `--color-text-selected` |
| Fondos | `--color-bg-surface`, `--color-bg-page`, `--color-bg-hover`, `--color-bg-pressed`, `--color-bg-neutral`, `--color-bg-selected`, `--color-bg-overlay` |
| Bordes | `--color-border`, `--color-border-hover`, `--color-border-input`, `--color-border-focus` |
| Estados | `--color-success`, `--color-warning`, `--color-danger`, `--color-info`, `--color-purple` y sus variantes `-text` y `-bg` (`--color-info-bg`, `--color-success-bg`, `--color-warning-bg`, `--color-danger-bg`); `--color-danger-hover`, `--color-danger-pressed`, `--color-on-danger` |
| Avatares y carga | `--color-avatar-1` … `--color-avatar-6`, `--color-on-avatar`, `--color-skeleton`, `--color-skeleton-shine` |
| Tipografía | `--font-family`, `--font-family-mono`, `--font-size-body`, `--line-height-body`, `--font-size-small`, `--line-height-small`, `--font-size-title`, `--line-height-title`, `--font-size-section`, `--line-height-section`, `--font-size-input-touch`, `--font-weight-regular`, `--font-weight-medium`, `--font-weight-semibold` |
| Espaciado | `--space-1` (4), `--space-2` (8), `--space-3` (12), `--space-4` (16), `--space-6` (24), `--space-8` (32), `--space-content` |
| Radios | `--radius-control` (4), `--radius-nav` (6), `--radius-card` (8), `--radius-round` |
| Tamaños | `--size-control`, `--size-control-sm`, `--size-touch`, `--size-row`, `--size-nav-item`, `--size-icon`, `--size-avatar`, `--size-avatar-lg`, `--size-topbar`, `--size-sidebar`, `--size-search-max`, `--size-modal`, `--size-modal-lg`, `--size-toast`, `--border-width`, `--border-width-strong`, `--icon-stroke` |
| Sombras y foco | `--shadow-card`, `--shadow-overlay`, `--focus-ring-width`, `--focus-ring-offset` |
| Movimiento y capas | `--duration`, `--easing`, `--transition`, `--z-sticky`, `--z-sidebar`, `--z-modal`, `--z-toast` |

Las media queries no aceptan variables: usa `1024px` para plegar la barra lateral y `640px` para móvil.

### Componentes base

Están en `frontend/src/components/ui/` y se importan desde el índice:

```jsx
import { Boton, CampoTexto, Tabla, useAvisos } from "../../components/ui";
```

| Componente | Uso principal |
|---|---|
| `Boton` | Con `href` se pinta como enlace. `variante`: `primario` \| `predeterminado` \| `sutil` \| `peligro`; `tamano`: `md` \| `sm`; `icono`, `soloIcono` (requiere `aria-label`), `cargando`, `disabled` |
| `CampoTexto` | Input con `etiqueta`, `ayuda`, `error`, `requerido` y el resto de atributos de `<input>` |
| `Selector` | `<select>` con las mismas props de campo más `opciones` `[{ valor, etiqueta }]` y `textoVacio` |
| `Casilla` | Checkbox con `etiqueta` y `ayuda`; el resto de atributos van al `<input>` |
| `Campo` | Envoltorio de etiqueta, ayuda y error para crear otros controles |
| `Tarjeta` | `titulo`, `nivelTitulo` (3 por defecto), `acciones`, `interactiva`, `seleccionada`; con `onClick` se vuelve botón |
| `Etiqueta` | `tono`: `neutral` \| `exito` \| `aviso` \| `peligro` \| `info` \| `morado`; `icono` |
| `Alerta` | Mensaje en línea que permanece: `tono` (`info` \| `exito` \| `aviso` \| `peligro`), `titulo`, `acciones`, `onCerrar`. Con `role="alert"` para errores; con `tabIndex={-1}` y `ref` para llevar el foco (resumen de errores de un formulario) |
| `Contador` | Píldora gris para cantidades |
| `Avatar` | `nombre` (genera iniciales y color), `tamano`: `md` \| `lg`, `decorativo` |
| `Modal` | `abierto`, `titulo`, `onCerrar`, `pie`, `tamano`: `md` \| `sm`, `bloqueado` |
| `ModalConfirmacion` | Confirmación de acciones destructivas: `titulo`, `textoConfirmar`, `procesando`, `onConfirmar`, `onCancelar` |
| `ProveedorAvisos` + `useAvisos` | Avisos flotantes que se cierran solos, para confirmar una acción; lo que el usuario debe leer o resolver va en `Alerta`. Ya envuelve la app en `main.jsx`. `const avisar = useAvisos(); avisar({ tono, titulo, mensaje })` |
| `Tabla` | `columnas` `[{ clave, titulo, ancho, alinear, celda }]`, `filas`, `cargando`, `vacio` |
| `Pestanas` | `pestanas` `[{ id, etiqueta, contador, contenido }]`, `activa`, `onCambiar`, `etiqueta` |
| `EncabezadoPagina` | Migas → título con `acciones` → `descripcion` → pestañas (`children`). `migas` `[{ etiqueta, href? }]`; `enlace={Link}` para usar el router |
| `ElementoNavegacion` | Elemento de la barra lateral: `as={NavLink}` + `to` (marca el activo solo), o `href`, o `onClick` + `activo`; `icono`, `etiqueta`, `contador` |
| `Esqueleto` | `forma`: `texto` \| `circulo` \| `bloque`; `ancho`, `alto` |
| `EstadoVacio` | `icono`, `titulo`, `mensaje`, `accion` |
| `TextoTruncado` | Corta con puntos suspensivos y muestra el texto completo al pasar el cursor |

### Íconos

Se usa `lucide-react`. Dentro de un componente propio, añade la clase `ds-icono` para aplicar el tamaño y el trazo del sistema y `aria-hidden="true"` si el ícono acompaña a un texto:

```jsx
import { Clock } from "lucide-react";
<Clock className="ds-icono" aria-hidden="true" />
```

### Reglas para código nuevo

- Ningún color, fuente, espaciado ni radio escrito a mano: siempre tokens.
- Si falta un componente, se crea en `frontend/src/components/ui/` siguiendo este documento y se exporta en `index.js`.
- Las clases de los componentes base usan el prefijo `ds-` para no chocar con estilos de cada módulo.

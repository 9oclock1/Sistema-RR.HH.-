// Íconos de trazo simples (heredan el color del texto con currentColor).
const Icono = ({ children, size = 16 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    {children}
  </svg>
);

export const IconoMas = (props) => (
  <Icono {...props}>
    <path d="M12 5v14M5 12h14" />
  </Icono>
);

export const IconoLapiz = (props) => (
  <Icono {...props}>
    <path d="M4 20h4L19 9a2.83 2.83 0 0 0-4-4L4 16v4Z" />
    <path d="m13.5 6.5 4 4" />
  </Icono>
);

export const IconoCerrar = (props) => (
  <Icono {...props}>
    <path d="M6 6l12 12M18 6 6 18" />
  </Icono>
);

export const IconoAlerta = (props) => (
  <Icono {...props}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 8v4.5M12 16h.01" />
  </Icono>
);

export const IconoCheck = (props) => (
  <Icono {...props}>
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </Icono>
);

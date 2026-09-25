import { NavLink, Outlet } from "react-router";

export default function MainLayout() {
  return (
    <div className="app">
      <header className="app-encabezado">
        <span className="app-titulo">Sistema RR.HH.</span>
        <nav className="app-nav">
          <NavLink to="/asistencia/marcaje">Marcaje</NavLink>
          <NavLink to="/asistencia/turnos">Turnos</NavLink>
        </nav>
      </header>
      <main className="app-contenido">
        <Outlet />
      </main>
    </div>
  );
}

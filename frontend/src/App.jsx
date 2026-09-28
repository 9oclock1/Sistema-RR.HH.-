import AsignacionesView from './features/Asignaciones/AsignacionesView';
import CargosList from './features/Cargos/CargosList';
import OrganizacionView from './features/organizacion/OrganizacionView';
import OrganigramaView from './features/organigrama/OrganigramaView';
import VacantesView from './features/Vacantes/VacantesView';
import './App.css';

function App() {
  return (
    <main className="app">
      <OrganizacionView />
      <OrganigramaView />
      <CargosList />
      <AsignacionesView />
      <VacantesView />
    </main>
  );
}

export default App;
import AsignacionesView from './features/Asignaciones/AsignacionesView';
import CargosList from './features/Cargos/CargosList';
import OrganizacionView from './features/organizacion/OrganizacionView';
import OrganigramaView from './features/organigrama/OrganigramaView';
import JerarquiaView from './features/Jerarquia/JerarquiaView'; // RF-18
import VacantesView from './features/Vacantes/VacantesView';
import './App.css';

function App() {
  return (
    <main className="app">
      <OrganizacionView />
      <OrganigramaView />
      <JerarquiaView />
      <CargosList />
      <AsignacionesView />
      <VacantesView />
    </main>
  );
}

export default App;
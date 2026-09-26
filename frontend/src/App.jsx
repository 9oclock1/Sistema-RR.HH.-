import CargosList from './features/Cargos/CargosList';
import OrganizacionView from './features/organizacion/OrganizacionView';
import VacantesView from './features/Vacantes/VacantesView';
import './App.css';

function App() {
  return (
    <main className="app">
      <OrganizacionView />
      <CargosList />
      <VacantesView />
    </main>
  );
}

export default App;

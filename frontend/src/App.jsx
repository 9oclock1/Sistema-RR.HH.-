import CargosList from './features/Cargos/CargosList';
import OrganizacionView from './features/organizacion/OrganizacionView';
import './App.css';

function App() {
  return (
    <main className="app">
      <OrganizacionView />
      <CargosList />
    </main>
  );
}

export default App;

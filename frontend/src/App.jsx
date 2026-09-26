import { ApplicantRegistration } from './features/recruitment'

/**
 * App Root Component
 *
 * Currently renders the RF-09 ApplicantRegistration feature directly.
 * When the Sprint 1 merge integrates the router, this will be replaced
 * with <RouterProvider> or <BrowserRouter> wrapping all feature routes.
 */
function App() {
  return <ApplicantRegistration />
}

export default App

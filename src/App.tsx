import { Navigate, Route, Routes } from 'react-router-dom'
import AppShell from './components/AppShell'
import Landing from './pages/Landing'
import Dashboard from './pages/Dashboard'
import Families from './pages/Families'
import NewAssessment from './pages/NewAssessment'
import Report from './pages/Report'
import ParentView from './pages/ParentView'
import Guide from './pages/Guide'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/app" element={<AppShell />}>
        <Route index element={<Dashboard />} />
        <Route path="families" element={<Families />} />
        <Route path="new" element={<NewAssessment />} />
        <Route path="report/:id" element={<Report />} />
        <Route path="parent/:id" element={<ParentView />} />
        <Route path="guide" element={<Guide />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

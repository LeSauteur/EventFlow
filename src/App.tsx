import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from './components/AppShell.tsx'
import { placeholderContent } from './data/navigation.ts'
import { DashboardPage } from './pages/DashboardPage.tsx'
import { EventsPage } from './pages/EventsPage.tsx'
import { EventDetailPage } from './pages/EventDetailPage.tsx'
import { NewEventPage } from './pages/NewEventPage.tsx'
import { PlaceholderPage } from './pages/PlaceholderPage.tsx'
import { QuestionsPage } from './pages/QuestionsPage.tsx'
import { SettingsPage } from './pages/SettingsPage.tsx'
import { ContractorsPage } from './pages/ContractorsPage.tsx'
import { BudgetPage } from './pages/BudgetPage.tsx'
import { TemplatesPage } from './pages/TemplatesPage.tsx'
import { SearchResultsPage } from './pages/SearchResultsPage.tsx'

export default function App() {
  return <AppShell><Routes><Route path="/" element={<DashboardPage />} /><Route path="/events" element={<EventsPage />} /><Route path="/events/new" element={<NewEventPage />} /><Route path="/events/:id" element={<EventDetailPage />} /><Route path="/contractors" element={<ContractorsPage />} /><Route path="/templates" element={<TemplatesPage />} /><Route path="/budget" element={<BudgetPage />} /><Route path="/questions" element={<QuestionsPage />} /><Route path="/settings" element={<SettingsPage />} /><Route path="/search" element={<SearchResultsPage />} />{Object.entries(placeholderContent).map(([path, content]) => <Route key={path} path={path} element={<PlaceholderPage {...content} />} />)}<Route path="*" element={<Navigate to="/" replace />} /></Routes></AppShell>
}

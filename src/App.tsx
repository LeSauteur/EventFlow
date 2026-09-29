import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from './components/AppShell.tsx'
import { EventsPage } from './pages/EventsPage.tsx'
import { EventDetailPage } from './pages/EventDetailPage.tsx'
import { NewEventPage } from './pages/NewEventPage.tsx'
import { SettingsPage } from './pages/SettingsPage.tsx'
import { TemplatesPage } from './pages/TemplatesPage.tsx'

export default function App() {
  return <AppShell><Routes><Route path="/" element={<Navigate to="/events" replace />} /><Route path="/events" element={<EventsPage />} /><Route path="/events/new" element={<NewEventPage />} /><Route path="/events/:id" element={<EventDetailPage />} /><Route path="/templates" element={<TemplatesPage />} /><Route path="/settings" element={<SettingsPage />} /><Route path="*" element={<Navigate to="/events" replace />} /></Routes></AppShell>
}

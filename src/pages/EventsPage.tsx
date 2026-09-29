import { ArrowLeft, NotebookPen, Plus } from 'lucide-react'
import { Link } from 'react-router-dom'

export function EventsPage() {
  return <main className="notebook-empty-page">
    <div className="notebook-empty-icon"><NotebookPen size={30} /></div>
    <h1>Выберите мероприятие</h1>
    <p><ArrowLeft size={16} /> Откройте рабочую страницу из списка слева или создайте новую.</p>
    <Link className="primary-button" to="/events/new"><Plus size={18} />Создать мероприятие</Link>
  </main>
}

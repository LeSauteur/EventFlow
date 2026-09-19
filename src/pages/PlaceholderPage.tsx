import { ArrowLeft, Wrench } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

export function PlaceholderPage({ title, description }: { title: string; description: string }) {
  const navigate = useNavigate()
  return <main className="page"><div className="page-toolbar"><div><h1>{title}</h1><p>{description}</p></div></div><div className="card placeholder"><span className="placeholder-icon"><Wrench size={28} /></span><h2>Раздел будет реализован на следующем этапе</h2><p>Сейчас основная работа сосредоточена на Dashboard и мероприятиях.</p><button className="secondary-button" onClick={() => navigate('/')}><ArrowLeft size={18} />Вернуться на дашборд</button></div></main>
}

import { AlertTriangle, RefreshCcw } from 'lucide-react'
import { Component, type ErrorInfo, type ReactNode } from 'react'

interface State { error: Error | null }

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null }
  static getDerivedStateFromError(error: Error): State { return { error } }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error('EventFlow UI error', error, info.componentStack) }
  render() {
    if (!this.state.error) return this.props.children
    return <div className="fatal-error"><span><AlertTriangle size={28} /></span><h1>Не удалось открыть этот экран</h1><p>Локальные данные сохранены. Обновите страницу и попробуйте снова.</p><button className="primary-button" onClick={() => window.location.reload()}><RefreshCcw size={17} />Обновить приложение</button></div>
  }
}

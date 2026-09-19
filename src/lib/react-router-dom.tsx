import {
  Children,
  createContext,
  type AnchorHTMLAttributes,
  type MouseEvent,
  type ReactElement,
  type ReactNode,
  useContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'

type Navigate = (to: string, options?: { replace?: boolean }) => void

interface RouterContextValue {
  pathname: string
  search: string
  navigate: Navigate
}

const RouterContext = createContext<RouterContextValue | null>(null)
const ParamsContext = createContext<Record<string, string>>({})

function normalizePath(path: string) {
  if (!path) return '/'
  const clean = path.split('?')[0].split('#')[0]
  return clean !== '/' ? clean.replace(/\/+$/, '') : clean
}

export function BrowserRouter({ children }: { children: ReactNode }) {
  const [location, setLocation] = useState(() => ({ pathname: normalizePath(window.location.pathname), search: window.location.search }))

  useEffect(() => {
    const handlePopState = () => setLocation({ pathname: normalizePath(window.location.pathname), search: window.location.search })
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  const navigate: Navigate = useCallback((to, options) => {
    const method = options?.replace ? 'replaceState' : 'pushState'
    window.history[method](null, '', to)
    const url = new URL(to, window.location.origin)
    setLocation({ pathname: normalizePath(url.pathname), search: url.search })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  const value = useMemo(() => ({ pathname: location.pathname, search: location.search, navigate }), [location, navigate])
  return <RouterContext.Provider value={value}>{children}</RouterContext.Provider>
}

function useRouter() {
  const value = useContext(RouterContext)
  if (!value) throw new Error('Router components must be used inside BrowserRouter')
  return value
}

export function useNavigate() {
  return useRouter().navigate
}

export function useLocation() {
  const { pathname, search } = useRouter()
  return { pathname, search }
}

export function useParams<T extends Record<string, string | undefined> = Record<string, string>>() {
  return useContext(ParamsContext) as T
}

export function Link({ to, onClick, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { to: string }) {
  const { navigate } = useRouter()
  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event)
    if (!event.defaultPrevented && event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey) {
      event.preventDefault()
      navigate(to)
    }
  }
  return <a {...props} href={to} onClick={handleClick} />
}

export function NavLink({
  to,
  end = false,
  className,
  ...props
}: Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'className'> & {
  to: string
  end?: boolean
  className?: string | ((state: { isActive: boolean }) => string)
}) {
  const { pathname } = useRouter()
  const target = normalizePath(to)
  const isActive = target === '/' || end ? pathname === target : pathname === target || pathname.startsWith(`${target}/`)
  const resolvedClassName = typeof className === 'function' ? className({ isActive }) : className
  return <Link {...props} to={to} className={resolvedClassName} aria-current={isActive ? 'page' : undefined} />
}

export function Route(_props: { path: string; element: ReactElement }) {
  return null
}

export function Routes({ children }: { children: ReactNode }) {
  const { pathname } = useRouter()
  const routes = Children.toArray(children) as ReactElement<{ path: string; element: ReactElement }>[]
  for (const route of routes) {
    const match = matchPath(route.props.path, pathname)
    if (match) return <ParamsContext.Provider value={match}>{route.props.element}</ParamsContext.Provider>
  }
  return null
}

function matchPath(pattern: string, pathname: string) {
  if (pattern === '*') return {}
  const patternParts = normalizePath(pattern).split('/').filter(Boolean)
  const pathParts = normalizePath(pathname).split('/').filter(Boolean)
  if (patternParts.length !== pathParts.length) return null
  const params: Record<string, string> = {}
  for (let index = 0; index < patternParts.length; index += 1) {
    const expected = patternParts[index]
    const actual = pathParts[index]
    if (expected.startsWith(':')) params[expected.slice(1)] = decodeURIComponent(actual)
    else if (expected !== actual) return null
  }
  return params
}

export function Navigate({ to, replace = false }: { to: string; replace?: boolean }) {
  const navigate = useNavigate()
  useEffect(() => navigate(to, { replace }), [navigate, replace, to])
  return null
}

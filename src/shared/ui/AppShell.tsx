import { ArrowClockwise, Basket, BookOpen, CaretLeft, CheckCircle, Clock, ClockCounterClockwise, DotsThree, Package, User, UserCircle, WarningCircle, WifiSlash } from '@phosphor-icons/react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useEffect, useState, type ReactNode } from 'react'
import { useGrocea } from '../../app/grocea-context'

const navItems = [
  { label: 'Pantry', path: '/pantry', icon: Package },
  { label: 'Recipes', path: '/recipes', icon: BookOpen },
  { label: 'Groceries', path: '/groceries', icon: Basket },
  { label: 'History', path: '/activity', icon: ClockCounterClockwise },
  { label: 'More', path: '/more', icon: DotsThree },
]

const morePaths = ['/more', '/profile', '/ingredients', '/categories', '/sync-issues', '/system-states']

function Wordmark({ className }: { className: string }) {
  return <Link className={className} to="/pantry"><img className="brand-mark" src="/brand/grocea-icon.png" alt="" />grocea</Link>
}

function Navigation() {
  const { pathname } = useLocation()
  return <nav className="primary-navigation" aria-label="Primary navigation">
    <Wordmark className="desktop-wordmark" />
    <div className="nav-links">{navItems.map(({ label, path, icon: Icon }) => <NavLink key={path} to={path} className={({ isActive }) => `nav-item${(isActive || (path === '/more' && morePaths.some(candidate => pathname === candidate || pathname.startsWith(`${candidate}/`)))) ? ' active' : ''}`}><Icon size={24} /><span>{label}</span></NavLink>)}</div>
  </nav>
}

export function AppShell({ children, navigation = false, action }: { children: ReactNode; navigation?: boolean; action?: ReactNode }) {
  return <div className={`app-shell${navigation ? ' with-navigation' : ''}`}>
    <a className="skip-link" href="#main-content">Skip to content</a>
    {navigation && <Navigation />}
    <div className="app-page" id="main-content">{children}{action}</div>
  </div>
}

export function BrandHeader({ action }: { action?: ReactNode }) {
  const { profile, syncStatus, pendingMutationCount } = useGrocea()
  const syncLabel = syncStatus === 'initial-sync' ? 'First sync pending' : syncStatus === 'syncing' ? 'Syncing' : syncStatus === 'failed' ? 'Sync issue' : syncStatus === 'offline' ? 'Offline' : pendingMutationCount ? `${pendingMutationCount} pending` : 'Synced'
  const status = syncStatus === 'initial-sync' ? 'initial-sync' : syncStatus === 'syncing' ? 'syncing' : syncStatus === 'failed' ? 'failed' : syncStatus === 'offline' ? 'offline' : pendingMutationCount ? 'pending' : 'synced'
  const StatusIcon = status === 'initial-sync' || status === 'syncing' ? ArrowClockwise : status === 'failed' ? WarningCircle : status === 'offline' ? WifiSlash : status === 'pending' ? Clock : CheckCircle
  return <><header className="brand-header"><Wordmark className="wordmark" /><div className="header-action"><Link to="/sync-issues" className={`sync-indicator ${status}`} aria-label={`Synchronization status: ${syncLabel}`} title={syncLabel}><StatusIcon size={21} weight={status === 'synced' ? 'fill' : 'bold'} aria-hidden="true" />{pendingMutationCount > 0 && <span className="sync-count" aria-hidden="true">{pendingMutationCount > 99 ? '99+' : pendingMutationCount}</span>}<span className="sr-only">{syncLabel}</span></Link>{action ?? <Link to="/profile" className="avatar" aria-label="Open profile">{profile.displayName.slice(0, 1).toUpperCase()}</Link>}</div></header><div className="app-header-offset" aria-hidden="true" /></>
}

export function BackHeader({ title, eyebrow, action, onBack, fallbackTo = '/pantry', titleAs = 'h1' }: { title: string; eyebrow?: string; action?: ReactNode; onBack?: () => void; fallbackTo?: string; titleAs?: 'h1' | 'span' }) {
  const navigate = useNavigate()
  const back = onBack ?? (() => {
    const index = (window.history.state as { idx?: number } | null)?.idx
    if (typeof index === 'number' && index > 0) navigate(-1)
    else navigate(fallbackTo, { replace: true })
  })
  const Title = titleAs
  return <><header className="back-header"><button className="icon-button" type="button" onClick={back} aria-label="Go back"><CaretLeft size={24} /></button><div><Title {...(titleAs === 'h1' ? { 'data-page-title': true, tabIndex: -1 } : {})}>{title}</Title>{eyebrow && <small>{eyebrow}</small>}</div><span className="header-action">{action ?? <span className="header-spacer" />}</span></header><div className="app-header-offset" aria-hidden="true" /></>
}

export function PageHeading({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return <header className="page-heading"><div><h1 data-page-title tabIndex={-1}>{title}</h1>{subtitle && <p>{subtitle}</p>}</div>{action}</header>
}

export function OwnershipMark({ label, className = '' }: { label: string; className?: string }) {
  return <span className={`ownership-mark${className ? ` ${className}` : ''}`} role="img" aria-label={label} title={label}><User size={15} weight="bold" aria-hidden="true" /></span>
}

export function EmptyState({ icon: Icon = UserCircle, title, message, action }: { icon?: typeof UserCircle; title: string; message: string; action?: ReactNode }) {
  return <div className="empty-state"><span className="empty-icon"><Icon size={28} /></span><h2>{title}</h2><p>{message}</p>{action}</div>
}

export function SuccessNotice({ message }: { message?: string }) { return message ? <div className="success-notice" role="status">{message}</div> : null }

export function ToastNotice({ message, action, onDismiss, durationMs = 4000 }: { message?: string; action?: ReactNode; onDismiss?: () => void; durationMs?: number }) {
  const [dismissedMessage, setDismissedMessage] = useState<string>()
  useEffect(() => {
    if (!message) return
    const timer = window.setTimeout(() => {
      setDismissedMessage(message)
      onDismiss?.()
    }, durationMs)
    return () => window.clearTimeout(timer)
  }, [durationMs, message, onDismiss])
  if (!message || dismissedMessage === message) return null
  const dismiss = () => {
    setDismissedMessage(message)
    onDismiss?.()
  }
  return <div className="toast-notice" role="status" aria-live="polite"><span>{message}</span>{action}<button className="toast-dismiss" type="button" aria-label="Dismiss notification" onClick={dismiss}>×</button></div>
}

export function UndoNotice({ message, onUndo, onDismiss, pending = false }: { message: string; onUndo: () => void; onDismiss: () => void; pending?: boolean }) {
  return <div className="undo-notice" role="status"><span>{message}</span><span className="undo-notice-actions"><button className="text-button" type="button" disabled={pending} onClick={onUndo}>{pending ? 'Restoring…' : 'Undo'}</button><button className="icon-button" type="button" aria-label="Dismiss notification" onClick={onDismiss}>×</button></span></div>
}

export function FormActions({ cancel, submit, disabled = false }: { cancel: () => void; submit: string; disabled?: boolean }) {
  return <div className="form-actions"><button type="button" className="button secondary" onClick={cancel}>Cancel</button><button type="submit" className="button primary" disabled={disabled}>{submit}</button></div>
}

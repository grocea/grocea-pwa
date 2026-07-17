import { BookOpen, CaretLeft, ClockCounterClockwise, DotsThree, Package, UserCircle } from '@phosphor-icons/react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useGrocea } from '../../app/grocea-context'

const navItems = [
  { label: 'Pantry', path: '/pantry', icon: Package },
  { label: 'Recipes', path: '/recipes', icon: BookOpen },
  { label: 'History', path: '/activity', icon: ClockCounterClockwise },
  { label: 'More', path: '/more', icon: DotsThree },
]

function Navigation() {
  return <nav className="primary-navigation" aria-label="Primary navigation">
    <Link className="desktop-wordmark" to="/pantry"><span>G</span>grocea</Link>
    <div className="nav-links">{navItems.map(({ label, path, icon: Icon }) => <NavLink key={path} to={path} className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}><Icon size={24} /><span>{label}</span></NavLink>)}</div>
  </nav>
}

export function AppShell({ children, navigation = false, action }: { children: ReactNode; navigation?: boolean; action?: ReactNode }) {
  return <div className={`app-shell${navigation ? ' with-navigation' : ''}`}>
    {navigation && <Navigation />}
    <div className="app-page">{children}{action}</div>
  </div>
}

export function BrandHeader({ action }: { action?: ReactNode }) {
  const { profile } = useGrocea()
  return <header className="brand-header"><Link to="/pantry" className="wordmark"><span>G</span>grocea</Link><div className="header-action">{action ?? <Link to="/profile" className="avatar" aria-label="Open profile">{profile.displayName.slice(0, 1).toUpperCase()}</Link>}</div></header>
}

export function BackHeader({ title, eyebrow, action, onBack }: { title: string; eyebrow?: string; action?: ReactNode; onBack?: () => void }) {
  const navigate = useNavigate()
  return <header className="back-header"><button className="icon-button" type="button" onClick={onBack ?? (() => navigate(-1))} aria-label="Go back"><CaretLeft size={24} /></button><div><strong>{title}</strong>{eyebrow && <small>{eyebrow}</small>}</div><span className="header-action">{action ?? <span className="header-spacer" />}</span></header>
}

export function PageHeading({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return <header className="page-heading"><div><h1>{title}</h1>{subtitle && <p>{subtitle}</p>}</div>{action}</header>
}

export function EmptyState({ icon: Icon = UserCircle, title, message, action }: { icon?: typeof UserCircle; title: string; message: string; action?: ReactNode }) {
  return <div className="empty-state"><span className="empty-icon"><Icon size={28} /></span><strong>{title}</strong><p>{message}</p>{action}</div>
}

export function SuccessNotice({ message }: { message?: string }) { return message ? <div className="success-notice" role="status">{message}</div> : null }

export function FormActions({ cancel, submit, disabled = false }: { cancel: () => void; submit: string; disabled?: boolean }) {
  return <div className="form-actions"><button type="button" className="button secondary" onClick={cancel}>Cancel</button><button type="submit" className="button primary" disabled={disabled}>{submit}</button></div>
}

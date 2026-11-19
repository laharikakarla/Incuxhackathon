import { useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { ArrowUpRight, Menu, X, User, LogOut, LayoutDashboard, Shield } from 'lucide-react'
import { Button } from '../ui/Button'
import { ThemeToggle } from '../ui/ThemeToggle'
import { useAuth } from '../../auth/AuthContext'

const links = [
  ['Explore', '/explore'],
  ['Domains', '/domains'],
  ['Timeline', '/timeline'],
  ['Prizes', '/prizes'],
  ['Evaluation', '/evaluation'],
  ['Community', '/community'],
  ['Rules & FAQs', '/rules'],
  ['About', '/about'],
] as const

export function Header() {
  const [open, setOpen] = useState(false)
  const { user, signOut } = useAuth()
  const navigate = useNavigate()

  return (
    <header className="site-header">
      <div className="nav-wrap container">
        <Link to="/" className="brand text-brand-only" aria-label="AICUXORA home">
          <span className="brand-text">
            AICUXORA <b>2027</b>
            <small>BY INCUX AI</small>
          </span>
        </Link>

        <nav className="desktop-nav" aria-label="Main navigation">
          {links.map(([label, to]) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
            >
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="nav-actions">
          <ThemeToggle />
          {user ? (
            <div className="auth-header-pill">
              <Link
                to={user.role === 'student' ? '/student' : '/admin'}
                className="portal-badge-link"
              >
                {user.role === 'student' ? <LayoutDashboard size={14} /> : <Shield size={14} />}
                <span>{user.role === 'student' ? 'Dashboard' : 'Admin'}</span>
              </Link>
              <button
                type="button"
                className="header-logout-btn"
                title="Sign out"
                aria-label="Sign out"
                onClick={async () => {
                  await signOut()
                  navigate('/login')
                }}
              >
                <LogOut size={14} />
              </button>
            </div>
          ) : (
            <>
              <Link to="/login" className="login-link">
                Log in
              </Link>
              <Button to="/register" arrow>
                Register
              </Button>
            </>
          )}
        </div>

        <button
          className="menu-toggle"
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
          onClick={() => setOpen(!open)}
        >
          {open ? <X /> : <Menu />}
        </button>
      </div>

      {open && (
        <nav className="mobile-nav" aria-label="Mobile navigation">
          <div className="mobile-theme-row">
            <span>Theme Appearance</span>
            <ThemeToggle showLabel />
          </div>
          {links.map(([label, to]) => (
            <NavLink key={to} onClick={() => setOpen(false)} to={to}>
              {label}
              <ArrowUpRight size={16} />
            </NavLink>
          ))}
          {user ? (
            <>
              <Link
                onClick={() => setOpen(false)}
                to={user.role === 'student' ? '/student' : '/admin'}
                className="mobile-portal-link"
              >
                <User size={15} /> {user.fullName} ({user.role === 'student' ? 'Dashboard' : 'Admin'})
              </Link>
              <button
                type="button"
                className="mobile-nav-logout"
                onClick={async () => {
                  setOpen(false)
                  await signOut()
                  navigate('/login')
                }}
              >
                <LogOut size={15} /> Sign out
              </button>
            </>
          ) : (
            <>
              <Link onClick={() => setOpen(false)} to="/login">
                Log in
              </Link>
              <Link onClick={() => setOpen(false)} to="/register">
                Register now
              </Link>
            </>
          )}
        </nav>
      )}
    </header>
  )
}

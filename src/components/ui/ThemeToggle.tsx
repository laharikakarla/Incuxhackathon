import { Sun, Moon } from 'lucide-react'
import { useTheme } from '../../context/ThemeContext'

interface ThemeToggleProps {
  className?: string
  showLabel?: boolean
}

export function ThemeToggle({ className = '', showLabel = false }: ThemeToggleProps) {
  const { theme, toggleTheme } = useTheme()
  const isLight = theme === 'light'

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`theme-toggle-btn ${className}`}
      aria-label={isLight ? 'Switch to dark mode' : 'Switch to light mode'}
      title={isLight ? 'Switch to dark mode' : 'Switch to light mode'}
    >
      <span className="theme-toggle-icon" aria-hidden="true">
        {isLight ? (
          <Sun size={15} className="sun-icon" />
        ) : (
          <Moon size={15} className="moon-icon" />
        )}
      </span>
      {showLabel ? (
        <span className="theme-label-text">{isLight ? 'Light Mode' : 'Dark Mode'}</span>
      ) : (
        <span className="theme-label-badge">{isLight ? 'Light' : 'Dark'}</span>
      )}
    </button>
  )
}

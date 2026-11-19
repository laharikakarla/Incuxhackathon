import { Link, type LinkProps } from 'react-router-dom'
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { ArrowUpRight } from 'lucide-react'

type Props = ButtonHTMLAttributes<HTMLButtonElement> & { to?: LinkProps['to']; variant?: 'primary' | 'secondary' | 'ghost'; children: ReactNode; arrow?: boolean }

export function Button({ to, variant = 'primary', children, arrow = false, className = '', ...props }: Props) {
  const classes = `button button-${variant} ${className}`
  const content = <>{children}{arrow && <ArrowUpRight size={17} aria-hidden="true" />}</>
  return to ? <Link className={classes} to={to}>{content}</Link> : <button className={classes} {...props}>{content}</button>
}

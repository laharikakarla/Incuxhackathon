import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { domAnimation, LazyMotion } from 'framer-motion'
import { RouterProvider } from 'react-router-dom'
import { router } from './router'
import { AuthProvider } from '../auth/AuthProvider'
import { ToastProvider } from '../context/ToastContext'
import { ThemeProvider } from '../context/ThemeContext'

const queryClient = new QueryClient()

export function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ToastProvider>
          <QueryClientProvider client={queryClient}>
            <LazyMotion features={domAnimation}>
              <RouterProvider router={router} />
            </LazyMotion>
          </QueryClientProvider>
        </ToastProvider>
      </AuthProvider>
    </ThemeProvider>
  )
}

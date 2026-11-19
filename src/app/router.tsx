import { createBrowserRouter } from 'react-router-dom'
import { PublicLayout } from '../components/layout/PublicLayout'
import { PortalLayout } from '../components/layout/PortalLayout'
import { AboutPage, CommunityPage, ContactPage, EvaluationPage, FaqPage, HomePage, LoginPage, NotFoundPage, PrizesPage, RegisterPage, TimelinePage, TracksPage } from '../pages/public/Pages'
import { ExplorePage } from '../pages/public/ExplorePage'
import { AdminDashboardPage, AdminWorkspacePage, EmailVerificationPage, ForgotPasswordPage, ResetPasswordPage, StudentAnnouncementsPage, StudentDashboardPage, StudentProfilePage, StudentSubmissionsPage, StudentTeamPage } from '../pages/PortalPages'

export const router = createBrowserRouter([
  {
    element: <PublicLayout />,
    children: [
      { path: '/', element: <HomePage /> },
      { path: '/explore', element: <ExplorePage /> },
      { path: '/about', element: <AboutPage /> },
      { path: '/domains', element: <TracksPage /> },
      { path: '/tracks', element: <TracksPage /> },
      { path: '/timeline', element: <TimelinePage /> },
      { path: '/prizes', element: <PrizesPage /> },
      { path: '/evaluation', element: <EvaluationPage /> },
      { path: '/rules', element: <FaqPage /> },
      { path: '/community', element: <CommunityPage /> },
      { path: '/login', element: <LoginPage /> },
      { path: '/register', element: <RegisterPage /> },
      { path: '/verify-email', element: <EmailVerificationPage /> },
      { path: '/forgot-password', element: <ForgotPasswordPage /> },
      { path: '/reset-password', element: <ResetPasswordPage /> },
      { path: '/faq', element: <FaqPage /> },
      { path: '/contact', element: <ContactPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
  {
    path: '/student',
    element: <PortalLayout />,
    children: [
      { index: true, element: <StudentDashboardPage /> },
      { path: 'profile', element: <StudentProfilePage /> },
      { path: 'team', element: <StudentTeamPage /> },
      { path: 'announcements', element: <StudentAnnouncementsPage /> },
      { path: 'submissions', element: <StudentSubmissionsPage /> },
    ],
  },
  {
    path: '/admin',
    element: <PortalLayout />,
    children: [
      { index: true, element: <AdminDashboardPage /> },
      { path: 'students', element: <AdminWorkspacePage /> },
      { path: 'registrations', element: <AdminWorkspacePage /> },
      { path: 'teams', element: <AdminWorkspacePage /> },
      { path: 'domains', element: <AdminWorkspacePage /> },
      { path: 'prizes', element: <AdminWorkspacePage /> },
      { path: 'event', element: <AdminWorkspacePage /> },
      { path: 'announcements', element: <AdminWorkspacePage /> },
      { path: 'faqs', element: <AdminWorkspacePage /> },
      { path: 'invitations', element: <AdminWorkspacePage /> },
      { path: 'permissions', element: <AdminWorkspacePage /> },
      { path: 'audit', element: <AdminWorkspacePage /> },
    ],
  },
])

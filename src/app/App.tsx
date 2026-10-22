import { Route, Routes } from 'react-router-dom'
import { StudentStart } from './StudentStart'
import { AppShell } from '../components/AppShell'
import { AuthPage } from '../pages/AuthPage'
import { OnboardingPage } from '../pages/OnboardingPage'
import { AssessmentPage } from '../pages/AssessmentPage'
import { ResourcesPage } from '../pages/ResourcesPage'
import { RecommendationsPage } from '../pages/RecommendationsPage'
import { NotFoundPage } from '../pages/NotFoundPage'
import { RequireAuth } from '../auth/RequireAuth'
export function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="login" element={<AuthPage key="login" />} />
        <Route path="register" element={<AuthPage key="register" register />} />
        <Route element={<RequireAuth />}>
          <Route index element={<StudentStart />} />
          <Route path="onboarding" element={<OnboardingPage />} />
          <Route path="assessment" element={<AssessmentPage />} />
          <Route path="recommendations" element={<RecommendationsPage />} />
        </Route>
        <Route path="resources" element={<ResourcesPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}

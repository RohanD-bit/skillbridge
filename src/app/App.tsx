import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from '../components/AppShell'
import { AuthPage } from '../pages/AuthPage'
import { OnboardingPage } from '../pages/OnboardingPage'
import { AssessmentPage } from '../pages/AssessmentPage'
import { ResourcesPage } from '../pages/ResourcesPage'
import { RecommendationsPage } from '../pages/RecommendationsPage'
import { NotFoundPage } from '../pages/NotFoundPage'
export function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<Navigate to="/onboarding" replace />} />
        <Route path="login" element={<AuthPage />} />
        <Route path="register" element={<AuthPage register />} />
        <Route path="onboarding" element={<OnboardingPage />} />
        <Route path="assessment" element={<AssessmentPage />} />
        <Route path="resources" element={<ResourcesPage />} />
        <Route path="recommendations" element={<RecommendationsPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}

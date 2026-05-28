import { useEffect } from 'react'
import { BrowserRouter, Route, Routes, Navigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'

import MainPage from '@/pages/MainPage'
import BatchPage from '@/pages/BatchPage'
import SettingsPage from '@/pages/SettingsPage'
import Sidebar from '@/components/Sidebar'
import Header from '@/components/Header'
import { useAppStore } from '@/store/useAppStore'

// Page transition variants
const pageVariants = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
  exit:    { opacity: 0, y: -4 },
}

const pageTransition = {
  duration: 0.22,
  ease: [0.4, 0, 0.2, 1] as const,
}

export default function App() {
  const apiBaseUrl = useAppStore(state => state.settings.apiBaseUrl)

  // Verify backend is alive on mount
  useEffect(() => {
    fetch(`${apiBaseUrl}/health/ping`)
      .then(r => r.json())
      .then(data => {
        if (data.status === 'alive') {
          console.info('✅ Nativeify backend connected')
        }
      })
      .catch(() => {
        console.warn('⚠️ Backend not reachable — start the FastAPI server on port 8000')
      })
  }, [apiBaseUrl])

  return (
    <BrowserRouter>
      {/* ── App Shell ──────────────────────────────────── */}
      <div className="flex flex-col h-screen overflow-hidden bg-surface">

        {/* Top header bar */}
        <Header />

        {/* Main layout: sidebar + content */}
        <div className="flex flex-1 overflow-hidden">

          {/* Sidebar navigation */}
          <Sidebar />

          {/* Page content area */}
          <main className="flex-1 overflow-y-auto bg-surface relative">
            {/* Subtle grid background */}
            <div className="absolute inset-0 bg-grid opacity-50 pointer-events-none" />

            {/* Top-left ambient glow */}
            <div
              className="absolute top-0 left-1/4 w-[600px] h-[400px] pointer-events-none"
              style={{
                background:
                  'radial-gradient(ellipse at top, rgba(124,92,252,0.06) 0%, transparent 70%)',
              }}
            />

            <AnimatePresence mode="wait">
              <Routes>
                <Route
                  path="/"
                  element={
                    <motion.div
                      key="main"
                      variants={pageVariants}
                      initial="initial"
                      animate="animate"
                      exit="exit"
                      transition={pageTransition}
                      className="h-full"
                    >
                      <MainPage />
                    </motion.div>
                  }
                />
                <Route
                  path="/batch"
                  element={
                    <motion.div
                      key="batch"
                      variants={pageVariants}
                      initial="initial"
                      animate="animate"
                      exit="exit"
                      transition={pageTransition}
                      className="h-full"
                    >
                      <BatchPage />
                    </motion.div>
                  }
                />
                <Route
                  path="/settings"
                  element={
                    <motion.div
                      key="settings"
                      variants={pageVariants}
                      initial="initial"
                      animate="animate"
                      exit="exit"
                      transition={pageTransition}
                      className="h-full"
                    >
                      <SettingsPage />
                    </motion.div>
                  }
                />
                {/* Catch-all → home */}
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </AnimatePresence>
          </main>
        </div>
      </div>
    </BrowserRouter>
  )
}

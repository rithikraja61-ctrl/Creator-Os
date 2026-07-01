import React from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthGuard } from 'lemma-sdk/react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { lemmaClient } from './lemma-client'
import { BackgroundTaskProvider } from './contexts/BackgroundTaskContext'
import { Layout } from './components/Layout'
import { Dashboard } from './pages/Dashboard'
import { Ideas } from './pages/Ideas'
import { KnowledgeBase } from './pages/KnowledgeBase'
import { Themes } from './pages/Themes'
import { AIWriter } from './pages/AIWriter'
import { ContentQueue } from './pages/ContentQueue'
import { Review } from './pages/Review'
import './styles.css'

const queryClient = new QueryClient()

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthGuard
        client={lemmaClient}
        loadingFallback={
          <main className="app-layout">
            <section className="main-content" style={{ marginLeft: 240 }}>
              <div className="card">
                <div className="skeleton" style={{ height: 40, marginBottom: 16 }} />
                <div className="skeleton" style={{ height: 200 }} />
              </div>
            </section>
          </main>
        }
      >
        <BackgroundTaskProvider>
          <BrowserRouter>
            <Routes>
              <Route element={<Layout />}>
                <Route path="/" element={<Dashboard />} />
                <Route path="/ideas" element={<Ideas />} />
                <Route path="/knowledge" element={<KnowledgeBase />} />
                <Route path="/themes" element={<Themes />} />
                <Route path="/writer" element={<AIWriter />} />
                <Route path="/queue" element={<ContentQueue />} />
                <Route path="/review" element={<Review />} />
              </Route>
            </Routes>
          </BrowserRouter>
        </BackgroundTaskProvider>
      </AuthGuard>
    </QueryClientProvider>
  </React.StrictMode>,
)

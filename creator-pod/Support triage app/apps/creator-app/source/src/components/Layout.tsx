import { NavLink, Outlet } from 'react-router-dom'
import {
  LayoutDashboard, Inbox, Database, Palette,
  FileText, Sparkles, CheckSquare,
  PenLine, Columns3, Lightbulb
} from 'lucide-react'
import { FloatingTaskCenter } from './background-tasks/FloatingTaskCenter'

export function Layout() {
  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-header">
          <NavLink to="/" className="sidebar-brand">
            <PenLine size={22} />
            <div>
              <div className="sidebar-brand-name">Creator OS</div>
              <div className="sidebar-brand-sub">Content Backoffice</div>
            </div>
          </NavLink>
        </div>

        <nav className="sidebar-nav">
          <div className="nav-section-label">Workspace</div>
          <NavLink to="/" end className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
            <LayoutDashboard size={18} />
            <span>Dashboard</span>
          </NavLink>
          <NavLink to="/ideas" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
            <Inbox size={18} />
            <span>Idea Inbox</span>
          </NavLink>
          <NavLink to="/knowledge" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
            <Database size={18} />
            <span>Knowledge Base</span>
          </NavLink>
          <NavLink to="/themes" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
            <Palette size={18} />
            <span>Themes</span>
          </NavLink>

          <div className="nav-section-label">Create</div>
          <NavLink to="/writer" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
            <Sparkles size={18} />
            <span>AI Writer</span>
          </NavLink>
          <NavLink to="/queue" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
            <Columns3 size={18} />
            <span>Content Queue</span>
          </NavLink>
          <NavLink to="/review" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
            <CheckSquare size={18} />
            <span>Review</span>
          </NavLink>
        </nav>
      </aside>

      <main className="main-content">
        <Outlet />
      </main>

      {/* Global background task center — always mounted */}
      <FloatingTaskCenter />
    </div>
  )
}

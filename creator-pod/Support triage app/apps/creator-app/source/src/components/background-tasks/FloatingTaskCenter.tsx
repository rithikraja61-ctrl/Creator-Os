import { useState, useEffect, useRef } from 'react'
import { useBackgroundTasks, BackgroundTask, TaskStatus } from '../../contexts/BackgroundTaskContext'
import {
  X, Loader2, CheckCircle, AlertCircle, Clock,
  Maximize2, Minimize2, ChevronRight, RefreshCw,
  Ban, Trash2
} from 'lucide-react'

// ── Helpers ──

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}m ${s}s`
}

function statusColor(status: TaskStatus): string {
  switch (status) {
    case 'queued': return '#818cf8'
    case 'running': return '#818cf8'
    case 'completed': return '#4ade80'
    case 'failed': return '#f87171'
    case 'cancelled': return '#9ca3af'
  }
}

function StatusIcon({ status, size = 16 }: { status: TaskStatus; size?: number }) {
  switch (status) {
    case 'queued':
      return <Clock size={size} style={{ color: '#818cf8' }} />
    case 'running':
      return <Loader2 size={size} style={{ color: '#818cf8', animation: 'ftcSpin 1s linear infinite' }} />
    case 'completed':
      return <CheckCircle size={size} style={{ color: '#4ade80' }} />
    case 'failed':
      return <AlertCircle size={size} style={{ color: '#f87171' }} />
    case 'cancelled':
      return <Ban size={size} style={{ color: '#9ca3af' }} />
  }
}

// ── Individual Task Card ──

function TaskCard({
  task,
  onDismiss,
  onRetry,
  onCancel,
  compact = false,
}: {
  task: BackgroundTask
  onDismiss: () => void
  onRetry?: () => void
  onCancel?: () => void
  compact?: boolean
}) {
  const [expanded, setExpanded] = useState(false)
  const isRunning = task.status === 'queued' || task.status === 'running'
  const isFinished = task.status === 'completed' || task.status === 'failed' || task.status === 'cancelled'
  const color = statusColor(task.status)

  if (compact) {
    return (
      <div
        style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '10px 14px',
          cursor: 'pointer',
        }}
        onClick={() => setExpanded(!expanded)}
      >
        <StatusIcon status={task.status} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: '#f0f0f0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {task.title}
          </div>
          {isRunning && (
            <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{
                flex: 1, height: 3, background: 'rgba(255,255,255,0.08)', borderRadius: 2, overflow: 'hidden',
              }}>
                <div style={{
                  height: '100%', borderRadius: 2,
                  width: `${task.progress}%`,
                  background: 'linear-gradient(90deg, #818cf8, #a78bfa)',
                  transition: 'width 0.4s ease',
                }} />
              </div>
              <span style={{ fontSize: 11, color: '#9ca3af', minWidth: 28, textAlign: 'right' }}>{task.progress}%</span>
            </div>
          )}
          {isFinished && task.duration !== undefined && (
            <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>
              <Clock size={10} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 3 }} />
              {formatDuration(task.duration)}
            </div>
          )}
        </div>
        {isRunning && (
          <button
            onClick={(e) => { e.stopPropagation(); setExpanded(!expanded) }}
            style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', padding: 2 }}
          >
            <ChevronRight size={14} style={{ transform: expanded ? 'rotate(90deg)' : undefined, transition: '0.2s' }} />
          </button>
        )}
        <button
          onClick={(e) => { e.stopPropagation(); onDismiss() }}
          style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', padding: 2 }}
        >
          <X size={14} />
        </button>
      </div>
    )
  }

  return (
    <div style={{
      borderBottom: '1px solid rgba(255,255,255,0.06)',
      padding: '14px 16px',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <StatusIcon status={task.status} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#f0f0f0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {task.title}
            </div>
            {isRunning && task.currentStep > 0 && task.steps[task.currentStep] && (
              <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>
                {task.steps[task.currentStep].label}
              </div>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
          {isRunning && onCancel && (
            <button
              onClick={onCancel}
              style={iconBtnStyle}
              title="Cancel"
            >
              <Ban size={14} />
            </button>
          )}
          <button
            onClick={() => setExpanded(!expanded)}
            style={iconBtnStyle}
            title={expanded ? 'Less info' : 'More info'}
          >
            {expanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>
          {(isFinished) && (
            <button
              onClick={onDismiss}
              style={iconBtnStyle}
              title="Dismiss"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Progress bar (running only) */}
      {isRunning && (
        <div style={{ marginBottom: 10 }}>
          <div style={{
            height: 4, background: 'rgba(255,255,255,0.08)', borderRadius: 2,
            overflow: 'hidden', marginBottom: 6,
          }}>
            <div style={{
              height: '100%', borderRadius: 2,
              width: `${task.progress}%`,
              background: 'linear-gradient(90deg, #818cf8, #a78bfa)',
              transition: 'width 0.5s ease',
            }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#9ca3af' }}>
            <span>{task.progress}%</span>
            {task.startedAt && (
              <span>
                <Clock size={10} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 3 }} />
                {formatDuration(Math.floor((Date.now() - task.startedAt) / 1000))}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Step dots (running) */}
      {expanded && isRunning && task.steps.length > 1 && (
        <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {task.steps.map((step, i) => {
            const isDone = task.currentStep > i
            const isActive = task.currentStep === i
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11 }}>
                <div style={{
                  width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                  background: isDone ? '#4ade80' : isActive ? '#818cf8' : 'rgba(255,255,255,0.15)',
                  boxShadow: isActive ? '0 0 6px rgba(129,140,248,0.5)' : 'none',
                  transition: 'all 0.3s',
                }} />
                <span style={{
                  flex: 1, color: isDone ? '#4ade80' : isActive ? '#c7d2fe' : 'rgba(255,255,255,0.35)',
                }}>
                  {step.label}
                </span>
                <span style={{ color: 'rgba(255,255,255,0.25)' }}>{step.pct}%</span>
              </div>
            )
          })}
        </div>
      )}

      {/* Expanded: completion summary */}
      {expanded && task.status === 'completed' && task.duration !== undefined && (
        <div style={{ fontSize: 12, color: '#d1d5db', lineHeight: 1.6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#4ade80', marginBottom: 4 }}>
            <CheckCircle size={12} />
            <span>Completed in {formatDuration(task.duration)}</span>
          </div>
          {task.metadata?.summary && (
            <div style={{ color: '#9ca3af' }}>{task.metadata.summary}</div>
          )}
        </div>
      )}

      {/* Expanded: error */}
      {expanded && task.status === 'failed' && (
        <div style={{ fontSize: 12 }}>
          <div style={{ color: '#f87171', marginBottom: 6 }}>
            {task.error || 'An error occurred'}
          </div>
          {onRetry && (
            <button
              onClick={onRetry}
              style={{
                background: 'rgba(129,140,248,0.15)', color: '#818cf8',
                border: 'none', borderRadius: 8, padding: '6px 14px',
                fontSize: 12, fontWeight: 500, cursor: 'pointer',
                display: 'inline-flex', alignItems: 'center', gap: 6,
                transition: '0.15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(129,140,248,0.25)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'rgba(129,140,248,0.15)')}
            >
              <RefreshCw size={12} />
              Retry
            </button>
          )}
        </div>
      )}

      {/* Expanded: cancelled */}
      {expanded && task.status === 'cancelled' && (
        <div style={{ fontSize: 12, color: '#9ca3af' }}>
          This task was cancelled.
        </div>
      )}
    </div>
  )
}

const iconBtnStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.06)',
  border: 'none', borderRadius: 6, cursor: 'pointer',
  padding: '4px 5px', color: '#9ca3af',
  display: 'flex', alignItems: 'center',
  transition: '0.15s',
}

// ── Floating Task Center Container ──

export function FloatingTaskCenter() {
  const {
    tasks, activeTasks, completedTasks, failedTasks,
    cancelTask, retryTask, dismissTask, clearCompleted,
  } = useBackgroundTasks()

  const [minimized, setMinimized] = useState(false)
  const [autoHideTimers, setAutoHideTimers] = useState<Set<string>>(new Set())
  const prevCompletedRef = useRef(0)

  // Auto-minimize newly completed tasks after 3s
  const completedCount = completedTasks.length + failedTasks.length
  const newlyCompleted = completedCount > prevCompletedRef.current
  prevCompletedRef.current = completedCount

  useEffect(() => {
    if (newlyCompleted && !minimized) {
      const timer = setTimeout(() => {
        setMinimized(true)
      }, 4000)
      return () => clearTimeout(timer)
    }
  }, [completedCount, newlyCompleted, minimized])

  // Don't render if no tasks at all
  if (tasks.length === 0) return null

  const totalActive = activeTasks.length
  const totalFinished = completedTasks.length + failedTasks.length

  // Find the most recent active task for the mini preview
  const latestActive = activeTasks[activeTasks.length - 1]
  const latestCompleted = [...completedTasks, ...failedTasks]
    .sort((a, b) => (b.finishedAt || 0) - (a.finishedAt || 0))[0]

  // ── Minimized chip ──
  if (minimized) {
    return (
      <div
        onClick={() => setMinimized(false)}
        style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 300,
          background: 'rgba(22, 22, 28, 0.92)',
          backdropFilter: 'blur(18px)',
          WebkitBackdropFilter: 'blur(18px)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 12,
          boxShadow: '0 6px 20px rgba(0,0,0,0.3)',
          padding: '10px 16px',
          display: 'flex', alignItems: 'center', gap: 8,
          cursor: 'pointer',
          animation: 'ftcSlideIn 0.2s ease-out',
          fontSize: 13,
          color: '#f0f0f0',
          maxWidth: 280,
        }}
        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(30, 30, 38, 0.95)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'rgba(22, 22, 28, 0.92)')}
      >
        {totalActive > 0 ? (
          <>
            <Loader2 size={14} style={{ color: '#818cf8', animation: 'ftcSpin 1s linear infinite' }} />
            <span style={{ fontWeight: 500, flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {latestActive?.title || `${totalActive} task${totalActive > 1 ? 's' : ''} running`}
            </span>
            <span style={{ fontSize: 11, color: '#9ca3af' }}>{latestActive?.progress || 0}%</span>
          </>
        ) : (
          <>
            <CheckCircle size={14} style={{ color: '#4ade80' }} />
            <span style={{ fontWeight: 500, flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {totalFinished} task{totalFinished !== 1 ? 's' : ''} complete
            </span>
          </>
        )}
        <Maximize2 size={12} style={{ color: '#6b7280', marginLeft: 4 }} />
      </div>
    )
  }

  // ── Expanded panel ──
  return (
    <div
      style={{
        position: 'fixed', bottom: 24, right: 24, zIndex: 300,
        width: 420, maxHeight: 480,
        background: 'rgba(22, 22, 28, 0.92)',
        backdropFilter: 'blur(18px)',
        WebkitBackdropFilter: 'blur(18px)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 14,
        boxShadow: '0 8px 32px rgba(0,0,0,0.35), 0 0 0 1px rgba(255,255,255,0.04)',
        color: '#f0f0f0',
        fontSize: 13,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        animation: 'ftcSlideIn 0.25s ease-out',
      }}
    >
      {/* ── Header ── */}
      <div style={{
        display: 'flex', alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 16px',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {totalActive > 0 ? (
            <Loader2 size={15} style={{ color: '#818cf8', animation: 'ftcSpin 1s linear infinite' }} />
          ) : (
            <CheckCircle size={15} style={{ color: '#4ade80' }} />
          )}
          <span style={{ fontWeight: 600, fontSize: 14, color: '#f0f0f0' }}>
            Background Tasks
          </span>
          {totalActive > 0 && (
            <span style={{
              background: 'rgba(129,140,248,0.2)', color: '#818cf8',
              fontSize: 10, fontWeight: 600, padding: '1px 7px',
              borderRadius: 20,
            }}>
              {totalActive} active
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {totalFinished > 0 && (
            <button
              onClick={clearCompleted}
              style={iconBtnStyle}
              title="Clear completed"
            >
              <Trash2 size={13} />
            </button>
          )}
          <button
            onClick={() => setMinimized(true)}
            style={iconBtnStyle}
            title="Minimize"
          >
            <Minimize2 size={14} />
          </button>
        </div>
      </div>

      {/* ── Task List ── */}
      <div style={{
        overflowY: 'auto', flex: 1,
        maxHeight: 380,
      }}>
        {/* Active tasks first */}
        {activeTasks.map(task => (
          <TaskCard
            key={task.id}
            task={task}
            onDismiss={() => dismissTask(task.id)}
            onCancel={() => cancelTask(task.id)}
            onRetry={() => retryTask(task.id)}
          />
        ))}

        {/* Completed/failed separator */}
        {activeTasks.length > 0 && (completedTasks.length > 0 || failedTasks.length > 0) && (
          <div style={{
            padding: '8px 16px', fontSize: 10, fontWeight: 600,
            color: 'rgba(255,255,255,0.25)', textTransform: 'uppercase',
            letterSpacing: 0.5,
          }}>
            Recent
          </div>
        )}

        {/* Completed/failed tasks */}
        {[...completedTasks, ...failedTasks]
          .sort((a, b) => (b.finishedAt || 0) - (a.finishedAt || 0))
          .slice(0, 10)
          .map(task => (
            <TaskCard
              key={task.id}
              task={task}
              onDismiss={() => dismissTask(task.id)}
              onRetry={task.status === 'failed' ? () => retryTask(task.id) : undefined}
            />
          ))
        }

        {tasks.length === 0 && (
          <div style={{ padding: 24, textAlign: 'center', color: '#6b7280', fontSize: 12 }}>
            No background tasks
          </div>
        )}
      </div>
    </div>
  )
}

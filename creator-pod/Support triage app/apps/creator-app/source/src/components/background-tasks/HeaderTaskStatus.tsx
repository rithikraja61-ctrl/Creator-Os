import { useBackgroundTasks } from '../../contexts/BackgroundTaskContext'
import { CheckCircle, AlertTriangle, Loader2, Clock } from 'lucide-react'

type ThemesStatus = 'up-to-date' | 'outdated' | 'clustering'

export function HeaderTaskStatus({
  themesStatus = 'up-to-date',
  onRecluster,
  onOpenTaskCenter,
  isReclusterDisabled = false,
}: {
  themesStatus?: ThemesStatus
  onRecluster?: () => void
  onOpenTaskCenter?: () => void
  isReclusterDisabled?: boolean
}) {
  const { activeTasks } = useBackgroundTasks()
  const clusterTask = activeTasks.find(t => t.type === 'theme_clustering')

  // If a clustering task is running, show that
  if (clusterTask) {
    return (
      <div
        onClick={onOpenTaskCenter}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '5px 12px', borderRadius: 20,
          fontSize: 12, fontWeight: 500,
          background: 'rgba(129,140,248,0.15)',
          color: '#818cf8',
          cursor: 'pointer',
          transition: '0.15s',
          border: '1px solid rgba(129,140,248,0.2)',
        }}
        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(129,140,248,0.22)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'rgba(129,140,248,0.15)')}
      >
        <Loader2 size={13} style={{ animation: 'ftcSpin 1s linear infinite' }} />
        <span>Reclustering…</span>
        <span style={{
          background: 'rgba(129,140,248,0.25)',
          padding: '1px 6px', borderRadius: 10,
          fontSize: 10, fontWeight: 600,
        }}>
          {clusterTask.progress}%
        </span>
      </div>
    )
  }

  // Otherwise show themes status
  const config: Record<ThemesStatus, {
    icon: typeof CheckCircle
    bg: string
    color: string
    label: string
    border: string
  }> = {
    'up-to-date': {
      icon: CheckCircle, bg: 'rgba(74,222,128,0.1)',
      color: '#4ade80', label: 'Themes up to date',
      border: 'rgba(74,222,128,0.15)',
    },
    'outdated': {
      icon: AlertTriangle, bg: 'rgba(251,191,36,0.12)',
      color: '#fbbf24', label: 'Themes need updating',
      border: 'rgba(251,191,36,0.2)',
    },
    'clustering': {
      icon: Clock, bg: 'rgba(129,140,248,0.15)',
      color: '#818cf8', label: 'Processing…',
      border: 'rgba(129,140,248,0.2)',
    },
  }

  const c = config[themesStatus]
  const Icon = c.icon

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div
        onClick={themesStatus !== 'up-to-date' ? onOpenTaskCenter : undefined}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '5px 12px', borderRadius: 20,
          fontSize: 12, fontWeight: 500,
          background: c.bg,
          color: c.color,
          cursor: themesStatus !== 'up-to-date' ? 'pointer' : 'default',
          transition: '0.15s',
          border: `1px solid ${c.border}`,
        }}
        onMouseEnter={e => {
          if (themesStatus !== 'up-to-date') e.currentTarget.style.background = c.bg.replace('0.1', '0.2').replace('0.12', '0.22')
        }}
        onMouseLeave={e => { e.currentTarget.style.background = c.bg }}
      >
        <Icon size={13} />
        <span>{c.label}</span>
      </div>

      {themesStatus === 'outdated' && onRecluster && (
        <button
          onClick={onRecluster}
          disabled={isReclusterDisabled}
          style={{
            background: 'rgba(129,140,248,0.15)', color: '#818cf8',
            border: '1px solid rgba(129,140,248,0.2)',
            borderRadius: 20, padding: '5px 14px',
            fontSize: 12, fontWeight: 500, cursor: 'pointer',
            transition: '0.15s', whiteSpace: 'nowrap',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(129,140,248,0.25)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'rgba(129,140,248,0.15)')}
        >
          Recluster
        </button>
      )}
    </div>
  )
}

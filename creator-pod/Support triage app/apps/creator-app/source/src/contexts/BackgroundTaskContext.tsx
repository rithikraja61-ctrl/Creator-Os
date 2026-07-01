import React, {
  createContext, useContext, useReducer, useCallback,
  useRef, useEffect, useMemo
} from 'react'
import { lemmaClient } from '../lemma-client'
import { notifyTableChanged } from '../lib/refresh-bus'

// ── Types ──

export type TaskType =
  | 'theme_clustering'
  | 'content_generation'
  | 'pdf_processing'
  | 'knowledge_extraction'
  | 'bulk_tagging'

export type TaskStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled'

export interface TaskStep {
  label: string
  pct: number
}

export interface BackgroundTask {
  id: string
  type: TaskType
  title: string
  status: TaskStatus
  progress: number            // 0–100
  currentStep: number         // index into steps[]
  steps: TaskStep[]
  startedAt: number
  finishedAt?: number
  duration?: number           // computed on finish
  conversationId?: string
  agentName?: string
  canRetry: boolean
  canCancel: boolean
  error?: string
  metadata: Record<string, any>
}

// ── Default step sets per task type ──

export const CLUSTER_STEPS: TaskStep[] = [
  { label: 'Loading ideas', pct: 5 },
  { label: 'Cleaning previous clusters', pct: 15 },
  { label: 'Generating embeddings', pct: 30 },
  { label: 'Grouping ideas', pct: 45 },
  { label: 'Generating summaries', pct: 60 },
  { label: 'Calculating trend scores', pct: 75 },
  { label: 'Saving to datastore', pct: 90 },
  { label: 'Finalizing', pct: 100 },
]

// ── Reducer ──

type TaskAction =
  | { type: 'ADD_TASK'; task: BackgroundTask }
  | { type: 'UPDATE_TASK'; id: string; updates: Partial<BackgroundTask> }
  | { type: 'REMOVE_TASK'; id: string }
  | { type: 'CLEAR_COMPLETED' }

interface State { tasks: BackgroundTask[] }

function taskReducer(state: State, action: TaskAction): State {
  switch (action.type) {
    case 'ADD_TASK':
      return { ...state, tasks: [...state.tasks, action.task] }
    case 'UPDATE_TASK':
      return {
        ...state,
        tasks: state.tasks.map(t =>
          t.id === action.id ? { ...t, ...action.updates } : t
        ),
      }
    case 'REMOVE_TASK':
      return { ...state, tasks: state.tasks.filter(t => t.id !== action.id) }
    case 'CLEAR_COMPLETED':
      return { ...state, tasks: state.tasks.filter(t => t.status === 'running' || t.status === 'queued') }
    default:
      return state
  }
}

// ── Context ──

interface BackgroundTaskContextValue {
  tasks: BackgroundTask[]
  activeTasks: BackgroundTask[]
  completedTasks: BackgroundTask[]
  failedTasks: BackgroundTask[]

  /** Create a task entry and start running it. Returns the task ID. */
  startTask: (params: {
    type: TaskType
    title: string
    agentName: string
    steps: TaskStep[]
    prompt: string
    metadata?: Record<string, any>
    onProgress?: (task: BackgroundTask) => void
  }) => string

  /** Cancel a running task (stop polling, mark cancelled). */
  cancelTask: (id: string) => void

  /** Retry a failed task. */
  retryTask: (id: string) => void

  /** Dismiss a completed/failed task from the list. */
  dismissTask: (id: string) => void

  /** Dismiss all completed/failed tasks. */
  clearCompleted: () => void

  /** Get a single task by ID. */
  getTask: (id: string) => BackgroundTask | undefined

  /** Subscribe to task status changes for a specific task. */
  onTaskChange: (id: string, cb: (task: BackgroundTask) => void) => () => void
}

const BackgroundTaskContext = createContext<BackgroundTaskContextValue | null>(null)

let taskCounter = 0
function genId() {
  taskCounter += 1
  return `task_${Date.now()}_${taskCounter}`
}

// ── Provider ──

export function BackgroundTaskProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(taskReducer, { tasks: [] })

  // Map of polling interval IDs keyed by task ID
  const pollIntervals = useRef<Map<string, ReturnType<typeof setInterval>>>(new Map())
  // Map of task start times for duration tracking
  const startTimes = useRef<Map<string, number>>(new Map())
  // Map of step progression timestamps per task
  const stepTimestamps = useRef<Map<string, number[]>>(new Map())
  // Subscribers for task changes
  const subscribers = useRef<Map<string, Set<(task: BackgroundTask) => void>>>(new Map())

  // ── Helpers ──

  const notifySubscribers = useCallback((task: BackgroundTask) => {
    const subs = subscribers.current.get(task.id)
    if (subs) {
      subs.forEach(cb => {
        try { cb(task) } catch { /* ignore subscriber error */ }
      })
    }
  }, [])

  const updateTask = useCallback((id: string, updates: Partial<BackgroundTask>) => {
    dispatch({ type: 'UPDATE_TASK', id, updates })
    // Notify subscribers with the updated task
    const current = state.tasks.find(t => t.id === id)
    if (current) {
      const merged = { ...current, ...updates }
      notifySubscribers(merged)
    }
  }, [state.tasks, notifySubscribers])

  // ── Start a task (creates + runs agent) ──

  const startTask = useCallback((params: {
    type: TaskType
    title: string
    agentName: string
    steps: TaskStep[]
    prompt: string
    metadata?: Record<string, any>
  }): string => {
    const id = genId()
    const now = Date.now()

    const task: BackgroundTask = {
      id,
      type: params.type,
      title: params.title,
      status: 'queued',
      progress: 0,
      currentStep: 0,
      steps: params.steps,
      startedAt: now,
      canRetry: true,
      canCancel: true,
      metadata: params.metadata || {},
      agentName: params.agentName,
    }

    dispatch({ type: 'ADD_TASK', task })
    startTimes.current.set(id, now)

    // Advance quickly to 'running'
    setTimeout(() => {
      updateTask(id, { status: 'running' })
    }, 100)

    // Begin agent execution in the background
    executeAgentTask(id, params.agentName, params.prompt, params.steps)

    return id
  }, [updateTask])

  // ── Agent execution + polling ──

  const executeAgentTask = useCallback(async (
    taskId: string,
    agentName: string,
    prompt: string,
    steps: TaskStep[],
  ) => {
    try {
      // Create a conversation for the agent
      const conversation = await lemmaClient.conversations.createForAgent(agentName, {
        title: `Background Task: ${agentName}`,
      })

      updateTask(taskId, {
        conversationId: conversation.id,
        agentName,
      })

      // Send the prompt
      await lemmaClient.conversations.messages.send(conversation.id, {
        content: prompt,
      })

      // --- Step simulation fallback ---
      // Since agents don't yet emit structured progress, we simulate step
      // advancement alongside real polling. The simulation gives users
      // immediate feedback. When agents support progress callbacks, this
      // will be replaced with real data.
      const stepAdvanceTimers: ReturnType<typeof setTimeout>[] = []
      const stepDurations = steps.map((_, i) => {
        if (i === 0) return 0
        // Distribute ~20s across steps (front-loaded for responsiveness)
        const base = steps.length > 6 ? [800, 1800, 3500, 4000, 3500, 2500, 2000, 1000] : [1200, 3000, 5000, 4000, 3000, 2000]
        return (base[i - 1] || 3000) + Math.random() * 1000
      })

      let cumDelay = 600
      for (let i = 1; i < steps.length; i++) {
        const stepIdx = i
        cumDelay += stepDurations[i - 1]
        const timer = setTimeout(() => {
          updateTask(taskId, {
            currentStep: stepIdx,
            progress: steps[stepIdx].pct,
          })
        }, cumDelay)
        stepAdvanceTimers.push(timer)
      }

      // --- Poll for real completion ---
      const pollInterval = setInterval(async () => {
        try {
          const conv = await lemmaClient.conversations.get(conversation.id)

          if (conv.status === 'COMPLETED') {
            clearInterval(pollInterval)
            // Clear step sim timers
            stepAdvanceTimers.forEach(t => clearTimeout(t))

            // Read final messages for summary
            const messages = await lemmaClient.conversations.messages.list(conversation.id, { limit: 5 })
            const lastAssistant = messages.items
              ?.filter(m => m.role === 'assistant' && m.kind === 'TEXT')
              .pop()

            const finalStep = steps.length - 1
            const finishedAt = Date.now()
            const duration = Math.floor((finishedAt - (startTimes.current.get(taskId) || finishedAt)) / 1000)

            updateTask(taskId, {
              status: 'completed',
              progress: 100,
              currentStep: finalStep,
              finishedAt,
              duration,
              canCancel: false,
            })

            // Auto-refresh relevant tables based on task type
            const task = state.tasks.find(t => t.id === taskId)
            if (task) {
              triggerAutoRefresh(task.type)
            }

            // Clean up
            startTimes.current.delete(taskId)
            pollIntervals.current.delete(taskId)
          }
          else if (conv.status === 'FAILED' || conv.status === 'STOPPED') {
            clearInterval(pollInterval)
            stepAdvanceTimers.forEach(t => clearTimeout(t))

            const finishedAt = Date.now()
            const duration = Math.floor((finishedAt - (startTimes.current.get(taskId) || finishedAt)) / 1000)

            updateTask(taskId, {
              status: 'failed',
              finishedAt,
              duration,
              canCancel: false,
              error: conv.last_run_error || `Agent ${agentName} failed`,
            })

            startTimes.current.delete(taskId)
            pollIntervals.current.delete(taskId)
          }
          // else still running — keep polling
        } catch (pollErr) {
          // Silently retry on poll error (network glitch)
        }
      }, 1500)

      pollIntervals.current.set(taskId, pollInterval)

    } catch (err) {
      const finishedAt = Date.now()
      const duration = Math.floor((finishedAt - (startTimes.current.get(taskId) || finishedAt)) / 1000)
      updateTask(taskId, {
        status: 'failed',
        finishedAt,
        duration,
        canCancel: false,
        error: err instanceof Error ? err.message : 'Failed to start agent task',
      })
      startTimes.current.delete(taskId)
    }
  }, [updateTask, state.tasks])

  // ── Cancel ──

  const cancelTask = useCallback((id: string) => {
    const interval = pollIntervals.current.get(id)
    if (interval) {
      clearInterval(interval)
      pollIntervals.current.delete(id)
    }
    const finishedAt = Date.now()
    const duration = Math.floor((finishedAt - (startTimes.current.get(id) || finishedAt)) / 1000)
    updateTask(id, {
      status: 'cancelled',
      finishedAt,
      duration,
      canCancel: false,
      canRetry: true,
    })
    startTimes.current.delete(id)
  }, [updateTask])

  // ── Retry ──

  const retryTask = useCallback((id: string) => {
    const task = state.tasks.find(t => t.id === id)
    if (!task || (task.status !== 'failed' && task.status !== 'cancelled')) return
    if (!task.agentName) return

    // Remove old task and create a new one
    dispatch({ type: 'REMOVE_TASK', id })

    const newId = genId()
    const now = Date.now()

    const newTask: BackgroundTask = {
      ...task,
      id: newId,
      status: 'queued',
      progress: 0,
      currentStep: 0,
      startedAt: now,
      finishedAt: undefined,
      duration: undefined,
      canRetry: true,
      canCancel: true,
      error: undefined,
      conversationId: undefined,
    }

    dispatch({ type: 'ADD_TASK', task: newTask })
    startTimes.current.set(newId, now)

    setTimeout(() => {
      updateTask(newId, { status: 'running' })
    }, 100)

    // Re-run the agent
    if (task.agentName) {
      // We need the original prompt — store it in metadata or reconstruct
      const prompt = (task.metadata?.originalPrompt as string) || ''
      executeAgentTask(newId, task.agentName, prompt, task.steps)
    }
  }, [state.tasks, updateTask, executeAgentTask])

  // ── Dismiss ──

  const dismissTask = useCallback((id: string) => {
    dispatch({ type: 'REMOVE_TASK', id })
    const interval = pollIntervals.current.get(id)
    if (interval) {
      clearInterval(interval)
      pollIntervals.current.delete(id)
    }
    startTimes.current.delete(id)
  }, [])

  const clearCompleted = useCallback(() => {
    dispatch({ type: 'CLEAR_COMPLETED' })
  }, [])

  const getTask = useCallback((id: string) => {
    return state.tasks.find(t => t.id === id)
  }, [state.tasks])

  const onTaskChange = useCallback((id: string, cb: (task: BackgroundTask) => void) => {
    if (!subscribers.current.has(id)) {
      subscribers.current.set(id, new Set())
    }
    subscribers.current.get(id)!.add(cb)
    return () => {
      subscribers.current.get(id)?.delete(cb)
    }
  }, [])

  // ── Auto-refresh trigger ──

  const triggerAutoRefresh = useCallback((type: TaskType) => {
    switch (type) {
      case 'theme_clustering':
        notifyTableChanged('themes')
        notifyTableChanged('ideas')
        break
      case 'content_generation':
        notifyTableChanged('content_items')
        break
      case 'pdf_processing':
        notifyTableChanged('sources')
        notifyTableChanged('ideas')
        break
      case 'knowledge_extraction':
        notifyTableChanged('ideas')
        break
      case 'bulk_tagging':
        notifyTableChanged('ideas')
        break
    }
  }, [])

  // ── Cleanup all intervals on unmount ──

  useEffect(() => {
    return () => {
      pollIntervals.current.forEach(interval => clearInterval(interval))
      pollIntervals.current.clear()
    }
  }, [])

  // ── Memoized derived state ──

  const value = useMemo<BackgroundTaskContextValue>(() => ({
    tasks: state.tasks,
    activeTasks: state.tasks.filter(t => t.status === 'queued' || t.status === 'running'),
    completedTasks: state.tasks.filter(t => t.status === 'completed'),
    failedTasks: state.tasks.filter(t => t.status === 'failed'),
    startTask,
    cancelTask,
    retryTask,
    dismissTask,
    clearCompleted,
    getTask,
    onTaskChange,
  }), [state.tasks, startTask, cancelTask, retryTask, dismissTask, clearCompleted, getTask, onTaskChange])

  return (
    <BackgroundTaskContext.Provider value={value}>
      {children}
    </BackgroundTaskContext.Provider>
  )
}

// ── Hook ──

export function useBackgroundTasks() {
  const ctx = useContext(BackgroundTaskContext)
  if (!ctx) {
    throw new Error('useBackgroundTasks must be used within a BackgroundTaskProvider')
  }
  return ctx
}

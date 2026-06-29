/**
 * refresh-bus.ts
 *
 * A lightweight cross-page synchronization system.
 * Pages emit events when they mutate a table, and all pages
 * subscribed to that table automatically refresh their data.
 *
 * Usage:
 *   import { notifyTableChanged, onTableChange } from '../lib/refresh-bus'
 *
 *   // After a mutation:
 *   notifyTableChanged('ideas')
 *
 *   // In a page that displays data:
 *   useEffect(() => {
 *     const unsub = onTableChange('ideas', () => refresh())
 *     return unsub
 *   }, [refresh])
 */

type TableName = string
type ChangeHandler = () => void

const listeners = new Map<TableName, Set<ChangeHandler>>()
const TABLE_CHANGE_EVENT = 'lemma:table-changed'

/**
 * Notify all subscribers that a table has changed.
 * Call this after any create, update, or delete operation.
 */
export function notifyTableChanged(table: TableName): void {
  const handlerSet = listeners.get(table)
  if (handlerSet) {
    handlerSet.forEach(fn => {
      try { fn() } catch (e) { console.error('refresh-bus handler error:', e) }
    })
  }
  // Also dispatch a DOM event for any components not using the hook-based API
  window.dispatchEvent(new CustomEvent(TABLE_CHANGE_EVENT, { detail: { table } }))
}

/**
 * Subscribe to changes for one or more tables.
 * Returns an unsubscribe function.
 */
export function onTableChange(
  tables: TableName | TableName[],
  fn: ChangeHandler
): () => void {
  const tableList = Array.isArray(tables) ? tables : [tables]
  tableList.forEach(table => {
    if (!listeners.has(table)) listeners.set(table, new Set())
    listeners.get(table)!.add(fn)
  })
  return () => {
    tableList.forEach(table => {
      const handlerSet = listeners.get(table)
      if (handlerSet) {
        handlerSet.delete(fn)
        if (handlerSet.size === 0) listeners.delete(table)
      }
    })
  }
}

/**
 * Subscribe via DOM CustomEvent (alternative for non-React or script-based usage).
 */
export function onAnyTableChange(fn: (table: TableName) => void): () => void {
  const handler = (e: Event) => {
    const detail = (e as CustomEvent).detail as { table: TableName }
    if (detail?.table) fn(detail.table)
  }
  window.addEventListener(TABLE_CHANGE_EVENT, handler)
  return () => window.removeEventListener(TABLE_CHANGE_EVENT, handler)
}

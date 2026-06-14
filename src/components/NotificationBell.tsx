import { useCallback, useEffect, useRef, useState } from 'react'
import {
  NOTIFICATION_GLYPHS,
  formatBadge,
  formatRelativeTime,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  subscribeToNotifications,
} from '../lib/notifications'
import type { EcoNotification } from '../lib/notifications'
import Toast from './Toast'
import HzBadge from './HzBadge'
import { PHANTOM_HZ } from '../lib/hzSignature'
import './NotificationBell.css'

const DROPDOWN_LIMIT = 10
const PAGE_SIZE = 20

/**
 * Bell icon with unread badge, dropdown of recent notifications, and a
 * "view all" overlay with load-more. Live-updates from realtime + local
 * notification events; new arrivals raise a brief toast.
 */
export default function NotificationBell() {
  const [open, setOpen] = useState(false)
  const [viewAll, setViewAll] = useState(false)
  const [items, setItems] = useState<EcoNotification[]>([])
  const [limit, setLimit] = useState(PAGE_SIZE)
  const [toast, setToast] = useState<string | null>(null)
  const rootRef = useRef<HTMLDivElement | null>(null)

  const refresh = useCallback((nextLimit = limit) => {
    void listNotifications(nextLimit).then(setItems)
  }, [limit])

  useEffect(() => { refresh() }, [refresh])

  // live arrivals: prepend, badge follows, toast announces
  useEffect(() => {
    return subscribeToNotifications(notification => {
      setItems(prev => (prev.some(p => p.id === notification.id) ? prev : [notification, ...prev]))
      setToast(notification.text)
    })
  }, [])

  // click outside closes the dropdown
  useEffect(() => {
    if (!open) return
    const onPointer = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointer)
    return () => document.removeEventListener('pointerdown', onPointer)
  }, [open])

  const unread = items.filter(i => !i.read)

  const readOne = (notification: EcoNotification) => {
    setItems(prev => prev.map(p => (p.id === notification.id ? { ...p, read: true } : p)))
    void markNotificationRead(notification)
  }

  const readAll = () => {
    setItems(prev => prev.map(p => ({ ...p, read: true })))
    void markAllNotificationsRead()
  }

  const loadMore = () => {
    const next = limit + PAGE_SIZE
    setLimit(next)
    refresh(next)
  }

  return (
    <div className="notif-root" ref={rootRef}>
      <button
        type="button"
        className={`notif-bell${unread.length > 0 ? ' has-unread' : ''}`}
        aria-label={`notifications, ${unread.length} unread`}
        onClick={() => { setOpen(o => !o); if (!open) refresh() }}
      >
        <span aria-hidden="true">◔</span>
        {unread.length > 0 && <em className="notif-badge">{formatBadge(unread.length)}</em>}
      </button>

      {open && (
        <div className="notif-dropdown" role="menu" aria-label="Recent notifications">
          <div className="notif-dropdown-head">
            <span>signals for you</span>
            {unread.length > 0 && (
              <button type="button" onClick={readAll}>mark all as read</button>
            )}
          </div>
          {items.length === 0 && <p className="notif-empty">the band is quiet. nothing for you yet.</p>}
          <ul className="notif-list">
            {items.slice(0, DROPDOWN_LIMIT).map(notification => (
              <NotificationRow key={notification.id} notification={notification} onRead={readOne} />
            ))}
          </ul>
          {items.length > 0 && (
            <button type="button" className="notif-view-all" onClick={() => { setViewAll(true); setOpen(false) }}>
              view all
            </button>
          )}
        </div>
      )}

      {viewAll && (
        <div className="notif-overlay" role="dialog" aria-label="All notifications">
          <div className="notif-overlay-panel">
            <div className="notif-dropdown-head">
              <span>all notifications</span>
              <button type="button" onClick={() => setViewAll(false)}>close</button>
            </div>
            {items.length === 0 && <p className="notif-empty">nothing yet. drift more.</p>}
            <ul className="notif-list">
              {items.map(notification => (
                <NotificationRow key={notification.id} notification={notification} onRead={readOne} />
              ))}
            </ul>
            {items.length >= limit && (
              <button type="button" className="notif-view-all" onClick={loadMore}>load more</button>
            )}
          </div>
        </div>
      )}

      {toast && <Toast text={toast} onDone={() => setToast(null)} />}
    </div>
  )
}

function NotificationRow({ notification, onRead }: { notification: EcoNotification; onRead: (n: EcoNotification) => void }) {
  return (
    <li className={`notif-item notif-item--${notification.type}${notification.read ? ' read' : ''}`}>
      <span className="notif-glyph" aria-hidden="true">{NOTIFICATION_GLYPHS[notification.type]}</span>
      <div className="notif-body">
        <p>{notification.text}</p>
        <span>
          {formatRelativeTime(notification.createdAt)}
          {notification.type === 'phantom_interaction' && <>{' '}<HzBadge compact {...PHANTOM_HZ} /></>}
        </span>
      </div>
      {!notification.read && (
        <button type="button" className="notif-read-dot" title="mark as read" aria-label="mark as read" onClick={() => onRead(notification)} />
      )}
    </li>
  )
}

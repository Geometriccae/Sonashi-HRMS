import React, { useState, useEffect, useRef, useCallback } from "react";
import styles from "./NotificationBell.module.css";
import belldot from "../assets/dashboard/bell-dot.svg";
import chevrondown from "../assets/dashboard/chevron-down.svg";
import config from '../config/config';
import { io as ioClient } from "socket.io-client";



const REMINDER_NOTIFICATION_TYPES = new Set([
  
  "meeting-reminder",
  "event-reminder",
  "task-reminder",
]);

function NotificationBell({ small = true }) {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notificationSupported, setNotificationSupported] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState("default");
  const [inAppReminders, setInAppReminders] = useState([]); // hold transient in-app reminder cards
  const [showPermissionBanner, setShowPermissionBanner] = useState(false);
  const [permissionBannerMsg, setPermissionBannerMsg] = useState("");
  const dropdownRef = useRef();
  const socketRef = useRef(null);
  const receivedIdsRef = useRef(new Set());
  const isOpenRef = useRef(false); // mirror isOpen to avoid stale closure issues
  const scheduledTimersRef = useRef(new Map());
  const meRef = useRef(null);

  const playBeep = useCallback(() => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.setValueAtTime(880, ctx.currentTime);
      g.gain.setValueAtTime(0.001, ctx.currentTime);
      o.connect(g);
      g.connect(ctx.destination);
      // quick fade-in and fade-out
      g.gain.linearRampToValueAtTime(0.12, ctx.currentTime + 0.01);
      o.start();
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
      setTimeout(() => {
        try { o.stop(); ctx.close(); } catch (_) {}
      }, 700);
    } catch (e) {
      // audio API may be blocked on some browsers — ignore
      console.warn("Audio beep failed:", e);
    }
  }, []);

  // updated triggerBrowserReminder: only show notification if permission === 'granted'
  const triggerBrowserReminder = useCallback((payload) => {
    if (typeof window === "undefined") return;
    if (!payload || !REMINDER_NOTIFICATION_TYPES.has(payload.type)) return;
    if (!("Notification" in window)) return;

    // Only show native notification if already granted — requesting permission here is not allowed reliably
    try {
      if (window.Notification && window.Notification.permission === "granted") {
        const opts = {
          body: payload.body || "",
          tag: payload.id,
          icon: "/auxin_logo.png",
          silent: false,
        };
        const notification = new window.Notification(payload.title || "Reminder", opts);
        notification.onclick = () => {
          try { window.focus(); } catch (_) {}
          const targetUrl = payload.url || payload.meta?.url;
          if (targetUrl) window.location.href = targetUrl;
          notification.close();
        };
        setTimeout(() => notification.close(), 10000);
        return true;
      }
    } catch (err) {
      console.warn("Browser notification failed:", err);
    }
    return false;
  }, []);

  // keep ref in sync with state
  useEffect(() => {
    isOpenRef.current = isOpen;
  }, [isOpen]);

  // initialize Notification API state once
  useEffect(() => {
    const supported = typeof window !== "undefined" && "Notification" in window;
    setNotificationSupported(supported && window.isSecureContext);
    if (supported && typeof window.Notification !== "undefined") {
      setPermissionStatus(window.Notification.permission || "default");
    } else {
      setPermissionStatus("unsupported");
    }
  }, []);

  // request permission in a user-initiated way
  const requestNotificationPermission = useCallback(async () => {
    if (!notificationSupported) {
      console.warn("Browser notifications not supported or not on secure context.");
      return "unsupported";
    }
    try {
      if (window.Notification && window.Notification.permission === "default") {
        const result = await window.Notification.requestPermission();
        setPermissionStatus(result);
        console.log("Notification permission result:", result);
        return result;
      }
      // return current state if already granted/denied
      return window.Notification.permission;
    } catch (err) {
      console.error("Error requesting notification permission:", err);
      return "denied";
    }
  }, [notificationSupported]);

  const raw = config.API_BASE_URL || '';
  const socketUrl = raw.replace(/\/api\/?$/, '') || window.location.origin;
  
  // Helper: parse event date/time to a Date object (handles different shapes)
  const parseEventDateTime = (ev) => {
    const src = ev.meta?.event || ev.meta?.meeting || ev;
    const dt = ev.date || ev.start || src?.date || null;
    if (!dt) return null;
    try {
      // if time is provided separately
      if (ev.time || src?.time) {
        const time = ev.time || src?.time;
        const dateOnly = (typeof dt === 'string') ? dt.split('T')[0] : (dt instanceof Date ? dt.toISOString().split('T')[0] : dt);
        return new Date(`${dateOnly}T${time}:00`);
      }
      return new Date(dt);
    } catch (e) {
      return null;
    }
  };

  // Schedule local reminders for an event if the current user is a recipient
  const scheduleLocalReminders = useCallback((event) => {
    try {
      if (!event) return;
      const currentUserId = meRef.current?._id || localStorage.getItem('userId');

      // gather assigned IDs from multiple shapes
      const assigned = (event.assignedTeamMembers || event.meta?.event?.assignedTeamMembers || event.assignedTo || []);
      const assignedIds = Array.isArray(assigned) ? assigned.map(String) : [String(assigned)];

      // include creator/assignedBy and client owner as recipients
      const creators = [event.createdBy, event.assignedBy, event.meta?.event?.assignedBy].filter(Boolean).map(String);

      // if current user not in recipients, skip scheduling
      if (currentUserId && !assignedIds.includes(String(currentUserId)) && !creators.includes(String(currentUserId))) {
        return;
      }

      const reminders = (event.reminders || event.meta?.event?.reminders || []);
      if (!Array.isArray(reminders) || reminders.length === 0) return;

      const dt = parseEventDateTime(event);
      if (!dt || isNaN(dt.getTime())) return;

      reminders.forEach((mins) => {
        const key = `${String(event._id || event.eventId || event.id)}-${mins}`;
        if (scheduledTimersRef.current.has(key) || receivedIdsRef.current.has(key)) return;

        const reminderTime = new Date(dt.getTime() - Number(mins) * 60000);
        const delay = reminderTime.getTime() - Date.now();
        if (delay <= 0) return;

        const timer = setTimeout(() => {
          // dedupe so server and client don't duplicate
          if (receivedIdsRef.current.has(key)) return;
          receivedIdsRef.current.add(key);

          const payload = {
            id: key,
            type: 'event-reminder',
            title: `Reminder: ${event.title || event.eventName || 'Event'}`,
            body: `Event in ${mins} minutes`,
            meta: { ...event, reminderMinutes: mins }
          };

          // Push into in-app list and try native notification
          window.appNotifications?.push?.({ title: payload.title, body: payload.body, meta: payload.meta });
          const shown = (typeof window !== 'undefined' && window.Notification && window.Notification.permission === 'granted');
          if (shown) {
            try {
              new window.Notification(payload.title, { body: payload.body, tag: payload.id, icon: '/auxin_logo.png' });
            } catch (err) {
              console.warn('Local reminder native Notification failed:', err);
            }
          } else {
            // show transient in-app reminder + sound
            setInAppReminders(prev => {
              const next = [{ id: payload.id, title: payload.title, body: payload.body, meta: payload.meta }, ...prev].slice(0, 6);
              setTimeout(() => setInAppReminders(cur => cur.filter(r => r.id !== payload.id)), 10000);
              return next;
            });
            playBeep();
          }

          scheduledTimersRef.current.delete(key);
        }, delay);

        scheduledTimersRef.current.set(key, timer);
      });
    } catch (e) {
      console.warn('scheduleLocalReminders error', e);
    }
  }, [playBeep]);

  // Cancel all scheduled timers on unmount
  useEffect(() => {
    return () => {
      for (const t of scheduledTimersRef.current.values()) {
        try { clearTimeout(t); } catch (e) {}
      }
      scheduledTimersRef.current.clear();
    };
  }, []);

  useEffect(() => {
    // derive socket url from API_BASE_URL, strip '/api' if present
    const raw = config.API_BASE_URL || '';
    const socketUrl = raw.replace(/\/api\/?$/, '') || window.location.origin;

    const socket = ioClient(socketUrl, {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      timeout: 20000
    });
    socketRef.current = socket;

    // single socket with logs and handlers (helps debugging on live)
    socket.on('connect', async () => {
      // fetch current user and store locally for scheduling checks
      try {
        const token = localStorage.getItem('token');
        if (token) {
          const resp = await fetch(`${config.API_BASE_URL.replace(/\/api\/?$/, '')}/api/auth/me`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          if (resp.ok) {
            const me = await resp.json();
            meRef.current = me;
            // fetch aggregated events to schedule any upcoming reminders for this user
            try {
              const eventsResp = await fetch(`${config.API_BASE_URL.replace(/\/api\/?$/, '')}/api/clients/events`, {
                headers: { Authorization: `Bearer ${token}` }
              });
              if (eventsResp.ok) {
                const list = await eventsResp.json();
                (list || []).forEach(ev => scheduleLocalReminders(ev));
              }
              // try employee-level events as well
              const empEventsResp = await fetch(`${config.API_BASE_URL.replace(/\/api\/?$/, '')}/api/employees/events`, {
                headers: { Authorization: `Bearer ${token}` }
              });
              if (empEventsResp.ok) {
                const list = await empEventsResp.json();
                (list || []).forEach(ev => scheduleLocalReminders(ev));
              }
            } catch (evErr) {
              console.debug('Could not prefetch events to schedule local reminders:', evErr);
            }
          }
        }
      } catch (meErr) {
        console.warn('Error fetching current user for socket join:', meErr);
      }

      console.log('🔌 Notification socket connected', socket.id);
      try { console.log('🔌 Socket transport:', socket.io.engine.transport.name); } catch(e){}
      console.log('🔌 Full socket URL:', socketUrl, 'window.location.origin:', window.location.origin);
      console.log('🔒 Secure context?', typeof window !== 'undefined' ? window.isSecureContext : 'unknown', 'protocol:', typeof window !== 'undefined' ? window.location.protocol : 'unknown');
      
      // Fetch current user from server (safer than relying only on localStorage)
      try {
        const token = localStorage.getItem('token');
        if (token) {
          const resp = await fetch(`${config.API_BASE_URL.replace(/\/api\/?$/, '')}/api/auth/me`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          if (resp.ok) {
            const me = await resp.json();
            const userId = me._id || me.id || localStorage.getItem('userId');
            const userRole = me.role || localStorage.getItem('role');
            const email = me.emailId || me.email || localStorage.getItem('email') || null;

            if (userId) {
              socket.emit('join-user', { userId, role: userRole });
            }
            if (email) {
              socket.emit('join-email', email);
              console.log(`Joining socket email room for ${email}`);
            }
          } else {
            console.warn('Failed to fetch /api/auth/me after socket connect');
          }
        } else {
          // fallback to localStorage joins if token missing
          const userIdLS = localStorage.getItem('userId');
          const roleLS = localStorage.getItem('role');
          const emailLS = localStorage.getItem('email');
          if (userIdLS) socket.emit('join-user', { userId: userIdLS, role: roleLS });
          if (emailLS) socket.emit('join-email', emailLS);
        }
      } catch (meErr) {
        console.warn('Error fetching current user for socket join:', meErr);
      }
    });
    
    socket.on('connect_error', (err) => {
      console.error('Notification socket connect_error', err);
    });
    socket.on('reconnect_attempt', (attempt) => {
      console.log('Notification socket reconnect attempt', attempt);
    });
    socket.on('reconnect_failed', () => {
      console.warn('Notification socket reconnect failed - will stop trying');
    });
    socket.on('disconnect', (reason) => {
      console.log('Notification socket disconnected:', reason);
    });

    // preserve existing handlers (notification + specific events)
    socket.on('notification', (payload) => {
      console.log('📨 [LIVE] Received socket notification:', payload);
      try {
        const id = payload?.id || `${payload?.type || 'n'}-${payload?.taskId || payload?.clientId || Date.now()}`;
        if (receivedIdsRef.current.has(id)) return;
        receivedIdsRef.current.add(id);
        const item = { title: payload.title || 'Notification', body: payload.body || payload.message || '', meta: payload.meta || payload };
        window.appNotifications?.push?.(item);
        // if permission already granted, show a browser notification for anything that looks important
        if (notificationSupported && permissionStatus === 'granted') {
          try {
            new window.Notification(payload.title || 'Notification', { body: payload.body || '', tag: payload.id, icon: '/auxin_logo.png' });
          } catch (err) {
            console.warn('Failed to show browser notification:', err);
          }
        }
      } catch (e) { console.error('Error handling socket notification', e); }
    });

    // when receiving client/employee events schedule local reminders
    socket.on('client-event', (payload) => {
      try {
        console.log('client-event received (client side scheduling):', payload);
        const ev = payload.event || payload;
        scheduleLocalReminders(ev);
        // push immediate in-app notification
        window.appNotifications?.push?.({ title: payload.title || 'Client Event', body: payload.body || '', meta: payload.meta || payload });
      } catch (err) {
        console.warn('client-event error scheduling local reminders:', err);
      }
    });
    
    socket.on('employee-event', (payload) => {
      try {
        console.log('employee-event received (client side scheduling):', payload);
        const ev = payload.event || payload;
        scheduleLocalReminders(ev);
        window.appNotifications?.push?.({ title: payload.title || 'Employee Event', body: payload.body || '', meta: payload.meta || payload });
      } catch (err) {
        console.warn('employee-event error scheduling local reminders:', err);
      }
    });

    socket.on('event-reminder', (payload) => {
      try {
        console.log('🎯 [LIVE] Received event-reminder:', payload);
        // Diagnostics: report permission and secure context at receipt time
        const perm = (typeof window !== 'undefined' && window.Notification) ? window.Notification.permission : 'unsupported';
        console.log('🔍 reminder diagnostics: permissionStatus=', perm, 'isSecureContext=', typeof window !== 'undefined' ? window.isSecureContext : undefined);

        // If native notification shown we are done
        const shown = triggerBrowserReminder(payload);
        // Always push to in-app notifications (so bell shows it), then ensure user sees it:
        const item = {
          title: payload.title || 'Reminder',
          body: payload.body || '',
          meta: payload.meta || payload,
          read: false,
          id: payload.id || `reminder-${Date.now()}`
        };
        window.appNotifications?.push?.(item);

        if (!shown) {
          // Show persistent permission banner for live debugging / user action
          const reason = (typeof window !== 'undefined' && window.Notification)
            ? (window.Notification.permission === 'denied' ? 'blocked (denied by browser)' : (window.isSecureContext ? 'permission not granted' : 'insecure context (requires HTTPS)'))
            : 'notifications API unavailable';
          setPermissionBannerMsg(`Reminder received, but native notifications are ${reason}. Click "Enable" to request permission or open browser settings.`);
          setShowPermissionBanner(true);

          // show brief in-app reminder banner for visibility and play sound
          setInAppReminders(prev => {
            const next = [item, ...prev].slice(0, 6); // keep up to 6 visible
            // auto-dismiss after 10s
            setTimeout(() => {
              setInAppReminders(cur => cur.filter(r => r.id !== item.id));
            }, 10000);
            return next;
          });
          playBeep();
        }
      } catch (e) {
        console.error('Error handling event-reminder in NotificationBell:', e);
      }
    });

    // ensure we remove any scheduled timers if server emits same id (avoid duplicates)
    socket.on('task-reminder', (payload) => {
      try {
        const id = payload?.id;
        if (id && scheduledTimersRef.current.has(id)) {
          try { clearTimeout(scheduledTimersRef.current.get(id)); } catch (err) {}
          scheduledTimersRef.current.delete(id);
        }
        // push and show as needed (similar to event-reminder)
        window.appNotifications?.push?.({ title: payload.title || 'Reminder', body: payload.body || '', meta: payload.meta || payload });
        const shown = (typeof window !== 'undefined' && window.Notification && window.Notification.permission === 'granted');
        if (!shown) { setInAppReminders(prev => { const next = [{ id: payload.id, title: payload.title, body: payload.body, meta: payload.meta }, ...prev].slice(0,6); setTimeout(()=> setInAppReminders(cur => cur.filter(r=>r.id !== payload.id)),10000); return next; }); playBeep(); }
      } catch (e) { console.warn('task-reminder handler error', e); }
    });

    // click outside closes dropdown — use ref to avoid stale closure of isOpen
    const onDocClick = (e) => {
      try {
        if (isOpenRef.current && dropdownRef.current && !dropdownRef.current.contains(e.target)) {
          setIsOpen(false);
        }
      } catch (err) {
        console.warn('onDocClick handler error:', err);
      }
    };

    document.addEventListener("click", onDocClick);

    return () => {
      document.removeEventListener("click", onDocClick);
      try { socket.disconnect(); } catch (e) { /* ignore */ }
    };
  }, [notificationSupported, permissionStatus, requestNotificationPermission, triggerBrowserReminder, playBeep, scheduleLocalReminders]);

  useEffect(() => {
    setUnreadCount(notifications.filter(n => !n.read).length);
  }, [notifications]);

  const toggleOpen = async () => {
    // user interaction: ensure we request permission if default
    if (notificationSupported && permissionStatus === "default") {
      // request permission only on explicit interaction
      await requestNotificationPermission();
    }
    setIsOpen(!isOpen);

    // mark as read when opened
    if (!isOpen) {
      setNotifications((prev) => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
    }
  };

  const clearAll = () => {
    setNotifications([]);
    setUnreadCount(0);
  };

  // render helper: small UI hint to enable notifications (if not granted)
  const PermissionHint = () => {
    if (!notificationSupported) {
      return (
        <div style={{ fontSize: 12, color: '#6b7280', marginLeft: 8 }}>
          Browser notifications unavailable — requires HTTPS.
        </div>
      );
    }
    if (permissionStatus === "granted") return null;
    if (permissionStatus === "denied") {
      return (
        <div style={{ fontSize: 12, color: '#b91c1c', marginLeft: 8 }}>
          Notifications disabled — enable from browser settings.
        </div>
      );
    }
    // default (not yet requested)
    return (
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginLeft: 8 }}>
        <button
          onClick={() => requestNotificationPermission().then((r) => {
            if (r !== 'granted') {
              console.info('Permission not granted:', r);
            } else {
              // clear banner when user grants
              setShowPermissionBanner(false);
            }
          })}
          style={{
            fontSize: 12,
            padding: '6px 8px',
            borderRadius: 6,
            border: '1px solid #cbd5e1',
            background: '#fff',
            cursor: 'pointer'
          }}
        >
          Enable browser notifications
        </button>
        <div style={{ fontSize: 12, color: '#6b7280' }}>Click to allow</div>
      </div>
    );
  };

  return (
    <div className={styles.notificationWrapper} ref={dropdownRef}>
      {/* Persistent permission banner shown when server reminder arrives but native notification can't be shown */}
      {showPermissionBanner && (
        <div style={{
          position: 'absolute',
          right: 44,
          top: 6,
          zIndex: 1300,
          background: '#fffbeb',
          border: '1px solid #facc15',
          color: '#92400e',
          padding: '8px 10px',
          borderRadius: 8,
          display: 'flex',
          gap: 8,
          alignItems: 'center',
          maxWidth: 360,
          boxShadow: '0 6px 18px rgba(0,0,0,0.10)'
        }}>
          <div style={{ flex: 1, fontSize: 13 }}>{permissionBannerMsg}</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => requestNotificationPermission().then(res => {
              if (res === 'granted') setShowPermissionBanner(false);
            })} style={{ background: '#007aff', color: '#fff', borderRadius: 6, padding: '6px 8px', border: 'none', cursor: 'pointer' }}>Enable</button>
            <button onClick={() => setShowPermissionBanner(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#6b7280' }}>Dismiss</button>
          </div>
        </div>
      )}

      <button className={styles.bellButton} onClick={toggleOpen} aria-label="Notifications">
        <img src={belldot} alt="notifications" className={styles.bellIcon} />
        {unreadCount > 0 && <span className={styles.badge}>{unreadCount}</span>}
      </button>

      {/* In-app transient reminder toasts (appear bottom-right of bell) */}
      {inAppReminders.length > 0 && (
        <div style={{
          position: 'absolute',
          right: 0,
          top: '48px',
          zIndex: 1200,
          display: 'flex',
          flexDirection: 'column',
          gap: 8
        }}>
          {inAppReminders.map(r => (
            <div key={r.id} style={{
              minWidth: 260,
              background: '#111827',
              color: '#fff',
              padding: '10px 12px',
              borderRadius: 8,
              boxShadow: '0 6px 16px rgba(0,0,0,0.2)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: 13
            }}>
              <div style={{ flex: 1, paddingRight: 8 }}>
                <div style={{ fontWeight: 600 }}>{r.title}</div>
                <div style={{ opacity: 0.85, fontSize: 12 }}>{r.body}</div>
              </div>
              <div style={{ marginLeft: 8 }}>
                <button onClick={() => {
                  try { window.open(r.meta?.url || r.meta?.link || '/', '_blank'); } catch (e) {}
                }} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.12)', color: '#fff', padding: '6px 8px', borderRadius: 6 }}>
                  Open
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {isOpen && (
        <div className={styles.dropdown}>
          <div className={styles.dropdownHeader} style={{ position: 'relative' }}>
            <div className={styles.title}>Notifications</div>
            <div className={styles.actions}>
              {/* Permission hint / CTA */}
              <PermissionHint />
              <button className={styles.actionBtn} onClick={() => { window.appNotifications?.markAllRead?.(); }}>
                Mark all read
              </button>
              <button className={styles.actionBtn} onClick={clearAll}>Clear</button>
              {/* Close button */}
              <button
                onClick={() => setIsOpen(false)}
                aria-label="Close notifications"
                style={{
                  marginLeft: 8,
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: 18,
                  lineHeight: '1',
                  color: '#6b7280'
                }}
                title="Close"
              >
                &times;
              </button>
            </div>
          </div>

          <div className={styles.items}>
            {notifications.length === 0 && <div className={styles.empty}>No notifications</div>}
            {notifications.map((n) => (
              <div key={n.id} className={`${styles.item} ${n.read ? styles.read : styles.unread}`}>
                <div className={styles.itemContent}>
                  <div className={styles.itemTitle}>{n.title || "Notification"}</div>
                  <div className={styles.itemBody}>{n.body}</div>
                </div>
                <div className={styles.itemTime}>
                  {n.meta?.time ? n.meta.time : new Date(n.id).toLocaleTimeString()}
                </div>
              </div>
            ))}
          </div>
          <div className={styles.dropdownFooter}></div>
        </div>
      )}
    </div>
  );
}

export default NotificationBell;

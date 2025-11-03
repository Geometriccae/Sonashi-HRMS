import React, { useState, useEffect, useRef } from "react";
import styles from "./NotificationBell.module.css";
import belldot from "../assets/dashboard/bell-dot.svg";
import chevrondown from "../assets/dashboard/chevron-down.svg";
import config from '../config/config';
import { io as ioClient } from "socket.io-client";

function NotificationBell({ small = true }) {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const dropdownRef = useRef();
  const socketRef = useRef(null);
  const receivedIdsRef = useRef(new Set());
  const isOpenRef = useRef(false); // mirror isOpen to avoid stale closure issues

  // keep ref in sync with state
  useEffect(() => {
    isOpenRef.current = isOpen;
  }, [isOpen]);

  useEffect(() => {
    // initialize global push method once
    if (!window.appNotifications) {
      window.appNotifications = {
        push: (item) => {
          setNotifications((prev) => {
            const next = [{ id: Date.now() + Math.random(), read: false, ...item }, ...prev];
            // ensure newest notifications at top
            setUnreadCount(next.filter(n => !n.read).length);
            return next;
          });
          // show native browser notification (if permitted)
          if ("Notification" in window && Notification.permission === "granted") {
            try {
              const n = new Notification(item.title || "Notification", { 
                body: item.body || "", 
                silent: false,
                icon: '/auxin_logo.png' // Add app logo for better visibility
              });
              n.onclick = () => { 
                window.focus(); 
                setIsOpen(true); 
                // If there's a meta.url, navigate to it
                if (item.meta && item.meta.url) {
                  window.location.href = item.meta.url;
                }
              };
            } catch (e) { 
              console.error("Browser notification error:", e);
            }
          }
        },
        markAllRead: () => {
          setNotifications((prev) => prev.map(n => ({ ...n, read: true })));
          setUnreadCount(0);
        }
      };
    }

    // Request notification permission once
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }

    // derive socket url from API_BASE_URL, strip '/api' if present
    const raw = config.API_BASE_URL || '';
    const socketUrl = raw.replace(/\/api\/?$/, '') || window.location.origin;

    const socket = ioClient(socketUrl, {
      path: '/socket.io',
      // prefer websocket but allow polling fallback for reliability
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      timeout: 20000
    });
    socketRef.current = socket;

    socket.on('connect', async () => {
      console.log('Notification socket connected', socket.id);
      // log transport used (helpful to know if websocket or polling is active)
      try { console.log('Socket transport:', socket.io.engine.transport.name); } catch (e) {}
      
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

            // Join user and role rooms
            if (userId) {
              socket.emit('join-user', { userId, role: userRole });
            }
            if (userRole) {
              // server also handles role join inside join-user, but emit again for compatibility
              socket.emit('join-user', { userId: userId || null, role: userRole });
            }
            // Join email room so server can target by email
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

    socket.on('notification', (payload) => {
      try {
        // Deduplicate by payload.id (server sets id)
        const id = payload?.id || `${payload?.type || 'n'}-${payload?.taskId || payload?.clientId || Date.now()}`;
        if (receivedIdsRef.current.has(id)) {
          // already processed via another room
          return;
        }
        receivedIdsRef.current.add(id);

        console.log('Received socket notification payload (accepted):', payload);

        const item = {
          title: payload.title || 'Notification',
          body: payload.body || payload.message || '',
          meta: payload.meta || payload
        };
        // push into the global notifications (updates component state)
        window.appNotifications?.push?.(item);

        // show native notification if permitted
        if ("Notification" in window && Notification.permission === "granted") {
          try {
            const notification = new Notification(item.title, {
              body: item.body,
              icon: '/logo192.png',
              tag: id
            });
            notification.onclick = () => {
              window.focus();
              if (payload.url) window.location.href = payload.url;
              else if (payload.meta?.url) window.location.href = payload.meta.url;
              notification.close();
            };
            setTimeout(() => notification.close(), 8000);
          } catch (e) {
            console.error('Error showing native notification:', e);
          }
        }
      } catch (e) {
        console.error('Error handling socket notification', e);
      }
    });

    // DEBUG: listen for notification-debug events to confirm server emission
    socket.on('notification-debug', (payload) => {
      console.log('Received notification-debug from server:', payload);
      try {
        // Push a small debug entry into the bell so it is visible in dropdown
        window.appNotifications?.push?.({
          title: `Debug: ${payload.origin || 'server'}`,
          body: `${payload.action || ''} ${payload.taskId || payload.eventId || ''}`.trim(),
          meta: payload
        });
      } catch (e) {
        console.error('Error handling notification-debug', e);
      }
    });

    // click outside closes dropdown — use ref to avoid stale closure of isOpen
    const onDocClick = (e) => {
      try {
        if (isOpenRef.current && dropdownRef.current && !dropdownRef.current.contains(e.target)) {
          setIsOpen(false);
        }
      } catch (err) {
        // defensive: ignore any unexpected errors while handling outside click
        console.warn('onDocClick handler error:', err);
      }
    };

    document.addEventListener("click", onDocClick);

    return () => {
      document.removeEventListener("click", onDocClick);
      try { socket.disconnect(); } catch (e) { /* ignore */ }
    };
  }, []); // run once on mount

  useEffect(() => {
    setUnreadCount(notifications.filter(n => !n.read).length);
  }, [notifications]);

  const toggleOpen = () => {
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

  return (
    <div className={styles.notificationWrapper} ref={dropdownRef}>
      <button className={styles.bellButton} onClick={toggleOpen} aria-label="Notifications">
        <img src={belldot} alt="notifications" className={styles.bellIcon} />
        {unreadCount > 0 && <span className={styles.badge}>{unreadCount}</span>}
      </button>

      {isOpen && (
        <div className={styles.dropdown}>
          <div className={styles.dropdownHeader} style={{ position: 'relative' }}>
            <div className={styles.title}>Notifications</div>
            <div className={styles.actions}>
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
                ×
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
          <div className={styles.dropdownFooter}>
            {/* <button className={styles.viewAll} onClick={() => window.location.href = "/notifications"}>View all</button> */}
          </div>
        </div>
      )}
    </div>
  );
}

export default NotificationBell;

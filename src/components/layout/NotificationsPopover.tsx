import React, { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../lib/firebase';
import { collection, query, where, orderBy, onSnapshot, updateDoc, doc, limit, deleteDoc } from 'firebase/firestore';
import { Link } from 'react-router-dom';
import { Bell, Check, Trash2, CheckCircle2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export function NotificationsPopover({ onClose }: { onClose: () => void }) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    
    // Mark global notifications as read when opening popover
    localStorage.setItem('lastReadGlobalNotification', Date.now().toString());

    const qUser = query(
      collection(db, 'notifications'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc'),
      limit(20)
    );
    const qGlobal = query(
      collection(db, 'notifications'),
      where('type', '==', 'NEW_POST'),
      orderBy('createdAt', 'desc'),
      limit(20)
    );

    let userNotifs: any[] = [];
    let globalNotifs: any[] = [];

    const unsubscribeUser = onSnapshot(qUser, (snapshot) => {
      userNotifs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      combineAndSet();
    });

    const unsubscribeGlobal = onSnapshot(qGlobal, (snapshot) => {
      globalNotifs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      combineAndSet();
    }, (error) => {
      console.error("Error fetching global notifications in popover:", error);
    });

    const combineAndSet = () => {
      const combined = [...userNotifs, ...globalNotifs]
        .sort((a, b) => {
          const aTime = a.createdAt?.toMillis() || 0;
          const bTime = b.createdAt?.toMillis() || 0;
          return bTime - aTime;
        })
        .slice(0, 30);
      setNotifications(combined);
    };

    return () => {
      unsubscribeUser();
      unsubscribeGlobal();
    };
  }, [user]);

  const markAllAsRead = () => {
    notifications.filter(n => !n.read && n.userId).forEach((n) => {
      updateDoc(doc(db, 'notifications', n.id), { read: true });
    });
  };

  const clearAllNotifications = () => {
    notifications.forEach((n) => {
      if (n.userId) deleteDoc(doc(db, 'notifications', n.id));
    });
    setNotifications([]);
    onClose();
  };

  const handleNotificationClick = (id: string, userId?: string) => {
    if (userId) {
      updateDoc(doc(db, 'notifications', id), { read: true });
    }
    onClose();
  };

  const deleteNotification = async (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await deleteDoc(doc(db, 'notifications', id));
      setNotifications(prev => prev.filter(n => n.id !== id));
    } catch (err) {
      console.error("Error deleting notification:", err);
    }
  };

  return (
    <>
      {/* Mobile Backdrop */}
      <div 
        className="fixed inset-0 z-40 sm:hidden" 
        onClick={(e) => { e.stopPropagation(); onClose(); }} 
      />
      
      <div className="fixed inset-x-2 top-20 sm:absolute sm:inset-auto sm:right-0 sm:top-14 sm:w-96 bg-slate-900/95 backdrop-blur-xl border border-white/10 shadow-[0_0_40px_rgba(0,0,0,0.5)] rounded-2xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2">
        <div className="p-4 border-b border-white/5 flex items-center justify-between bg-black/20">
          <h3 className="font-bold text-sm text-white flex items-center gap-2"><Bell className="w-4 h-4 text-primary" /> Notifications</h3>
          <div className="flex items-center gap-2">
            {notifications.some(n => !n.read) && (
              <button title="Mark all read" onClick={markAllAsRead} className="text-xs text-primary hover:text-white transition-colors flex items-center justify-center bg-primary/10 w-6 h-6 rounded">
                <CheckCircle2 className="w-3 h-3" />
              </button>
            )}
            {notifications.length > 0 && (
              <button title="Clear all" onClick={clearAllNotifications} className="text-xs text-red-400 hover:text-red-300 transition-colors flex items-center justify-center bg-red-400/10 w-6 h-6 rounded">
                <Trash2 className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
        <div className="max-h-[60vh] sm:max-h-96 overflow-y-auto overscroll-contain">
          {notifications.length === 0 ? (
            <div className="p-10 flex flex-col items-center justify-center text-gray-500 text-sm gap-3 opacity-70">
              <Bell className="w-8 h-8" />
              <p>No new notifications</p>
            </div>
          ) : (
            notifications.map(n => {
              const isUnread = n.type === 'NEW_POST' ? false : !n.read;
              return (
              <div key={n.id} className={`p-4 border-b border-white/5 hover:bg-white/5 transition-colors relative group ${isUnread ? 'bg-primary/10 border-l-2 border-l-primary' : ''}`}>
                <Link to={`/item/${n.itemId}`} onClick={() => handleNotificationClick(n.id, n.userId)} className={`block pr-8 ${isUnread ? 'pl-2' : ''}`}>
                  <p className={`text-sm ${isUnread ? 'text-white font-medium' : 'text-gray-300'}`}>{n.message}</p>
                  <div className="text-[10px] text-gray-500 mt-2 font-medium tracking-wide">
                    {n.createdAt && formatDistanceToNow(n.createdAt.toDate(), { addSuffix: true })}
                  </div>
                </Link>
                {/* Delete button */}
                <button 
                  onClick={(e) => deleteNotification(e, n.id)} 
                  className="absolute right-4 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center text-gray-500 hover:text-red-400 hover:bg-white/10 rounded-full transition-colors opacity-0 group-hover:opacity-100"
                  title="Delete notification"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            )})
          )}
        </div>
      </div>
    </>
  );
}

import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { db, loginWithGoogle, logout } from '../../lib/firebase';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { Button } from '../ui/Button';
import { LogIn, Search, PlusSquare, User, Trophy, ArrowLeft, Menu, X, MessageSquare, List, Bell } from 'lucide-react';
import toast from 'react-hot-toast';
import { NotificationsPopover } from './NotificationsPopover';

export function Navbar() {
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [globalUnreadCount, setGlobalUnreadCount] = useState(0);

  useEffect(() => {
    // Request Notification permission
    if (user && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    // Set initial last read if not exists
    if (!localStorage.getItem('lastReadGlobalNotification')) {
      localStorage.setItem('lastReadGlobalNotification', Date.now().toString());
    }
    const lastReadTime = Number(localStorage.getItem('lastReadGlobalNotification'));

    const qGlobal = query(
      collection(db, 'notifications'),
      where('type', '==', 'NEW_POST'),
      orderBy('createdAt', 'desc')
    );
    const unsubscribeGlobal = onSnapshot(qGlobal, (snapshot) => {
      let count = 0;
      snapshot.docs.forEach((doc) => {
        const data = doc.data();
        if (data.createdAt && data.createdAt.toMillis() > lastReadTime) {
          count++;
        }
      });
      setGlobalUnreadCount(count);

      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const data = change.doc.data();
          if (data.createdAt && Date.now() - data.createdAt.toMillis() < 5000) {
            toast(data.message, { icon: '📢' });
            if ('Notification' in window && Notification.permission === 'granted') {
              new Notification('New Update', { body: data.message });
            }
          }
        }
      });
    }, (error) => {
      console.error("Error fetching global notifications:", error);
    });

    const qUser = query(
      collection(db, 'notifications'),
      where('userId', '==', user.uid),
      where('read', '==', false)
    );
    const unsubscribeUser = onSnapshot(qUser, (snapshot) => {
      setUnreadCount(snapshot.docs.length);
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          // Toast for new notifications if not initial load
          // Only show if it's very recent (so we don't show old ones on reload)
          const data = change.doc.data();
          if (data.createdAt && Date.now() - data.createdAt.toMillis() < 5000) {
            toast(data.message || 'Someone might have found your item!', {
              icon: '🔔',
            });
            if ('Notification' in window && Notification.permission === 'granted') {
              new Notification('New Update', { body: data.message });
            }
          }
        }
      });
    });
    
    return () => {
      unsubscribeGlobal();
      unsubscribeUser();
    };
  }, [user]);

  const handleLogin = async () => {
    try {
      await loginWithGoogle();
      toast.success('Successfully signed in!');
    } catch (error: any) {
      if (error.code === 'auth/popup-closed-by-user' || error.code === 'auth/popup-blocked') {
        toast.error('Sign-in popup closed or blocked. Try opening the app in a new tab.');
      } else {
        toast.error('Failed to sign in. Please try opening in a new tab if issues persist.');
      }
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      setMobileMenuOpen(false);
      toast.success('Signed out successfully');
    } catch (error) {
      toast.error('Failed to sign out');
    }
  };

  const isHome = location.pathname === '/';

  return (
    <nav className="sticky top-0 z-50 w-full glass rounded-none border-t-0 border-l-0 border-r-0 backdrop-blur-2xl bg-slate-900/50">
      <div className="container mx-auto px-4 sm:px-6 lg:px-10 flex h-16 sm:h-20 items-center justify-between">
        <div className="flex items-center gap-3">
          {!isHome && (
            <button 
              onClick={() => navigate(-1)}
              className="mr-1 sm:mr-3 p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors hidden sm:block"
              title="Go Back"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
          )}
          
          <Link to="/" className="flex items-center gap-3 group">
            <div className="h-8 w-8 sm:h-10 sm:w-10 bg-gradient-to-br from-primary to-blue-600 rounded-xl flex items-center justify-center text-white shadow-[0_0_15px_rgba(6,182,212,0.4)] group-hover:scale-105 transition-transform">
               <Trophy className="h-5 w-5 sm:h-6 sm:w-6" />
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-lg sm:text-xl tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">GBPIET</span>
              <span className="text-[10px] sm:text-xs font-medium text-primary tracking-widest uppercase flex items-center gap-1">Connect</span>
            </div>
          </Link>
        </div>

        {user ? (
          <div className="flex items-center gap-3 sm:gap-6">
            <Link to="/post" className="hidden lg:flex">
              <Button variant="default" className="text-xs tracking-wider rounded-xl uppercase shadow-[0_0_15px_rgba(6,182,212,0.4)]">
                <PlusSquare className="h-4 w-4 mr-2" /> Post Item
              </Button>
            </Link>
            <Link to="/leaderboard" className="text-xs tracking-wider font-semibold hover:text-white text-gray-300 transition-colors hidden lg:block">
              LEADERBOARD
            </Link>
            <Link to="/chats" className="text-xs tracking-wider font-semibold hover:text-white text-gray-300 transition-colors hidden lg:block">
              CHATS
            </Link>
            {isAdmin && (
              <Link to="/admin" className="text-xs tracking-wider font-semibold text-destructive hover:text-destructive/80 transition-colors hidden lg:block">
                ADMIN
              </Link>
            )}
            
            <div className="relative">
              <button onClick={() => {
                const newState = !notificationsOpen;
                setNotificationsOpen(newState);
                if (newState) {
                  setGlobalUnreadCount(0);
                  localStorage.setItem('lastReadGlobalNotification', Date.now().toString());
                }
              }} className="p-2 text-gray-300 hover:text-white transition-colors relative">
                <Bell className="h-6 w-6" />
                {(unreadCount + globalUnreadCount) > 0 && (
                  <span className="absolute top-1 right-1 h-4 w-4 bg-red-500 rounded-full text-[10px] flex items-center justify-center font-bold text-white border-2 border-slate-900">
                    {(unreadCount + globalUnreadCount) > 9 ? '9+' : (unreadCount + globalUnreadCount)}
                  </span>
                )}
              </button>
              {notificationsOpen && <NotificationsPopover onClose={() => setNotificationsOpen(false)} />}
            </div>

            <div className="hidden lg:flex items-center gap-4 border-l border-white/10 pl-6 ml-2">
              <div className="text-right">
                <div className="text-[10px] font-mono text-primary">SESSION: ACTIVE</div>
                <div className="text-sm font-bold text-white max-w-[120px] truncate">{user.displayName || 'USER'}</div>
              </div>
              <Link to={`/profile/${user.uid}`}>
                <div className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center overflow-hidden border border-white/20 hover:border-primary transition-all shadow-lg">
                  {user.photoURL ? (
                    <img src={user.photoURL} alt={user.displayName || 'User'} className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <span className="font-bold text-white text-lg uppercase">{user.displayName?.charAt(0) || 'U'}</span>
                  )}
                </div>
              </Link>
              <button onClick={handleLogout} className="text-[10px] tracking-widest text-gray-400 hover:text-white ml-2 uppercase font-semibold transition-colors">
                Logout
              </button>
            </div>

            {/* Mobile Actions */}
            <div className="flex items-center gap-3 lg:hidden">
              <Link to="/post" className="p-2 text-gray-300 hover:text-white transition-colors">
                <PlusSquare className="h-6 w-6" />
              </Link>
              <button 
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="p-2 text-gray-300 hover:text-white transition-colors"
              >
                {mobileMenuOpen ? <X className="h-7 w-7" /> : <Menu className="h-7 w-7" />}
              </button>
            </div>
          </div>
        ) : (
          <Button onClick={handleLogin} variant="default" className="text-xs sm:text-sm shadow-[0_0_15px_rgba(6,182,212,0.4)] tracking-wider rounded-xl uppercase px-4 py-2 h-auto">
            <LogIn className="mr-2 h-4 w-4" />
            Sign In
          </Button>
        )}
      </div>

      {/* Mobile Menu Dropdown */}
      {user && mobileMenuOpen && (
        <div className="lg:hidden absolute top-full left-0 w-full bg-slate-900 border-b border-white/10 shadow-2xl p-4 flex flex-col gap-4 animate-in slide-in-from-top-2">
          {!isHome && (
            <button 
              onClick={() => { navigate(-1); setMobileMenuOpen(false); }}
              className="flex items-center gap-3 p-3 rounded-lg text-gray-300 hover:bg-white/5 hover:text-white w-full text-left"
            >
              <ArrowLeft className="h-5 w-5" />
              <span className="font-medium tracking-wide">Back</span>
            </button>
          )}
          <Link to={`/profile/${user.uid}`} onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-3 p-3 rounded-lg hover:bg-white/5 border border-white/5">
            <div className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center overflow-hidden">
              {user.photoURL ? (
                <img src={user.photoURL} alt={user.displayName || 'User'} className="h-full w-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                <span className="font-bold text-white text-lg uppercase">{user.displayName?.charAt(0) || 'U'}</span>
              )}
            </div>
            <div>
              <div className="text-sm font-bold text-white">{user.displayName || 'USER'}</div>
              <div className="text-[10px] text-primary">View Profile</div>
            </div>
          </Link>
          <Link to="/leaderboard" onClick={() => setMobileMenuOpen(false)} className="flex items-center justify-between p-3 rounded-lg text-gray-300 hover:bg-white/5 hover:text-white">
            <span className="font-semibold tracking-wider text-sm flex items-center gap-2"><Trophy className="w-4 h-4"/> LEADERBOARD</span>
          </Link>
          <Link to="/chats" onClick={() => setMobileMenuOpen(false)} className="flex items-center justify-between p-3 rounded-lg text-gray-300 hover:bg-white/5 hover:text-white">
            <span className="font-semibold tracking-wider text-sm flex items-center gap-2"><MessageSquare className="w-4 h-4"/> CHATS</span>
          </Link>
          {isAdmin && (
            <Link to="/admin" onClick={() => setMobileMenuOpen(false)} className="flex items-center justify-between p-3 rounded-lg text-destructive hover:bg-destructive/10">
              <span className="font-semibold tracking-wider text-sm">ADMIN DASHBOARD</span>
            </Link>
          )}
          <button onClick={handleLogout} className="w-full text-left p-3 mt-2 border-t border-white/10 rounded-none text-red-400 font-semibold text-sm tracking-wider hover:bg-red-500/10 transition-colors">
            LOGOUT
          </button>
        </div>
      )}
    </nav>
  );
}

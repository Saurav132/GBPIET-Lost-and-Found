import React, { useEffect, useState } from 'react';
import { db } from '../lib/firebase';
import { collection, query, getDocs, deleteDoc, doc, updateDoc, orderBy, getDoc, serverTimestamp, increment, limit } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Trash2, UserCheck, ShieldAlert, Shield } from 'lucide-react';
import { Navigate } from 'react-router-dom';
import toast from 'react-hot-toast';

export function Admin() {
  const { user, isAdmin, loading } = useAuth();
  const [users, setUsers] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [chats, setChats] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [tab, setTab] = useState<'ANALYTICS' | 'USERS' | 'ITEMS' | 'CHATS' | 'REPORTS'>('ANALYTICS');

  useEffect(() => {
    if (!isAdmin) return;
    
    async function fetchData() {
      try {
        const usersSnap = await getDocs(query(collection(db, 'users'), limit(500)));
        setUsers(usersSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        
        const itemsSnap = await getDocs(query(collection(db, 'items'), orderBy('createdAt', 'desc'), limit(500)));
        setItems(itemsSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        
        const chatsSnap = await getDocs(query(collection(db, 'chats'), orderBy('createdAt', 'desc'), limit(500)));
        setChats(chatsSnap.docs.map(d => ({ id: d.id, ...d.data() })));

        const reportsSnap = await getDocs(query(collection(db, 'reports'), orderBy('createdAt', 'desc'), limit(500)));
        setReports(reportsSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (err) {
        console.error(err);
      }
    }
    fetchData();
  }, [isAdmin]);

  if (loading) return <div className="p-10 text-center uppercase tracking-widest text-xs">Loading...</div>;
  if (!user || !isAdmin) return <Navigate to="/" replace />;

  const handleDeleteUser = async (id: string, name: string) => {
    try {
      await deleteDoc(doc(db, 'users', id));
      setUsers(users.filter(u => u.id !== id));
      toast.success('User deleted.');
    } catch (err) {
      console.error(err);
      toast.error('Failed to delete user.');
    }
  };

  const handleRestrictUser = async (id: string, currentStatus: boolean) => {
    try {
      await updateDoc(doc(db, 'users', id), { 
        isRestricted: !currentStatus,
        updatedAt: serverTimestamp() 
      });
      setUsers(users.map(u => u.id === id ? { ...u, isRestricted: !currentStatus } : u));
      toast.success(currentStatus ? 'User unbanned' : 'User restricted');
    } catch (err) {
      console.error(err);
      toast.error('Failed to change restriction status.');
    }
  };

  const handlePromoteUser = async (id: string, currentRole: string) => {
    const newRole = currentRole === 'ADMIN' ? 'USER' : 'ADMIN';
    try {
      await updateDoc(doc(db, 'users', id), { 
        role: newRole,
        updatedAt: serverTimestamp() 
      });
      setUsers(users.map(u => u.id === id ? { ...u, role: newRole } : u));
      toast.success(`Role updated to ${newRole}`);
    } catch (err) {
      console.error(err);
      toast.error('Failed to update role.');
    }
  };

  const handleDeleteItem = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'items', id));
      setItems(items.filter(i => i.id !== id));
      toast.success('Item deleted');
    } catch (err) {
      console.error(err);
      toast.error('Failed to delete item.');
    }
  };

  const handleDeleteChat = async (id: string) => {
    try {
      const messagesRef = collection(db, 'chats', id, 'messages');
      const messagesSnap = await getDocs(query(messagesRef, limit(500)));
      for (const msg of messagesSnap.docs) {
        await deleteDoc(doc(db, 'chats', id, 'messages', msg.id));
      }
      await deleteDoc(doc(db, 'chats', id));
      setChats(chats.filter(c => c.id !== id));
      toast.success('Chat deleted');
    } catch (err) {
      console.error(err);
      toast.error('Failed to delete chat.');
    }
  };

  const handleDismissReport = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'reports', id));
      setReports(reports.filter(r => r.id !== id));
      toast.success('Report dismissed');
    } catch (err) {
      console.error(err);
      toast.error('Failed to dismiss report');
    }
  };

  const handleDeleteReportedItem = async (reportId: string, itemId: string) => {
    try {
      const itemSnap = await getDoc(doc(db, 'items', itemId));
      if (itemSnap.exists()) {
         const itemData = itemSnap.data();
         if (itemData.ownerId) {
            const userRef = doc(db, 'users', itemData.ownerId);
            const userSnap = await getDoc(userRef);
            if (userSnap.exists()) {
                await updateDoc(userRef, {
                    points: increment(-10),
                    updatedAt: serverTimestamp()
                });
                toast('10 points deducted from the user who posted this item.', { icon: '⚖️' });
            }
         }
      }
      
      await deleteDoc(doc(db, 'items', itemId));
      await deleteDoc(doc(db, 'reports', reportId));
      setItems(items.filter(i => i.id !== itemId));
      setReports(reports.filter(r => r.id !== reportId));
      toast.success('Item deleted and report dismissed');
    } catch (err) {
      console.error(err);
      toast.error('Failed to process reported item');
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 py-10 px-4 w-full">
      <div className="flex items-center gap-4 bg-white/5 border border-white/10 rounded-2xl p-6 glass">
        <div className="p-3 bg-red-500/20 rounded-xl">
          <ShieldAlert className="h-8 w-8 text-red-400" />
        </div>
        <div className="flex flex-col">
          <h1 className="text-2xl sm:text-4xl font-bold tracking-tight text-white mb-1">Admin Console</h1>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest">System Management</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <Button variant={tab === 'ANALYTICS' ? 'default' : 'outline'} onClick={() => setTab('ANALYTICS')} className="rounded-xl tracking-wider text-xs font-bold px-6 shadow-[0_0_15px_rgba(6,182,212,0.2)]">Analytics</Button>
        <Button variant={tab === 'USERS' ? 'default' : 'outline'} onClick={() => setTab('USERS')} className="rounded-xl tracking-wider text-xs font-bold px-6 border-white/10 shadow-[0_0_15px_rgba(255,255,255,0.05)]">Accounts</Button>
        <Button variant={tab === 'ITEMS' ? 'default' : 'outline'} onClick={() => setTab('ITEMS')} className="rounded-xl tracking-wider text-xs font-bold px-6 border-white/10 shadow-[0_0_15px_rgba(255,255,255,0.05)]">Registry Items</Button>
        <Button variant={tab === 'CHATS' ? 'default' : 'outline'} onClick={() => setTab('CHATS')} className="rounded-xl tracking-wider text-xs font-bold px-6 border-white/10 shadow-[0_0_15px_rgba(255,255,255,0.05)]">Chats</Button>
        <Button variant={tab === 'REPORTS' ? 'default' : 'outline'} onClick={() => setTab('REPORTS')} className="rounded-xl tracking-wider text-xs font-bold px-6 border-white/10 shadow-[0_0_15px_rgba(255,255,255,0.05)] relative">
          Reports
          {reports.length > 0 && (
            <span className="absolute -top-1 -right-1 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
            </span>
          )}
        </Button>
      </div>

      {tab === 'ANALYTICS' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="glass border-white/10">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-bold tracking-widest text-primary uppercase">Total Lost</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-black text-white">{items.filter(i => i.type === 'LOST').length}</div>
            </CardContent>
          </Card>
          <Card className="glass border-white/10">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-bold tracking-widest text-primary uppercase">Total Found</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-black text-white">{items.filter(i => i.type === 'FOUND').length}</div>
            </CardContent>
          </Card>
          <Card className="glass border-white/10">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-bold tracking-widest text-emerald-400 uppercase">Resolved</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-black text-white">{items.filter(i => i.status === 'RESOLVED').length}</div>
            </CardContent>
          </Card>
          <Card className="glass border-white/10">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-bold tracking-widest text-blue-400 uppercase">Active Users</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-black text-white">{users.length}</div>
            </CardContent>
          </Card>
          <Card className="glass border-white/10 sm:col-span-2 lg:col-span-4">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-bold tracking-widest text-purple-400 uppercase">Resolution Rate</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-5xl font-black text-white">
                {items.length > 0 ? Math.round((items.filter(i => i.status === 'RESOLVED').length / items.length) * 100) : 0}%
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {tab === 'USERS' && (
        <Card className="glass border-white/10 overflow-hidden">
          <CardHeader className="border-b border-white/10 bg-black/20">
            <CardTitle className="text-xs font-bold tracking-widest text-primary uppercase">Management / Accounts</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-white/5">
              {users.map(u => (
                <div key={u.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-6 hover:bg-white/5 transition-colors">
                  <div className="min-w-0 pr-4">
                    <div className="flex flex-wrap items-center gap-3 mb-2">
                       <span className="font-bold text-white text-lg truncate">{u.name}</span>
                      {u.role === 'ADMIN' ? (
                        <Badge variant="outline" className="text-[10px] bg-primary/20 text-primary-300 border-primary/30 font-bold px-2 py-0"><Shield className="h-3 w-3 mr-1"/> ADMIN</Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] border-white/20 text-gray-400 font-bold px-2 py-0">USER</Badge>
                      )}
                      {u.isRestricted && (
                        <Badge variant="destructive" className="text-[10px] bg-red-500/20 text-red-400 border-red-500/30 font-bold px-2 py-0 ml-2">RESTRICTED</Badge>
                      )}
                    </div>
                    <div className="text-xs font-medium text-gray-400 truncate mb-1">{u.email} <span className="mx-2 text-white/20">|</span> Points: <span className="text-primary font-bold">{u.points || 0}</span></div>
                    <div className="text-[10px] text-gray-600 font-mono mt-1 truncate">ID: {u.id}</div>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-4 sm:mt-0 shrink-0">
                    <Button variant="outline" size="sm" onClick={() => handleRestrictUser(u.id, !!u.isRestricted)} className="text-[10px] font-bold tracking-wider rounded-lg border-white/20 hover:bg-white/10">
                      <ShieldAlert className="h-4 w-4 sm:mr-2 text-orange-400" />
                      <span className="hidden sm:inline text-orange-400">{u.isRestricted ? 'UNBAN' : 'RESTRICT'}</span>
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handlePromoteUser(u.id, u.role || 'USER')} className="text-[10px] font-bold tracking-wider rounded-lg border-white/20 hover:bg-white/10">
                      <UserCheck className="h-4 w-4 sm:mr-2" />
                      <span className="hidden sm:inline">{u.role === 'ADMIN' ? 'DEMOTE' : 'PROMOTE'}</span>
                    </Button>
                    <Button variant="destructive" size="sm" onClick={() => handleDeleteUser(u.id, u.name)} className="text-[10px] font-bold tracking-wider rounded-lg shadow-[0_0_10px_rgba(239,68,68,0.3)]">
                      <Trash2 className="h-4 w-4 sm:mr-2" />
                      <span className="hidden sm:inline">DELETE</span>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {tab === 'ITEMS' && (
        <Card className="glass border-white/10 overflow-hidden">
          <CardHeader className="border-b border-white/10 bg-black/20">
            <CardTitle className="text-xs font-bold tracking-widest text-primary uppercase">Management / Items</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-white/5">
              {items.map(i => (
                <div key={i.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-6 hover:bg-white/5 transition-colors">
                  <div className="min-w-0 pr-4">
                    <div className="flex flex-wrap items-center gap-3 mb-2">
                      <Badge variant={i.type === 'LOST' ? 'destructive' : 'success'} className="px-2 py-0 text-[10px]">{i.type}</Badge>
                      <span className="font-bold text-white text-lg truncate line-clamp-1">{i.title}</span>
                      <Badge variant="secondary" className="text-[10px] px-2 py-0 bg-white/10">{i.status}</Badge>
                    </div>
                    <div className="text-xs font-medium text-gray-400 line-clamp-2 max-w-2xl leading-relaxed mb-2 break-words">{i.description}</div>
                    <div className="text-[10px] text-gray-600 font-mono mt-1 truncate">OWNER: <span className="text-gray-500">{i.ownerId}</span> <span className="mx-2 text-white/20">|</span> ID: <span className="text-gray-500">{i.id}</span></div>
                  </div>
                  <div className="flex gap-2 mt-4 sm:mt-0 shrink-0">
                    <Button variant="destructive" size="sm" onClick={() => handleDeleteItem(i.id)} className="text-[10px] font-bold tracking-wider rounded-lg shadow-[0_0_10px_rgba(239,68,68,0.3)]">
                      <Trash2 className="h-4 w-4 sm:mr-2" />
                      <span className="hidden sm:inline">DELETE ITEM</span>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {tab === 'CHATS' && (
        <Card className="glass border-white/10 overflow-hidden">
          <CardHeader className="border-b border-white/10 bg-black/20">
            <CardTitle className="text-xs font-bold tracking-widest text-primary uppercase">Management / Chats</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-white/5">
              {chats.map(c => (
                <div key={c.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-6 hover:bg-white/5 transition-colors">
                  <div className="min-w-0 pr-4">
                    <div className="flex flex-wrap items-center gap-3 mb-2">
                       <span className="font-bold text-white text-lg truncate">Item REF: {c.itemId}</span>
                       <Badge variant="secondary" className="text-[10px] px-2 py-0 bg-white/10">{c.status || 'active'}</Badge>
                    </div>
                    <div className="text-[10px] text-gray-600 font-mono mt-1">P1: <span className="text-gray-500">{c.participant1Id}</span></div>
                    <div className="text-[10px] text-gray-600 font-mono mt-1">P2: <span className="text-gray-500">{c.participant2Id}</span></div>
                    <div className="text-[10px] text-gray-600 font-mono mt-1">ID: <span className="text-gray-500">{c.id}</span></div>
                  </div>
                  <div className="flex gap-2 mt-4 sm:mt-0 shrink-0">
                    <Button variant="destructive" size="sm" onClick={() => handleDeleteChat(c.id)} className="text-[10px] font-bold tracking-wider rounded-lg shadow-[0_0_10px_rgba(239,68,68,0.3)]">
                      <Trash2 className="h-4 w-4 sm:mr-2" />
                      <span className="hidden sm:inline">DELETE CHAT</span>
                    </Button>
                  </div>
                </div>
              ))}
              {chats.length === 0 && (
                <div className="p-10 text-center text-sm font-medium text-gray-500 opacity-80">No chats found.</div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {tab === 'REPORTS' && (
        <Card className="glass border-white/10 overflow-hidden">
          <CardHeader className="border-b border-white/10 bg-black/20">
            <CardTitle className="text-xs font-bold tracking-widest text-primary uppercase">Management / Reports</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-white/5">
              {reports.map(r => (
                <div key={r.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-6 hover:bg-white/5 transition-colors bg-red-900/10">
                  <div className="min-w-0 pr-4">
                    <div className="flex flex-wrap items-center gap-3 mb-2">
                       <ShieldAlert className="w-5 h-5 text-red-500" />
                       <span className="font-bold text-white text-lg truncate">Item REF: {r.itemId}</span>
                    </div>
                    <div className="text-sm text-gray-300 font-medium mt-2 bg-black/20 p-3 rounded-lg border border-white/5">
                      <span className="text-red-400 font-bold mr-2">Reason:</span>
                      {r.reason}
                    </div>
                    <div className="text-[10px] text-gray-600 font-mono mt-3">Reported By: <span className="text-gray-500">{r.reportedBy}</span></div>
                    <div className="text-[10px] text-gray-600 font-mono mt-1">Report ID: <span className="text-gray-500">{r.id}</span></div>
                  </div>
                  <div className="flex flex-col gap-2 mt-4 sm:mt-0 shrink-0">
                    <Button variant="outline" size="sm" onClick={() => handleDismissReport(r.id)} className="text-[10px] font-bold tracking-wider rounded-lg border-white/10 hover:bg-white/10 text-gray-400">
                      DISMISS REPORT
                    </Button>
                    <Button variant="destructive" size="sm" onClick={() => handleDeleteReportedItem(r.id, r.itemId)} className="text-[10px] font-bold tracking-wider rounded-lg shadow-[0_0_10px_rgba(239,68,68,0.3)]">
                      <Trash2 className="h-4 w-4 sm:mr-2" />
                      <span className="hidden sm:inline">DELETE ITEM</span>
                    </Button>
                  </div>
                </div>
              ))}
              {reports.length === 0 && (
                <div className="p-10 text-center text-sm font-medium text-gray-500 opacity-80">No reports found. Clean queue! 🎉</div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

  import { useEffect, useState, useMemo } from 'react';
import { collection, query, orderBy, getDocs, onSnapshot, limit } from 'firebase/firestore';
import { db, loginWithGoogle } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Skeleton } from '../components/ui/Skeleton';
import { format } from 'date-fns';
import { MapPin, Image as ImageIcon, CheckCircle2 } from 'lucide-react';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import toast from 'react-hot-toast';

interface Item {
  id: string;
  type: 'LOST' | 'FOUND';
  title: string;
  description: string;
  category?: string;
  imageUrl?: string;
  status: 'OPEN' | 'CLAIMED' | 'RESOLVED';
  createdAt: any;
  lat?: number;
  lng?: number;
}

export function Feed() {
  const { user } = useAuth();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'ALL'|'LOST'|'FOUND'|'RESOLVED'>('ALL');
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!user) {
      setItems([]);
      setLoading(false);
      return;
    }
    const q = query(
      collection(db, 'items'),
      orderBy('createdAt', 'desc'),
      limit(200)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Item));
      setItems(data);
      setLoading(false);
    }, (error) => {
      console.error('Error fetching items', error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const filteredItems = useMemo(() => {
    return items.filter(item => {
      if (filter !== 'ALL') {
        if (filter === 'RESOLVED' && item.status !== 'RESOLVED') return false;
        if (filter !== 'RESOLVED' && item.status === 'RESOLVED') return false;
        if (filter === 'LOST' && item.type !== 'LOST') return false;
        if (filter === 'FOUND' && item.type !== 'FOUND') return false;
      } else {
        if (item.status === 'RESOLVED') return false;
      }
      
      if (search && !item.title.toLowerCase().includes(search.toLowerCase()) && !item.description.toLowerCase().includes(search.toLowerCase())) {
        return false;
      }
      
      return true;
    });
  }, [items, filter, search]);

  if (!user) {
    const handleLoginClick = async () => {
      try {
        await loginWithGoogle();
      } catch (error: any) {
        if (error.code === 'auth/popup-closed-by-user' || error.code === 'auth/popup-blocked') {
          toast.error('Sign-in popup closed or blocked. Try opening the app in a new tab.');
        } else {
          toast.error('Failed to sign in. Please try opening in a new tab if issues persist.');
        }
      }
    };

    return (
      <div className="flex-1 flex flex-col items-center justify-center h-full w-full text-center space-y-6 px-4">
        <div className="glass p-10 max-w-md w-full">
          <h2 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-blue-400 mb-4">Access Required</h2>
          <p className="text-gray-400 mb-8">Sign in with Google to view the secure campus registry.</p>
          <Button onClick={handleLoginClick} variant="default" className="w-full h-12">Sign In with Google</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col p-4 sm:p-6 lg:p-10 overflow-hidden w-full max-w-7xl mx-auto">
      <header className="mb-6 sm:mb-12 flex flex-col sm:flex-row justify-between items-start sm:items-end gap-6 shrink-0 relative z-10 w-full">
        <div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight leading-none text-white mb-2">
            Campus <span className="bg-clip-text text-transparent bg-gradient-to-r from-primary to-blue-500">Registry</span>
          </h1>
          <p className="text-gray-400 font-medium">Browse reported lost and found items across securely.</p>
        </div>
        
        <div className="flex flex-col items-start sm:items-end gap-3 text-left sm:text-right w-full sm:w-auto">
          <Input 
            placeholder="Search registry..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full sm:w-72"
          />
          <div className="flex flex-wrap gap-2 text-xs font-semibold w-full sm:justify-end">
            <Button size="sm" variant={filter === 'ALL' ? 'default' : 'outline'} onClick={() => setFilter('ALL')} className="rounded-full">All</Button>
            <Button size="sm" variant={filter === 'LOST' ? 'default' : 'outline'} onClick={() => setFilter('LOST')} className="rounded-full">Lost</Button>
            <Button size="sm" variant={filter === 'FOUND' ? 'default' : 'outline'} onClick={() => setFilter('FOUND')} className="rounded-full">Found</Button>
            <Button size="sm" variant={filter === 'RESOLVED' ? 'default' : 'outline'} onClick={() => setFilter('RESOLVED')} className="rounded-full border-green-500/50 text-green-400 hover:bg-green-500/10"><CheckCircle2 className="w-3 h-3 mr-1"/> Resolved</Button>
          </div>
        </div>
      </header>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 overflow-y-auto pb-10">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="glass p-6 flex flex-col min-h-[300px]">
              <div className="flex justify-between items-start shrink-0 mb-4 gap-2">
                <div className="flex gap-2">
                  <Skeleton className="h-6 w-16 rounded-full" />
                  <Skeleton className="h-6 w-20 rounded-full" />
                </div>
                <Skeleton className="h-4 w-12" />
              </div>
              <Skeleton className="h-40 w-full mb-4 rounded-xl" />
              <div className="grow mb-4 flex flex-col gap-2">
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
              </div>
              <div className="flex justify-between items-end pt-4 shrink-0 mt-auto border-t border-white/10">
                <div className="flex flex-col gap-1">
                  <Skeleton className="h-3 w-10" />
                  <Skeleton className="h-4 w-16" />
                </div>
                <Skeleton className="h-8 w-24 rounded-lg" />
              </div>
            </div>
          ))}
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="text-center py-20 border border-neutral-800 bg-neutral-900/30 text-muted-foreground uppercase text-[10px] tracking-[0.2em] rounded-2xl w-full">
          <p>No items found matching your filters.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6 overflow-y-auto pb-10 w-full">
          {filteredItems.map(item => {
            const isExpired = item.status === 'OPEN' && item.createdAt && (Date.now() - item.createdAt.toMillis() > 7 * 24 * 60 * 60 * 1000);
            const displayStatus = isExpired ? 'EXPIRED' : item.status;
            
            return (
              <Link to={`/item/${item.id}`} key={item.id} className="glass glass-hover p-5 sm:p-6 flex flex-col min-h-[300px] w-full relative overflow-hidden">
                  {isExpired && (
                    <div className="absolute top-4 right-4 z-10 w-3 h-3 bg-red-600 rounded-full animate-pulse shadow-[0_0_10px_rgba(220,38,38,0.8)]" title="Expired"></div>
                  )}
                  <div className="flex justify-between items-start shrink-0 mb-4 gap-2">
                    <div className="flex flex-wrap gap-2">
                      <Badge variant={item.type === 'LOST' ? 'destructive' : 'success'}>
                        {item.type}
                      </Badge>
                      {item.category && <Badge variant="secondary">{item.category}</Badge>}
                    </div>
                    <span className="text-[10px] sm:text-xs font-medium text-gray-500 whitespace-nowrap">
                      {item.createdAt?.toDate ? format(item.createdAt.toDate(), 'MMM d') : 'New'}
                    </span>
                  </div>
                  
                  {item.imageUrl && (
                    <div className="h-40 -mx-5 sm:-mx-6 mb-4 overflow-hidden shrink-0 mt-2 bg-white/5 relative">
                      <img src={item.imageUrl.replace('/upload/', '/upload/w_400,q_auto,f_auto/')} loading="lazy" alt={item.title} className={`w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ${isExpired ? 'grayscale opacity-70' : ''}`} />
                      {item.status === 'RESOLVED' && (
                        <div className="absolute inset-0 bg-green-500/20 backdrop-blur-[2px] flex items-center justify-center">
                          <div className="bg-green-500 text-white font-bold px-4 py-2 rounded-full flex items-center gap-2 transform -rotate-12 shadow-2xl border border-green-400">
                            <CheckCircle2 className="w-5 h-5" /> RESOLVED
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  
                  <div className="grow mb-4 flex flex-col gap-2">
                    <h2 className={`text-lg sm:text-xl font-bold line-clamp-2 break-words leading-snug ${isExpired ? 'text-gray-400' : 'text-white'}`}>{item.title}</h2>
                    <p className={`text-xs sm:text-sm line-clamp-3 break-words ${isExpired ? 'text-gray-500' : 'text-gray-400'}`}>
                      {item.description}
                    </p>
                  </div>
                  
                  <div className="flex justify-between items-end pt-4 shrink-0 mt-auto border-t border-white/10 w-full">
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Status</span>
                      <span className={`text-xs font-semibold ${item.status === 'RESOLVED' ? 'text-green-400' : isExpired ? 'text-red-400 font-bold' : 'text-white'}`}>{displayStatus}</span>
                    </div>
                    <Button variant="ghost" size="sm" className={`rounded-lg px-2 sm:px-4 ${isExpired ? 'text-gray-500 hover:text-gray-300' : 'text-primary hover:text-white'}`}>
                      View Details
                    </Button>
                  </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

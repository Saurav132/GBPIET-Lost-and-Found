import { useEffect, useState } from 'react';
import { db } from '../lib/firebase';
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Trophy, Medal, Award } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Skeleton } from '../components/ui/Skeleton';
import { getReputationBadge } from '../lib/utils';
import { Badge } from '../components/ui/Badge';

export function Leaderboard() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchLeaders() {
      try {
        const q = query(collection(db, 'users'), orderBy('points', 'desc'), limit(10));
        const snapshot = await getDocs(q);
        setUsers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchLeaders();
  }, []);

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto space-y-12 py-10 w-full px-4">
        <div className="text-center space-y-6">
          <Skeleton className="h-16 w-64 mx-auto" />
          <Skeleton className="h-4 w-32 mx-auto" />
        </div>
        <div className="flex flex-col gap-4">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="flex items-center justify-between glass p-6 sm:px-8">
              <div className="flex items-center gap-4 sm:gap-6 w-full">
                <Skeleton className="h-10 w-8" />
                <Skeleton className="w-14 h-14 sm:w-16 sm:h-16 rounded-full shrink-0" />
                <Skeleton className="h-6 w-1/3" />
              </div>
              <Skeleton className="h-8 w-16" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-12 py-10 w-full px-4">
      <div className="text-center space-y-6">
        <h1 className="text-5xl sm:text-7xl font-black bg-clip-text text-transparent bg-gradient-to-r from-primary to-blue-500 tracking-tight leading-none pt-4">Hall of Fame</h1>
        <p className="text-sm font-bold tracking-widest text-gray-400 uppercase">Top Contributors</p>
      </div>

      <div className="flex flex-col gap-4">
        {users.map((u, index) => (
          <Link to={`/profile/${u.id}`} key={u.id}>
            <div className={`flex items-center justify-between glass glass-hover p-6 sm:px-8 group transition-all duration-300 ${index < 3 ? 'scale-100 hover:scale-[1.02] border-primary/30 shadow-[0_0_20px_rgba(6,182,212,0.15)] bg-primary/5' : 'scale-95 opacity-80 hover:opacity-100 hover:scale-100'}`}>
              <div className="flex items-center gap-4 sm:gap-6 min-w-0">
                <div className="flex flex-col items-center justify-center w-8 shrink-0">
                  {index === 0 && <Trophy className="w-6 h-6 text-yellow-400 mb-1 drop-shadow-[0_0_8px_rgba(250,204,21,0.5)]" />}
                  {index === 1 && <Medal className="w-5 h-5 text-gray-300 mb-1" />}
                  {index === 2 && <Medal className="w-5 h-5 text-amber-600 mb-1" />}
                  <span className={`text-lg font-bold ${index < 3 ? 'text-white' : 'text-gray-500'} font-mono`}>#{index + 1}</span>
                </div>
                <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full border-2 border-white/20 overflow-hidden flex items-center justify-center shrink-0 shadow-lg relative group-hover:border-primary transition-colors">
                  {u.photoURL ? (
                    <img src={u.photoURL} className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <span className="font-bold text-2xl text-white uppercase">{u.name.charAt(0)}</span>
                  )}
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-lg sm:text-xl font-bold text-white truncate break-words">{u.name}</span>
                  <div className="mt-1">
                    <Badge variant="outline" className={`${getReputationBadge(u.points).bg} ${getReputationBadge(u.points).color} ${getReputationBadge(u.points).border} text-[9px] sm:text-[10px] font-bold px-2 py-0 rounded-full inline-block`}>
                      {getReputationBadge(u.points).label}
                    </Badge>
                  </div>
                </div>
              </div>
              <div className="flex flex-col items-end shrink-0 pl-4">
                <span className="text-xl sm:text-2xl font-black text-primary flex items-baseline gap-1 bg-clip-text text-transparent bg-gradient-to-r from-primary to-blue-400">
                  {u.points || 0}
                </span>
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mt-1">Points</span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

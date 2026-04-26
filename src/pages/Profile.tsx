import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { db } from '../lib/firebase';
import { doc, getDoc, collection, query, where, getDocs, updateDoc, serverTimestamp } from 'firebase/firestore';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Trophy, Star, Clock, Edit2 } from 'lucide-react';
import { Badge } from '../components/ui/Badge';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { Skeleton } from '../components/ui/Skeleton';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';
import { getReputationBadge } from '../lib/utils';

export function Profile() {
  const { id } = useParams();
  const { user, isAdmin } = useAuth();
  const [profileUser, setProfileUser] = useState<any>(null);
  const [userItems, setUserItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editBio, setEditBio] = useState('');

  useEffect(() => {
    async function fetchUser() {
      if (!id) return;
      try {
        const userRef = doc(db, 'users', id);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          const data = { id: userSnap.id, ...userSnap.data() } as any;
          setProfileUser(data);
          setEditName(data.name || '');
          setEditBio(data.bio || '');
        }
        
        const itemsQ = query(collection(db, 'items'), where('ownerId', '==', id));
        const itemsSnap = await getDocs(itemsQ);
        setUserItems(itemsSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchUser();
  }, [id]);

  const handleUpdateProfile = async () => {
    if (!id || !user || user.uid !== id) return;
    try {
      const userRef = doc(db, 'users', id);
      await updateDoc(userRef, {
        name: editName,
        bio: editBio,
        updatedAt: serverTimestamp()
      });
      setProfileUser({ ...profileUser, name: editName, bio: editBio });
      setIsEditing(false);
      toast.success('Profile updated successfully');
    } catch (e) {
      console.error(e);
      toast.error('Failed to update profile');
    }
  };

  const handleResetPoints = async () => {
    if (!id || !isAdmin) return;
    if (window.confirm("Are you sure you want to reset this user's points to 0?")) {
      try {
        const userRef = doc(db, 'users', id);
        await updateDoc(userRef, {
          points: 0,
          updatedAt: serverTimestamp()
        });
        setProfileUser({ ...profileUser, points: 0 });
        toast.success("User points reset successfully.");
      } catch (err) {
        console.error(err);
        toast.error("Failed to reset user points.");
      }
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto space-y-12 py-10 px-4 w-full">
        <div className="glass p-8 sm:p-12 flex flex-col sm:flex-row items-center sm:items-start gap-8">
          <Skeleton className="h-32 w-32 sm:h-40 sm:w-40 rounded-full shrink-0" />
          <div className="w-full space-y-4">
            <Skeleton className="h-4 w-32 mb-6" />
            <Skeleton className="h-12 w-64 mb-4" />
            <Skeleton className="h-4 w-full max-w-sm" />
            <Skeleton className="h-4 w-full max-w-xs" />
            <div className="flex gap-6 pt-6 mt-6 border-t border-white/10">
              <Skeleton className="h-16 w-24 rounded-xl" />
              <Skeleton className="h-16 w-24 rounded-xl" />
            </div>
          </div>
        </div>
      </div>
    );
  }
  if (!profileUser) return <div className="text-center p-10 text-red-500 font-bold uppercase tracking-widest bg-white/5 rounded-2xl glass mx-4">User not found</div>;

  const isOwnProfile = user?.uid === id;

  const foundCount = userItems.filter(i => i.type === 'FOUND').length;
  const lostCount = userItems.filter(i => i.type === 'LOST').length;

  return (
    <div className="max-w-4xl mx-auto space-y-12 py-10 px-4 w-full">
      <div className="glass p-8 sm:p-12 flex flex-col sm:flex-row items-center sm:items-start gap-8 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-r from-primary/20 to-blue-500/20 z-0 opacity-50"></div>
        {isOwnProfile && !isEditing && (
          <button onClick={() => setIsEditing(true)} className="absolute top-6 right-6 z-10 text-white/50 hover:text-white bg-black/20 p-2 rounded-full transition-all">
            <Edit2 className="h-5 w-5" />
          </button>
        )}
        <div className="h-32 w-32 sm:h-40 sm:w-40 rounded-full bg-white/5 border-4 border-white/10 overflow-hidden shrink-0 flex items-center justify-center z-10 shadow-2xl relative">
          {profileUser.photoURL ? (
            <img src={profileUser.photoURL} alt={profileUser.name} className="h-full w-full object-cover" referrerPolicy="no-referrer" />
          ) : (
            <span className="font-bold text-6xl text-white uppercase">{profileUser.name.charAt(0)}</span>
          )}
        </div>
        <div className="text-center sm:text-left space-y-4 flex-1 w-full z-10 min-w-0">
          <div className="text-[10px] tracking-widest font-bold text-primary uppercase">MEMBER PROFILE</div>
          
          {isEditing ? (
            <div className="space-y-4 w-full max-w-sm mx-auto sm:mx-0">
              <Input 
                value={editName} 
                onChange={e => setEditName(e.target.value)} 
                placeholder="Name" 
                className="w-full text-lg"
              />
              <Input 
                value={editBio} 
                onChange={e => setEditBio(e.target.value)} 
                placeholder="Bio" 
                className="w-full"
              />
              <div className="flex gap-3">
                <Button onClick={handleUpdateProfile} size="sm" className="flex-1">SAVE</Button>
                <Button onClick={() => setIsEditing(false)} variant="outline" size="sm" className="flex-1">CANCEL</Button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex flex-col sm:flex-row items-center sm:items-baseline gap-2 sm:gap-4 mb-2">
                <h1 className="text-3xl sm:text-5xl font-bold tracking-tight leading-none text-white truncate max-w-full">{profileUser.name}</h1>
                <Badge variant="outline" className={`mt-2 sm:mt-0 ${getReputationBadge(profileUser.points).bg} ${getReputationBadge(profileUser.points).color} ${getReputationBadge(profileUser.points).border} text-xs font-bold px-3 py-1 rounded-full`}>
                  {getReputationBadge(profileUser.points).label}
                </Badge>
              </div>
              <p className="text-gray-400 max-w-lg font-medium text-sm leading-relaxed break-words">{profileUser.bio || "No biography provided."}</p>
            </>
          )}
          
          <div className="flex flex-wrap justify-center sm:justify-start gap-4 sm:gap-6 pt-6 mt-6 border-t border-white/10 w-full items-center">
            <div className="flex flex-col bg-white/5 px-4 py-2 rounded-xl border border-white/5">
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Trust Score</span>
              <span className="text-2xl font-bold text-primary flex items-baseline gap-1">{profileUser.points || 0} <span className="text-xs text-gray-500 font-medium">PTS</span></span>
            </div>
            <div className="flex flex-col bg-white/5 px-4 py-2 rounded-xl border border-white/5">
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Items Listed</span>
              <span className="text-2xl font-bold text-white">{userItems.length}</span>
            </div>
            <div className="flex flex-col bg-white/5 px-4 py-2 rounded-xl border border-white/5">
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Items Resolved</span>
              <span className="text-2xl font-bold text-emerald-400">{userItems.filter(i => i.status === 'RESOLVED').length}</span>
            </div>
            <div className="flex flex-col bg-white/5 px-4 py-2 rounded-xl border border-white/5 hidden sm:flex">
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Member Since</span>
              <span className="text-lg font-medium text-white">{profileUser.createdAt?.toDate ? format(profileUser.createdAt.toDate(), 'MM/yyyy') : 'N/A'}</span>
            </div>
            
            {isAdmin && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleResetPoints}
                className="border-red-500/50 text-red-400 hover:bg-red-500/20 hover:text-red-300 ml-auto"
              >
                Reset Points
              </Button>
            )}
          </div>
        </div>
      </div>
      
      <div>
        <h2 className="text-sm font-bold text-primary mb-6 uppercase tracking-widest flex items-center gap-2"><Trophy className="w-5 h-5"/> Registry Contributions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {userItems.length === 0 ? (
            <p className="text-sm font-medium text-gray-500 col-span-1 sm:col-span-2 text-center py-12 glass">No items reported yet.</p>
          ) : (
            userItems.map(item => (
              <Link to={`/item/${item.id}`} key={item.id} className="block group">
                <div className="glass glass-hover p-6 flex flex-col justify-between min-h-[220px]">
                  <div className="flex justify-between items-start gap-2 mb-4">
                     <Badge variant={item.type === 'LOST' ? 'destructive' : 'success'}>
                      {item.type}
                    </Badge>
                     <span className="text-xs font-medium text-gray-500 whitespace-nowrap">
                        {item.createdAt?.toDate ? format(item.createdAt.toDate(), 'MMM d, yy') : 'New'}
                     </span>
                  </div>
                  <div className="grow mb-4">
                    <h2 className="text-lg font-bold text-white mb-2 line-clamp-2 break-words leading-snug">{item.title}</h2>
                    <p className="text-xs text-gray-400 leading-relaxed line-clamp-2 break-words">
                       {item.description}
                    </p>
                  </div>
                  <div className="flex justify-between items-end border-t border-white/10 pt-4 shrink-0 mt-auto">
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Status</span>
                      <span className="text-xs font-semibold text-white">{item.status}</span>
                    </div>
                  </div>
                </div>
              </Link>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db, loginWithGoogle } from '../lib/firebase';
import { doc, getDoc, collection, query, where, getDocs, addDoc, serverTimestamp, updateDoc, increment } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Badge } from '../components/ui/Badge';
import { Skeleton } from '../components/ui/Skeleton';
import toast from 'react-hot-toast';


export function ItemDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [item, setItem] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  // Claims
  const [claims, setClaims] = useState<any[]>([]);
  const [myClaim, setMyClaim] = useState<any>(null);
  const [answer, setAnswer] = useState('');
  const [submittingClaim, setSubmittingClaim] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [isReporting, setIsReporting] = useState(false);
  
  const [localAttempts, setLocalAttempts] = useState(0);

  useEffect(() => {
    if (id && user) {
      setLocalAttempts(parseInt(localStorage.getItem(`attempts_${id}_${user.uid}`) || '0'));
    }
  }, [id, user]);

  useEffect(() => {
    async function fetchData() {
      if (!id || !user) return;
      try {
        const itemRef = doc(db, 'items', id);
        const itemSnap = await getDoc(itemRef);
        
        if (itemSnap.exists()) {
          const itemData = { id: itemSnap.id, ...itemSnap.data() } as any;
          setItem(itemData);
          
          // Fetch claims
          const claimsRef = collection(db, 'claims');
          if (itemData.ownerId === user.uid) {
            // I am the owner, fetch all claims for this item
            const q = query(claimsRef, where('ownerId', '==', user.uid));
            const claimsSnap = await getDocs(q);
            const itemClaims = claimsSnap.docs
              .map(d => ({ id: d.id, ...d.data() }))
              .filter((c: any) => c.itemId === id);
            setClaims(itemClaims);
          } else {
            // I am a potential claimant, fetch my claim
            const q = query(claimsRef, where('claimantId', '==', user.uid));
            const claimsSnap = await getDocs(q);
            const myItemClaim = claimsSnap.docs
              .map(d => ({ id: d.id, ...d.data() }))
              .find((c: any) => c.itemId === id);
              
            if (myItemClaim) {
              setMyClaim(myItemClaim);
            }
          }
        }
      } catch (err) {
        console.error("Failed to fetch data:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [id, user]);

  const handleSubmitClaim = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !item || submittingClaim) return;
    
    if (!user) {
      try {
        await loginWithGoogle();
        return;
      } catch (err: any) {
        if (err.code === 'auth/popup-closed-by-user' || err.code === 'auth/popup-blocked') {
          toast.error('Sign-in popup closed or blocked. Try opening the app in a new tab.');
        } else {
          toast.error('Failed to sign in. Please try opening in a new tab if issues persist.');
        }
        return;
      }
    }
    
    if (myClaim) return; // already claimed
    
    if (item.type === 'FOUND' && localAttempts >= 3) {
      toast.error('Max attempts reached');
      return;
    }
    
    setSubmittingClaim(true);
    const formattedAnswer = item.type === 'FOUND' ? answer.trim().toLowerCase() : '';
    
    try {
      if (item.type === 'LOST') {
         // Create chat immediately without pending approval
         const q = query(
           collection(db, 'chats'), 
           where('participant2Id', '==', user.uid)
         );
         const chatSnap = await getDocs(q);
         const existingChat = chatSnap.docs.find(d => 
           d.data().itemId === item.id && d.data().participant1Id === item.ownerId
         );
      
         if (!existingChat) {
           await addDoc(collection(db, 'chats'), {
             itemId: item.id,
             participant1Id: item.ownerId,
             participant2Id: user.uid,
             resolvedByOwner: false,
             resolvedByFinder: false,
             status: 'active',
             createdAt: serverTimestamp(),
             updatedAt: serverTimestamp()
           });
           
           // Keep claim record
           await addDoc(collection(db, 'claims'), {
             claimantId: user.uid,
             ownerId: item.ownerId,
             itemId: id,
             answer: formattedAnswer,
             status: 'APPROVED',
             attempts: 1,
             createdAt: serverTimestamp(),
             updatedAt: serverTimestamp()
           });

           await addDoc(collection(db, 'notifications'), {
             userId: item.ownerId,
             message: `${user.displayName || 'Someone'} has found your lost item "${item.title}"! A chat was initiated.`,
             itemId: id,
             read: false,
             createdAt: serverTimestamp()
           });
           
           // Removed updateDoc on items collection here because non-owners cannot modify it
         }
         
         toast.success('Chat initiated automatically.');
         navigate('/chats');
      } else {
        const newClaim = {
          claimantId: user.uid,
          ownerId: item.ownerId,
          itemId: id,
          answer: formattedAnswer,
          status: 'PENDING',
          attempts: localAttempts + 1,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        };
        const docRef = await addDoc(collection(db, 'claims'), newClaim);
        
        await addDoc(collection(db, 'notifications'), {
          userId: item.ownerId,
          message: `${user.displayName || 'Someone'} has requested to claim your item "${item.title}".`,
          itemId: id,
          read: false,
          createdAt: serverTimestamp()
        });

        setMyClaim({ id: docRef.id, ...newClaim });
        setAnswer('');
        if (item.type === 'FOUND') {
          toast.success('Answer correct! Claim request sent to the finder.');
        } else {
          toast.success('Contact request sent successfully!');
        }
      }
    } catch (err: any) {
      if (err.message && err.message.includes('Missing or insufficient permissions') && item.type === 'FOUND') {
        const newAttempts = localAttempts + 1;
        setLocalAttempts(newAttempts);
        localStorage.setItem(`attempts_${id}_${user.uid}`, newAttempts.toString());
        if (newAttempts >= 3) {
          toast.error('Incorrect answer. Max attempts reached.');
        } else {
          toast.error(`Incorrect answer. You have ${3 - newAttempts} attempts left.`);
        }
      } else {
        console.error(err);
        toast.error('Failed to submit request.');
      }
    } finally {
      setSubmittingClaim(false);
    }
  };

  const handleApproveClaim = async (claimId: string, claimantId: string) => {
    if (!item) return;
    try {
      // 1. Approve claim
      await updateDoc(doc(db, 'claims', claimId), {
        status: 'APPROVED',
        updatedAt: serverTimestamp()
      });
      // 2. Mark item as CLAIMED
      await updateDoc(doc(db, 'items', item.id), {
        status: 'CLAIMED',
        updatedAt: serverTimestamp()
      });
      // 3. Initiate Chat
      const q = query(
        collection(db, 'chats'), 
        where('participant1Id', '==', user.uid)
      );
      const chatSnap = await getDocs(q);
      const chatExists = chatSnap.docs.some(d => 
        d.data().itemId === item.id && d.data().participant2Id === claimantId
      );
      
      if (!chatExists) {
        await addDoc(collection(db, 'chats'), {
          itemId: item.id,
          participant1Id: item.ownerId,
          participant2Id: claimantId,
          resolvedByOwner: false,
          resolvedByFinder: false,
          status: 'active',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }
      
      // 4. Award owner points
      if (user?.uid) {
        await updateDoc(doc(db, 'users', user.uid), {
          points: increment(20),
          updatedAt: serverTimestamp()
        });
      }
      
      await addDoc(collection(db, 'notifications'), {
        userId: claimantId,
        message: `Your request for "${item.title}" was approved! A chat has been initiated.`,
        itemId: item.id,
        read: false,
        createdAt: serverTimestamp()
      });

      toast.success('Request Approved! You can now chat with the user.');
      navigate('/chats');
    } catch (e) {
      console.error(e);
      toast.error('Error approving request');
    }
  };

  const handleRejectClaim = async (claimId: string, claimantId: string) => {
    if (!item) return;
    try {
      await updateDoc(doc(db, 'claims', claimId), {
        status: 'REJECTED',
        updatedAt: serverTimestamp()
      });
      setClaims(claims.map(c => c.id === claimId ? { ...c, status: 'REJECTED' } : c));
      
      await addDoc(collection(db, 'notifications'), {
        userId: claimantId,
        message: `Your request for "${item.title}" was rejected.`,
        itemId: item.id,
        read: false,
        createdAt: serverTimestamp()
      });
      
      toast.success('Request rejected');
    } catch (e) {
      console.error(e);
      toast.error('Error rejecting request');
    }
  };

  const handleResolveItem = async () => {
    if (!item) return;
    try {
      await updateDoc(doc(db, 'items', item.id), {
        status: 'RESOLVED',
        updatedAt: serverTimestamp()
      });
      setItem({ ...item, status: 'RESOLVED' });
      toast.success('Item marked as resolved');
    } catch (e) {
      console.error(e);
      toast.error('Error resolving item');
    }
  };

  const handleReport = async () => {
    if (!item || !reportReason.trim()) return;
    
    if (!user) {
      try {
        await loginWithGoogle();
        return;
      } catch (err: any) {
        if (err.code === 'auth/popup-closed-by-user' || err.code === 'auth/popup-blocked') {
          toast.error('Sign-in popup closed or blocked. Try opening the app in a new tab.');
        } else {
          toast.error('Failed to sign in. Please try opening in a new tab if issues persist.');
        }
        return;
      }
    }
    
    setIsReporting(true);
    try {
      await addDoc(collection(db, 'reports'), {
        itemId: item.id,
        reportedBy: user.uid,
        reason: reportReason.trim(),
        createdAt: serverTimestamp()
      });
      toast.success('Report submitted successfully.');
      setShowReportModal(false);
      setReportReason('');
    } catch (error) {
      console.error(error);
      toast.error('Failed to submit report. Please try again.');
    } finally {
      setIsReporting(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8 py-10 w-full px-4 sm:px-6">
        <div className="lg:col-span-2 space-y-8 min-w-0">
          <div className="glass p-8 sm:p-10 flex flex-col items-start min-h-[400px]">
             <Skeleton className="h-8 w-24 mb-8" />
             <Skeleton className="h-12 sm:h-16 w-full max-w-xl mb-6" />
             <div className="space-y-3 w-full mb-10 flex-grow">
               <Skeleton className="h-4 w-full" />
               <Skeleton className="h-4 w-[90%]" />
               <Skeleton className="h-4 w-[85%]" />
             </div>
             <Skeleton className="w-full h-64 sm:h-96 mt-auto" />
          </div>
        </div>
        <div className="space-y-8 min-w-0">
          <div className="glass p-8 h-[300px]">
             <Skeleton className="h-4 w-1/2 mb-8" />
             <Skeleton className="h-12 w-full mb-4" />
             <Skeleton className="h-12 w-full" />
          </div>
        </div>
      </div>
    );
  }
  
  if (!item) return <div className="p-10 text-center text-red-500 font-bold uppercase tracking-widest bg-white/5 rounded-2xl glass mx-4">Item not found</div>;

  const isOwner = user?.uid === item.ownerId;
  const isExpired = item.status === 'OPEN' && item.createdAt && (Date.now() - item.createdAt.toMillis() > 7 * 24 * 60 * 60 * 1000);
  const displayStatus = isExpired ? 'EXPIRED' : item.status;

  return (
    <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8 py-10 w-full px-4 sm:px-6">
      <div className="lg:col-span-2 space-y-8 min-w-0">
        <div className="glass p-8 sm:p-10 flex flex-col items-start min-h-[400px] relative overflow-hidden">
          {isExpired && (
            <div className="absolute top-0 right-0 p-4">
              <span className="flex h-3 w-3 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500 shadow-[0_0_10px_rgba(220,38,38,0.8)]"></span>
              </span>
            </div>
          )}
          <div className="flex flex-wrap justify-between items-center w-full mb-8 gap-4">
            <div className="flex flex-wrap gap-2">
              <Badge variant={item.type === 'LOST' ? 'destructive' : 'success'}>{item.type}</Badge>
              {item.category && <Badge variant="secondary">{item.category}</Badge>}
            </div>
            <Badge variant="outline" className={`border-white/20 ${isExpired ? 'text-red-400 font-bold border-red-500/50 bg-red-500/10' : 'text-white'}`}>{displayStatus}</Badge>
          </div>
          <h1 className="text-3xl sm:text-5xl font-bold tracking-tight text-white mb-6 break-words w-full">{item.title}</h1>
          <p className="text-gray-300 font-medium leading-relaxed mb-10 flex-grow text-sm sm:text-base break-words w-full whitespace-pre-wrap">
            {item.description}
          </p>
          
          {item.imageUrl && (
            <div className="w-full mt-auto rounded-xl overflow-hidden shadow-2xl border border-white/10 relative group">
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <img src={item.imageUrl.replace('/upload/', '/upload/q_auto,f_auto/')} loading="lazy" alt={item.title} className="w-full h-auto object-contain max-h-[500px] bg-black/20" />
            </div>
          )}
        </div>

        {item.lat && item.lng && (
          <div className="glass p-8">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-[10px] font-bold tracking-widest text-primary uppercase">Last Known Location</h3>
              <a 
                href={`https://www.google.com/maps/search/?api=1&query=${item.lat},${item.lng}`} 
                target="_blank" 
                rel="noreferrer" 
                className="text-xs font-bold text-white bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded flex items-center gap-2"
              >
                Open in Maps
              </a>
            </div>
            <div className="h-64 sm:h-72 rounded-xl overflow-hidden z-0 relative shadow-inner border border-white/10 flex items-center justify-center bg-black/20">
              <a href={`https://www.google.com/maps/search/?api=1&query=${item.lat},${item.lng}`} target="_blank" rel="noreferrer" className="flex flex-col items-center gap-2 text-primary hover:text-white transition-colors cursor-pointer p-10 hover:bg-white/5 rounded-2xl">
                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
                <span className="text-sm font-bold tracking-wider">CLICK TO VIEW MAP</span>
              </a>
            </div>
          </div>
        )}

        {item.type === 'LOST' && item.pickupAddress && (
          <div className="glass p-8">
            <h3 className="text-[10px] font-bold tracking-widest text-primary mb-6 uppercase">Drop-off / Pickup instructions</h3>
            <div className="bg-white/5 border border-white/10 rounded-xl p-5 text-sm font-medium text-white shadow-inner">
              {item.pickupAddress}
            </div>
          </div>
        )}
      </div>

      <div className="space-y-8 min-w-0">
        <div className="glass p-8">
          <h3 className="text-[10px] font-bold tracking-widest text-primary mb-8 uppercase">Verification & Actions</h3>
          <div className="space-y-6">
            {isOwner ? (
              <div className="space-y-8">
                <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-xs font-semibold text-gray-300 text-center">
                  You are the owner of this post.
                </div>
                {item.status !== 'RESOLVED' && (
                  <Button variant="default" className="w-full bg-emerald-500 hover:bg-emerald-600 text-white shadow-[0_0_15px_rgba(16,185,129,0.3)] shadow-emerald-500/20" onClick={() => navigate('/chats')}>Double Confirm Resolution in Chats</Button>
                )}
                
                <div className="pt-8 border-t border-white/10">
                  <h3 className="text-[10px] font-bold tracking-widest text-primary mb-4 uppercase">Requests ({claims.length})</h3>
                  {claims.length === 0 ? (
                    <p className="text-xs text-gray-500 font-medium opacity-50">No requests yet.</p>
                  ) : (
                    <div className="space-y-4">
                      {claims.map(claim => (
                        <div key={claim.id} className="bg-white/5 border border-white/10 rounded-xl p-5 space-y-4 text-xs shadow-inner">
                          <div className="flex flex-wrap justify-between items-center gap-2 text-gray-400 font-semibold uppercase tracking-wider">
                            {item.type === 'FOUND' && <span className="text-[10px]">Attempt {claim.attempts}/3</span>}
                            <Badge variant={claim.status === 'PENDING' ? 'secondary' : claim.status === 'APPROVED' ? 'success' : 'destructive'} className="text-[9px] py-0 px-2">{claim.status}</Badge>
                          </div>
                          {item.type === 'FOUND' && claim.answer && (
                            <div className="bg-black/30 p-3 rounded-lg border border-white/5">
                              <p className="font-mono text-xs break-words text-white"><span className="text-primary mr-2">A:</span>{claim.answer}</p>
                            </div>
                          )}
                          
                          {claim.status === 'PENDING' && item.status === 'OPEN' && (
                            <div className="pt-2 flex flex-col sm:flex-row gap-2 mt-4">
                              <Button size="sm" variant="default" className="w-full flex-1" onClick={() => handleApproveClaim(claim.id, claim.claimantId)}>Verify</Button>
                              <Button size="sm" variant="destructive" className="w-full flex-1" onClick={() => handleRejectClaim(claim.id, claim.claimantId)}>Reject</Button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {item.status === 'RESOLVED' ? (
                  <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-xs font-semibold text-gray-300 text-center">
                    This item has been resolved.
                  </div>
                ) : item.status === 'CLAIMED' ? (
                   <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-xs font-semibold text-gray-300 text-center">
                    This item is already claimed.
                  </div>
                ) : (
                  <form onSubmit={handleSubmitClaim} className="space-y-6">
                    <p className="text-xs font-bold uppercase text-primary text-center mb-6 tracking-wider">
                      {item.type === 'FOUND' ? 'THIS IS MINE' : 'I FOUND THIS'}
                    </p>
                    
                    {item.type === 'FOUND' && item.securityQuestion && !myClaim && (
                      <>
                        <div className="bg-primary/10 border border-primary/20 rounded-xl p-5 text-sm font-medium text-white shadow-inner">
                          <span className="text-primary mr-2 font-bold">Q:</span>{item.securityQuestion}
                        </div>
                        <Input 
                          placeholder="ENTER ANSWER" 
                          value={answer}
                          onChange={e => setAnswer(e.target.value)}
                          required
                          className="bg-black/20"
                        />
                      </>
                    )}
                    
                    {!myClaim && item.type === 'FOUND' && (
                      <p className="text-[10px] tracking-widest font-mono text-gray-500 text-right mt-2 font-bold">
                        {localAttempts} / 3 ATTEMPTS
                      </p>
                    )}
                    
                    {item.type === 'FOUND' && localAttempts >= 3 && !myClaim ? (
                      <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-xs uppercase tracking-widest text-red-400 font-bold text-center">
                        Max attempts reached.
                      </div>
                    ) : myClaim ? (
                      <div className={`p-4 rounded-xl text-xs uppercase tracking-widest font-bold text-center border ${myClaim.status === 'APPROVED' ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400' : myClaim.status === 'REJECTED' ? 'bg-red-500/20 border-red-500/30 text-red-400' : 'bg-white/5 border-white/10 text-white'}`}>
                        Request {myClaim.status}
                      </div>
                    ) : (
                      <Button type="submit" variant="default" className="w-full py-6 mt-6 text-sm font-bold shadow-[0_0_15px_rgba(6,182,212,0.3)]" disabled={submittingClaim}>
                        {submittingClaim ? 'SUBMITTING...' : 'SUBMIT REQUEST'}
                      </Button>
                    )}
                  </form>
                )}
              </div>
            )}
          </div>
          
          {!isOwner && user && (
            <div className="pt-8 mt-8 border-t border-white/10 text-center">
              <Button variant="link" size="sm" className="text-gray-500 hover:text-red-400 text-xs" onClick={() => setShowReportModal(true)}>
                Report this post
              </Button>
            </div>
          )}
        </div>
      </div>

      {showReportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-white/10 rounded-2xl p-6 w-full max-w-md shadow-2xl animate-in fade-in zoom-in-95">
            <h3 className="text-lg font-bold text-white mb-2">Report Item</h3>
            <p className="text-sm text-gray-400 mb-6 font-medium">Please provide a reason for reporting this item (e.g. spam, fake, inappropriate).</p>
            <Input 
              value={reportReason}
              onChange={(e) => setReportReason(e.target.value)}
              placeholder="Reason for report..."
              className="mb-6 bg-black/20"
            />
            <div className="flex gap-4">
              <Button onClick={handleReport} disabled={!reportReason.trim() || isReporting} className="flex-1 bg-red-500 hover:bg-red-600 text-white">
                {isReporting ? 'Submitting...' : 'Submit Report'}
              </Button>
              <Button onClick={() => setShowReportModal(false)} variant="outline" className="flex-1 border-white/10">
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

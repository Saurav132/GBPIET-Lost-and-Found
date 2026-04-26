import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../lib/firebase';
import { collection, addDoc, serverTimestamp, doc, updateDoc, increment, setDoc, query, where, getDocs } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { MapPin, Loader2, ImagePlus, Navigation } from 'lucide-react';
import toast from 'react-hot-toast';

const CATEGORIES = [
  'Electronics', 'Wallets/ID/Cards', 'Keys', 'Bags/Backpacks', 'Clothing/Accessories', 'Books/Notes', 'Other'
];

export function PostItem() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [type, setType] = useState<'LOST' | 'FOUND'>('LOST');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [securityQuestion, setSecurityQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  
  const [pickupAddress, setPickupAddress] = useState('');

  const uploadImage = async (file: File): Promise<string> => {
    const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
    const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

    if (!cloudName || !uploadPreset || cloudName === 'demo') {
      console.warn("Cloudinary not configured. Generating un-uploaded data URI.");
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', uploadPreset);

    const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
      method: 'POST',
      body: formData
    });
    
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      const errorMsg = errorData?.error?.message || res.statusText;
      throw new Error(`Cloudinary error: ${errorMsg}`);
    }
    
    const data = await res.json();
    return data.secure_url;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!title || !description) return toast.error("Title and description are required.");
    
    if (type === 'FOUND' && !imageFile) {
      return toast.error("For FOUND items, providing an image as proof is REQUIRED.");
    }
    if (type === 'FOUND' && (!securityQuestion || !answer)) {
      return toast.error("For FOUND items, a security question and answer are REQUIRED.");
    }

    setLoading(true);
    toast.loading("Checking for duplicate entries...", { id: "publish-toast" });

    try {
      // Prevent duplicate posts
      const q = query(
        collection(db, 'items'),
        where('ownerId', '==', user.uid),
        where('status', '==', 'OPEN'),
        where('title', '==', title)
      );
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        toast.dismiss("publish-toast");
        toast.error("You already have an open report with this title.");
        setLoading(false);
        return;
      }

      toast.loading("Publishing registry item...", { id: "publish-toast" });

      let imageUrl = '';
      if (imageFile) {
        imageUrl = await uploadImage(imageFile);
      }

      const itemData: any = {
        type,
        title,
        description,
        category,
        status: 'OPEN',
        ownerId: user.uid,
        createdAt: serverTimestamp(),
      };

      if (imageUrl) itemData.imageUrl = imageUrl;
      
      if (type === 'FOUND') {
        if (securityQuestion) itemData.securityQuestion = securityQuestion;
      } else {
        if (pickupAddress) {
          itemData.pickupAddress = pickupAddress;
        }
      }

      const docRef = await addDoc(collection(db, 'items'), itemData);
      
      // Global Notification Broadcast
      try {
        await addDoc(collection(db, 'notifications'), {
          type: 'NEW_POST',
          message: `New ${type} item posted: ${title}`,
          itemId: docRef.id,
          createdAt: serverTimestamp()
        });
      } catch (err) {
        console.error("Failed to broadcast global notification", err);
      }
      
      if (type === 'FOUND' && answer) {
        await setDoc(doc(db, 'itemAnswers', docRef.id), {
          answer: answer.trim().toLowerCase(),
          createdAt: serverTimestamp()
        });
        
        // Notification logic for matching LOST items
        try {
          const matchQ = query(
            collection(db, 'items'),
            where('type', '==', 'LOST'),
            where('category', '==', category),
            where('status', '==', 'OPEN')
          );
          const matchSnapshot = await getDocs(matchQ);
          const notifiedOwnerIds = new Set<string>();
          
          for (const docSnap of matchSnapshot.docs) {
            const lostItem = docSnap.data();
            // simple check: if any word in the title matches
            const titleWords = title.toLowerCase().split(' ');
            const lostTitle = lostItem.title.toLowerCase();
            const hasMatch = titleWords.some(w => w.length > 3 && lostTitle.includes(w));
            
            if ((hasMatch || matchSnapshot.docs.length < 5) && !notifiedOwnerIds.has(lostItem.ownerId) && lostItem.ownerId !== user.uid) {
              notifiedOwnerIds.add(lostItem.ownerId);
              await addDoc(collection(db, 'notifications'), {
                userId: lostItem.ownerId,
                message: `Someone found a "${title}" in ${category} that might match your lost item.`,
                itemId: docRef.id,
                read: false,
                createdAt: serverTimestamp()
              });
            }
          }
        } catch (e) {
          console.error("Match notification error", e);
        }
      }
      
      // Award points for posting an item
      await updateDoc(doc(db, 'users', user.uid), {
        points: increment(10),
        updatedAt: serverTimestamp()
      });
      
      toast.success("Item successfully listed!", { id: "publish-toast" });
      navigate(`/item/${docRef.id}`);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to post item.", { id: "publish-toast" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto py-6 sm:py-12 w-full px-4">
      <Card className="glass relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1/2 bg-gradient-to-b from-primary/10 to-transparent z-0 opacity-50"></div>
        <CardHeader className="pb-4 relative z-10 text-center border-b border-white/5">
          <CardTitle className="text-2xl sm:text-3xl lg:text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-blue-400">FILE A REPORT</CardTitle>
          <p className="text-center text-[10px] sm:text-xs font-semibold tracking-widest text-primary/80 uppercase mt-2">Enter details below</p>
        </CardHeader>
        <CardContent className="relative z-10 pt-6 sm:pt-8">
          <form id="post-form" onSubmit={handleSubmit} className="space-y-6 sm:space-y-8">
            <div className="flex gap-4">
              <Button 
                type="button"
                variant={type === 'LOST' ? 'destructive' : 'outline'}
                className="w-full text-xs font-bold py-3 h-auto"
                onClick={() => setType('LOST')}
              >
                LOST ITEM
              </Button>
              <Button 
                type="button"
                variant={type === 'FOUND' ? 'default' : 'outline'}
                className="w-full text-xs font-bold py-3 h-auto"
                onClick={() => setType('FOUND')}
              >
                FOUND ITEM
              </Button>
            </div>

            <div className="space-y-3">
              <label className="text-[10px] sm:text-xs font-semibold text-gray-400 uppercase tracking-wider ml-1">Category</label>
              <select 
                className="flex w-full bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl px-4 py-3 text-sm font-medium text-white transition-all shadow-inner focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 appearance-none"
                value={category}
                onChange={e => setCategory(e.target.value)}
              >
                <option value="" disabled className="bg-slate-900 text-gray-500">Select Category</option>
                {CATEGORIES.map(cat => (
                  <option key={cat} value={cat} className="bg-slate-800 text-white">{cat}</option>
                ))}
              </select>
            </div>

            <div className="space-y-3">
              <label className="text-[10px] sm:text-xs font-semibold text-gray-400 uppercase tracking-wider ml-1">Title</label>
              <Input 
                value={title} 
                onChange={e => setTitle(e.target.value)} 
                placeholder="e.g., Blue Dell Laptop" 
                maxLength={200}
                required 
              />
            </div>

            <div className="space-y-3">
              <label className="text-[10px] sm:text-xs font-semibold text-gray-400 uppercase tracking-wider ml-1">Description</label>
              <textarea 
                className="flex min-h-[120px] sm:min-h-[140px] w-full bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl px-4 py-3 text-sm font-medium text-white transition-all shadow-inner hover:bg-white/10 focus:bg-white/10 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-gray-500 disabled:cursor-not-allowed disabled:opacity-50 resize-y"
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Provide detailed information..."
                maxLength={2000}
                required
              />
            </div>

            {type === 'FOUND' && (
              <div className="glass p-4 sm:p-6 bg-primary/5 border-primary/20 space-y-6 rounded-xl">
                <div className="space-y-3">
                  <div>
                    <label className="block text-[10px] sm:text-xs font-semibold text-primary uppercase tracking-wider ml-1">Security Question (Required)*</label>
                    <p className="text-[10px] text-gray-400 font-medium ml-1 mt-1">Ask a question only the true owner would know.</p>
                  </div>
                  <Input 
                    value={securityQuestion} 
                    onChange={e => setSecurityQuestion(e.target.value)} 
                    placeholder="e.g., What color is the lining?" 
                    maxLength={500}
                    required={type === 'FOUND'}
                    className="border-primary/30"
                  />
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="block text-[10px] sm:text-xs font-semibold text-primary uppercase tracking-wider ml-1">Security Answer (Required)*</label>
                    <p className="text-[10px] text-gray-400 font-medium ml-1 mt-1">This will be verified automatically when someone claims.</p>
                  </div>
                  <Input 
                    value={answer} 
                    onChange={e => setAnswer(e.target.value)} 
                    placeholder="e.g., Red" 
                    maxLength={100}
                    required={type === 'FOUND'}
                    className="border-primary/30"
                  />
                </div>
              </div>
            )}

            <div className="space-y-3">
              <label className="text-[10px] sm:text-xs font-semibold text-gray-400 uppercase tracking-wider ml-1">Image Evidence {type === 'FOUND' && "(Required)*"}</label>
              <div className="flex bg-white/5 border border-white/10 rounded-xl p-2 items-center gap-4 overflow-hidden">
                <Input 
                  type="file" 
                  accept="image/*"
                  capture={type === 'FOUND' ? 'environment' : undefined}
                  onChange={e => setImageFile(e.target.files?.[0] || null)}
                  required={type === 'FOUND'}
                  className="cursor-pointer file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 bg-transparent border-none shadow-none flex-1 font-medium text-gray-300 w-full"
                />
                {imageFile && <span className="text-xs font-bold text-success truncate max-w-[100px] shrink-0 mr-2">{imageFile.name}</span>}
              </div>
            </div>

            {type === 'FOUND' ? null : (
              <div className="space-y-3">
                <label className="text-[10px] sm:text-xs font-semibold text-gray-400 uppercase tracking-wider ml-1">Pickup Address (Optional)</label>
                <Input 
                  value={pickupAddress} 
                  onChange={e => setPickupAddress(e.target.value)} 
                  placeholder="e.g., Main Office, Library Desk" 
                  maxLength={200}
                />
              </div>
            )}
            
          </form>
        </CardContent>
        <CardFooter className="flex justify-end gap-3 mt-4 pt-6 border-t border-white/5 relative z-10 p-4 sm:p-6">
          <Button variant="ghost" onClick={() => navigate(-1)} disabled={loading} className="text-gray-400 hover:text-white">Cancel</Button>
          <Button type="submit" form="post-form" disabled={loading} className="font-bold shadow-[0_0_15px_rgba(6,182,212,0.4)]">
            {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> SAVING...</> : "SUBMIT REPORT"}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

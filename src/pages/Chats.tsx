import React, { useEffect, useState, useRef } from 'react';
import { db } from '../lib/firebase';
import { collection, query, where, getDocs, onSnapshot, addDoc, serverTimestamp, orderBy, getDoc, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { Send, Image as ImageIcon, CheckCircle, CheckCircle2, Trash2, X, MapPin } from 'lucide-react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';

const uploadImage = async (file: File): Promise<string> => {
  const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
  const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

  if (!cloudName || !uploadPreset || cloudName === 'demo') {
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
    body: formData,
  });

  if (!res.ok) {
    throw new Error('Image upload failed');
  }

  const data = await res.json();
  return data.secure_url;
};

export function Chats() {
  const { user } = useAuth();
  const [chats, setChats] = useState<any[]>([]);
  const [activeChat, setActiveChat] = useState<any | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [usersMap, setUsersMap] = useState<Record<string, any>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  
  useEffect(() => {
    if (!user) return;
    
    const fetchChats = async () => {
      const p1Query = query(collection(db, 'chats'), where('participant1Id', '==', user.uid));
      const p2Query = query(collection(db, 'chats'), where('participant2Id', '==', user.uid));
      
      const [p1Snap, p2Snap] = await Promise.all([getDocs(p1Query), getDocs(p2Query)]);
      const allChats = [...p1Snap.docs, ...p2Snap.docs].map(d => ({ id: d.id, ...d.data() } as any));
      
      setChats(allChats);
      
      // Fetch user details for all participants
      const userIds = new Set<string>();
      allChats.forEach((c: any) => {
        userIds.add(c.participant1Id);
        userIds.add(c.participant2Id);
      });
      
      const uMap: Record<string, any> = {};
      for (const uid of userIds) {
        if (!uMap[uid]) {
           try {
             const uSnap = await getDoc(doc(db, 'users', uid));
             if (uSnap.exists()) {
               uMap[uid] = uSnap.data();
             }
           } catch(e) {}
        }
      }
      setUsersMap(uMap);
    };
    fetchChats();
  }, [user]);

  useEffect(() => {
    if (!activeChat || !user) return;
    
    // Subscribe to active chat itself to get realtime updates on resolution status
    const chatUnsub = onSnapshot(doc(db, 'chats', activeChat.id), (docSnap) => {
      if (docSnap.exists()) {
        setActiveChat({ id: docSnap.id, ...docSnap.data() });
      } else {
        // Chat was deleted
        setChats(prev => prev.filter(c => c.id !== activeChat.id));
        setActiveChat(null);
        toast("This chat has been deleted.");
      }
    }, (error) => {
      // Ignorable error due to activeChat being deleted or access revoked
      if (error instanceof Error && error.message.includes('Missing or insufficient permissions')) {
        setChats(prev => prev.filter(c => c.id !== activeChat.id));
        setActiveChat(null);
        toast("This chat has been removed.");
      } else {
        console.error("Chat listener error:", error);
      }
    });

    const messagesRef = collection(db, `chats/${activeChat.id}/messages`);
    const q = query(messagesRef, orderBy('createdAt', 'asc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setMessages(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    }, (error) => {
      if (error instanceof Error && error.message.includes('Missing or insufficient permissions')) {
        // Ignorable error due to activeChat being deleted
      } else {
        console.error(error);
      }
    });
    
    return () => {
      unsubscribe();
      chatUnsub();
    };
  }, [activeChat?.id, user]);

  const handleShareLocation = () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported by your browser.');
      return;
    }
    
    toast('Fetching location...', { icon: '📍' });
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        const text = `[LOCATION_SHARE]:${latitude},${longitude}`;
        
        try {
          await addDoc(collection(db, `chats/${activeChat?.id}/messages`), {
            chatId: activeChat?.id,
            participant1Id: activeChat?.participant1Id,
            participant2Id: activeChat?.participant2Id,
            senderId: user?.uid,
            text,
            createdAt: serverTimestamp()
          });
          toast.success('Location shared!');
        } catch (err) {
          console.error(err);
          toast.error('Failed to share location');
        }
      },
      (error) => {
        console.error(error);
        toast.error('Unable to retrieve your location. Please check permissions.');
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0
      }
    );
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeChat || !user || (!newMessage.trim() && !imageFile)) return;
    if (uploading) return;
    
    const text = newMessage;
    setNewMessage('');
    const fileToUpload = imageFile;
    setImageFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    
    setUploading(true);
    let imageUrl = '';
    try {
      if (fileToUpload) {
        imageUrl = await uploadImage(fileToUpload);
      }
      
      await addDoc(collection(db, `chats/${activeChat.id}/messages`), {
        chatId: activeChat.id,
        participant1Id: activeChat.participant1Id,
        participant2Id: activeChat.participant2Id,
        senderId: user.uid,
        text,
        imageUrl,
        createdAt: serverTimestamp()
      });
    } catch (err) {
      console.error(err);
      toast.error('Failed to send message');
    } finally {
      setUploading(false);
    }
  };

  const handleResolveConfirm = async () => {
    if (!activeChat || !user) return;
    try {
      const isOwner = user.uid === activeChat.participant1Id;
      const updateData: any = { updatedAt: serverTimestamp() };
      
      if (isOwner) updateData.resolvedByOwner = true;
      else updateData.resolvedByFinder = true;
      
      await updateDoc(doc(db, 'chats', activeChat.id), updateData);
      toast.success('Confirmed resolution');
      
      // If both confirmed, mark as resolved
      const updatedChat = (await getDoc(doc(db, 'chats', activeChat.id))).data();
      if (updatedChat?.resolvedByOwner && updatedChat?.resolvedByFinder) {
         await updateDoc(doc(db, 'chats', activeChat.id), { status: 'resolved', updatedAt: serverTimestamp() });
         // Update Item
         try {
           await updateDoc(doc(db, 'items', activeChat.itemId), { 
             status: 'RESOLVED',
             updatedAt: serverTimestamp() 
           });
         } catch (e) {
           // If the finder confirms last, they won't have permission to update the item. 
           // That's fine, the chat is marked resolved securely. 
           console.log("Could not update item state directly gracefully");
         }
         toast.success('Item fully resolved!');
      }
    } catch (err) {
      console.error(err);
      toast.error('Error confirming resolution');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setImageFile(e.target.files[0]);
    }
  };

  const handleDeleteChat = async () => {
    if (!activeChat || !user) return;
    try {
      const messagesRef = collection(db, 'chats', activeChat.id, 'messages');
      const messagesSnap = await getDocs(query(messagesRef));
      for (const msg of messagesSnap.docs) {
        await deleteDoc(doc(db, 'chats', activeChat.id, 'messages', msg.id));
      }
      await deleteDoc(doc(db, 'chats', activeChat.id));
      setChats(prev => prev.filter(c => c.id !== activeChat.id));
      toast.success("Chat deleted successfully.");
      setActiveChat(null);
      setShowDeleteConfirm(false);
    } catch (err) {
      console.error(err);
      toast.error("Failed to delete chat. Ensure you have permission.");
    }
  };

  if (!user) return <div className="text-center py-20">Login required</div>;

  return (
    <div className="h-[80vh] md:h-[85vh] flex flex-col md:flex-row overflow-hidden border-0 sm:border sm:border-white/10 glass max-w-7xl mx-auto sm:my-10 w-full sm:rounded-2xl shadow-2xl p-0">
      
      {/* Sidebar - Chat List */}
      <div className={`${activeChat ? 'hidden md:flex' : 'flex'} flex-col w-full md:w-1/3 lg:w-1/4 border-r-0 md:border-r border-white/10 overflow-y-auto bg-slate-900/50 h-full`}>
        <div className="p-5 border-b border-white/10 bg-black/20 sticky top-0 flex items-center justify-between z-10 backdrop-blur-md shrink-0">
           <span className="text-xs font-bold uppercase tracking-widest text-primary">Your Conversations</span>
        </div>
        <div className="flex-1 overflow-y-auto w-full">
          {chats.length === 0 ? (
            <div className="p-10 text-center text-sm font-medium text-gray-500 opacity-80">No conversations yet.</div>
          ) : (
            chats.map(chat => {
              const otherParticipantId = chat.participant1Id === user?.uid ? chat.participant2Id : chat.participant1Id;
              const otherUser = usersMap[otherParticipantId] || {};
              
              return (
              <button 
                key={chat.id} 
                onClick={() => setActiveChat(chat)}
                className={`w-full flex items-center text-left p-4 sm:p-5 border-b border-white/5 transition-all group ${activeChat?.id === chat.id ? 'bg-primary/20 border-primary/50 text-white' : 'hover:bg-white/5 text-gray-300'}`}
              >
                <div className="w-12 h-12 rounded-full overflow-hidden shrink-0 border border-white/20 mr-4">
                   {otherUser.photoURL ? (
                      <img src={otherUser.photoURL} alt="avatar" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                   ) : (
                      <div className="w-full h-full bg-white/10 flex items-center justify-center font-bold uppercase">
                         {otherUser.name ? otherUser.name.charAt(0) : '?'}
                      </div>
                   )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold tracking-tight mb-1 truncate">{otherUser.name || 'Unknown User'}</div>
                  <div className="text-[10px] font-medium text-gray-500 truncate">Item Ref: <span className="font-mono text-primary/70">{chat.itemId}</span></div>
                  {chat.status === 'resolved' && <div className="text-[10px] text-emerald-400 font-bold uppercase mt-1 tracking-widest">Resolved</div>}
                </div>
              </button>
            )})
          )}
        </div>
      </div>
      
      {/* Main Chat Area */}
      <div className={`${!activeChat ? 'hidden md:flex' : 'flex'} flex-1 flex-col relative h-full bg-slate-900/40 w-full`}>
        {activeChat ? (
          <>
            <div className="py-3 px-4 sm:py-4 sm:px-6 border-b border-white/10 flex flex-wrap gap-2 sm:gap-4 justify-between items-center bg-black/20 z-10 sticky top-0 backdrop-blur-md shrink-0">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <button 
                  onClick={() => setActiveChat(null)}
                  className="md:hidden p-2 -ml-2 rounded-lg bg-white/5 hover:bg-white/10 text-white"
                >
                  <X className="w-5 h-5" />
                </button>
                <div className="flex flex-col min-w-0">
                  <span className="text-sm font-bold text-white mb-1 truncate">
                    {usersMap[activeChat.participant1Id === user?.uid ? activeChat.participant2Id : activeChat.participant1Id]?.name || 'Unknown User'}
                  </span>
                  <span className="text-[10px] text-primary font-mono tracking-widest uppercase">Verified Connection</span>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 items-center">
                <Link to={`/item/${activeChat.itemId}`}>
                  <Button variant="outline" size="sm" className="text-[10px] h-8 bg-white/5 border-white/10 px-2 sm:px-3">Info</Button>
                </Link>
                {activeChat.status !== 'resolved' && (
                  <Button 
                    size="sm" 
                    variant={
                      (user?.uid === activeChat.participant1Id && activeChat.resolvedByOwner) ||
                      (user?.uid === activeChat.participant2Id && activeChat.resolvedByFinder)
                      ? "outline" : "default"
                    }
                    className={`h-8 text-[10px] font-bold tracking-wider ${
                      ((user?.uid === activeChat.participant1Id && activeChat.resolvedByOwner) ||
                      (user?.uid === activeChat.participant2Id && activeChat.resolvedByFinder))
                      ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" : "bg-emerald-500 hover:bg-emerald-600 text-white"
                    }`}
                    onClick={handleResolveConfirm}
                  >
                    {((user?.uid === activeChat.participant1Id && activeChat.resolvedByOwner) ||
                      (user?.uid === activeChat.participant2Id && activeChat.resolvedByFinder)) ? (
                        <><CheckCircle className="w-3 h-3 mr-1" /> Confirmed</>
                      ) : "Confirm Resolution"}
                  </Button>
                )}
                {activeChat.status === 'resolved' && (
                  <div className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-3 py-1.5 rounded-lg flex items-center text-[10px] font-bold tracking-widest uppercase">
                    <CheckCircle2 className="w-3 h-3 mr-1" /> Resolved
                  </div>
                )}
                {showDeleteConfirm ? (
                  <div className="flex items-center gap-2 bg-red-950/40 border border-red-500/50 rounded-md p-1 px-2 ml-2">
                    <span className="text-[10px] text-red-300">Are you sure?</span>
                    <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-white hover:text-white hover:bg-white/10" onClick={() => setShowDeleteConfirm(false)}>
                       <X className="w-3 h-3" />
                    </Button>
                    <Button size="sm" variant="ghost" className="h-6 px-2 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/20" onClick={handleDeleteChat}>
                       Confirm
                    </Button>
                  </div>
                ) : (
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={() => setShowDeleteConfirm(true)}
                    className="h-8 border-red-500/30 text-red-400 hover:bg-red-500/20 hover:text-red-300 ml-2"
                    title="Delete Chat"
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                )}
              </div>
            </div>
            
            {(activeChat.status === 'active' && (!activeChat.resolvedByOwner || !activeChat.resolvedByFinder) && (activeChat.resolvedByOwner || activeChat.resolvedByFinder)) && (
               <div className="bg-yellow-500/20 border-b border-yellow-500/30 px-6 py-3 text-xs font-medium text-yellow-200 text-center flex items-center justify-center gap-2">
                 <CheckCircle className="w-4 h-4" /> One party has confirmed resolution. Waiting for the other.
               </div>
            )}
            
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {messages.map((msg, idx) => {
                const isMe = msg.senderId === user?.uid;
                const showAvatar = !isMe && (idx === 0 || messages[idx - 1].senderId !== msg.senderId);
                const showMyAvatar = isMe && (idx === messages.length - 1 || messages[idx + 1].senderId !== msg.senderId);
                const sender = isMe ? { ...usersMap[msg.senderId], photoURL: user?.photoURL || usersMap[msg.senderId]?.photoURL, name: user?.displayName || usersMap[msg.senderId]?.name } : usersMap[msg.senderId] || {};
                
                return (
                  <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'} w-full group`}>
                    <div className={`flex items-end gap-2 max-w-[85%] ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                      {/* Avatar */}
                      <div className={`w-8 h-8 rounded-full overflow-hidden shrink-0 border border-white/10 ${!isMe && !showAvatar ? 'invisible' : ''} ${isMe && !showMyAvatar ? 'invisible' : ''}`}>
                         {sender.photoURL ? (
                            <img src={sender.photoURL} alt="avatar" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                         ) : (
                            <div className="w-full h-full bg-white/10 flex items-center justify-center text-[10px] font-bold uppercase text-white">
                               {sender.name ? sender.name.charAt(0) : '?'}
                            </div>
                         )}
                      </div>
                      
                      <div className="flex flex-col gap-1">
                        {/* Name label if not me and first in seq */}
                        {showAvatar && (
                           <div className="text-[10px] font-bold tracking-wider text-gray-500 uppercase ml-1">
                             {sender.name || 'Unknown'}
                           </div>
                        )}
                        <div className={`p-4 rounded-2xl text-sm font-medium leading-relaxed shadow-lg break-words space-y-2
                           ${isMe ? 'bg-gradient-to-br from-primary to-blue-600 text-white shadow-[0_0_15px_rgba(6,182,212,0.2)] rounded-br-none' 
                                  : 'bg-white/10 border border-white/10 text-gray-200 rounded-bl-none'}`}
                        >
                          {msg.imageUrl && (
                            <div className="relative rounded-lg overflow-hidden border border-white/10 mb-2">
                               <img src={msg.imageUrl} alt="attached" className="max-w-full sm:max-w-xs h-auto object-cover" referrerPolicy="no-referrer" />
                            </div>
                          )}
                          {msg.text && (
                            msg.text.startsWith('[LOCATION_SHARE]:') ? (
                              <div className="flex flex-col items-center p-2 bg-black/20 rounded-lg">
                                <a href={`https://www.google.com/maps?q=${msg.text.split(':')[1]}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-primary font-bold hover:underline">
                                  <MapPin className="w-4 h-4" /> View Shared Location
                                </a>
                              </div>
                            ) : (
                              <div>{msg.text}</div>
                            )
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>
            
            <form onSubmit={handleSendMessage} className="p-4 sm:p-6 border-t border-white/10 flex flex-col gap-3 mt-auto shrink-0 bg-black/30 backdrop-blur-md">
              {imageFile && (
                <div className="flex items-center gap-2 bg-primary/20 text-primary-200 border border-primary/30 p-2 rounded-lg text-xs w-max">
                  <ImageIcon className="w-4 h-4" />
                  <span className="truncate max-w-[200px]">{imageFile.name}</span>
                  <button type="button" onClick={() => setImageFile(null)} className="ml-2 text-primary hover:text-white">&times;</button>
                </div>
              )}
              <div className="flex gap-3 items-center">
                  <div className="relative shrink-0">
                    <input 
                      type="file" 
                      accept="image/*"
                      ref={fileInputRef}
                      onChange={handleFileChange}
                      className="hidden" 
                      id="chat-image-upload" 
                      disabled={uploading || activeChat.status === 'resolved'}
                    />
                    <label 
                      htmlFor="chat-image-upload"
                      className={`cursor-pointer w-10 h-10 rounded-xl flex items-center justify-center transition-colors
                         ${(uploading || activeChat.status === 'resolved') ? 'bg-white/5 text-gray-500 cursor-not-allowed' : 'bg-white/10 hover:bg-white/20 text-gray-300'}`}
                    >
                      <ImageIcon className="w-5 h-5" />
                    </label>
                  </div>

                  <button
                    type="button"
                    title="Share Location"
                    onClick={handleShareLocation}
                    disabled={uploading || activeChat.status === 'resolved'}
                    className={`shrink-0 w-10 h-10 rounded-xl flex items-center justify-center transition-colors
                       ${(uploading || activeChat.status === 'resolved') ? 'bg-white/5 text-gray-500 cursor-not-allowed' : 'bg-white/10 hover:bg-white/20 text-primary'}`}
                  >
                    <MapPin className="w-5 h-5" />
                  </button>
                  
                  <Input 
                    value={newMessage} 
                    onChange={e => setNewMessage(e.target.value)} 
                    placeholder={activeChat.status === 'resolved' ? "Chat is resolved." : "Type a message..."} 
                    className="flex-1 rounded-xl glass border border-white/10 bg-white/5"
                    disabled={uploading || activeChat.status === 'resolved'}
                  />
                  
                  <Button type="submit" variant="default" className="rounded-xl shadow-[0_0_15px_rgba(6,182,212,0.4)] px-6" disabled={uploading || (!newMessage.trim() && !imageFile) || activeChat.status === 'resolved'}>
                     <Send className="w-5 h-5 mr-0 sm:mr-2" />
                     <span className="hidden sm:inline">{uploading ? 'Sending...' : 'Send'}</span>
                  </Button>
              </div>
            </form>
          </>
        ) : (
          <div className="flex items-center justify-center h-full text-[10px] tracking-[0.3em] font-medium uppercase text-muted-foreground p-10 text-center opacity-50">
            Select a conversation to initialize session.
          </div>
        )}
      </div>
    </div>
  );
}

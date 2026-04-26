import React, { createContext, useContext, useEffect, useState } from 'react';
import { User as FirebaseUser, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';

interface AuthContextType {
  user: FirebaseUser | null;
  userData: any | null;
  loading: boolean;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType>({ user: null, userData: null, loading: true, isAdmin: false });

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [userData, setUserData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribeUserData: () => void;

    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const userRef = doc(db, 'users', firebaseUser.uid);
        
        // Initial setup if not exists
        const userSnap = await getDoc(userRef);
        if (!userSnap.exists()) {
          try {
            await setDoc(userRef, {
              name: firebaseUser.displayName || 'Anonymous User',
              email: firebaseUser.email,
              photoURL: firebaseUser.photoURL || '',
              points: 0,
              role: 'USER',
              createdAt: serverTimestamp()
            });
          } catch (e) {
            console.error('Error creating user profile', e);
          }
        } else {
          // Check for restriction
          const data = userSnap.data();
          if (data?.isRestricted) {
            await auth.signOut();
            setUser(null);
            setUserData(null);
            setLoading(false);
            return;
          }
        }

        setUser(firebaseUser);

        // Listen for real-time updates
        unsubscribeUserData = onSnapshot(userRef, (snapshot) => {
          if (snapshot.exists()) {
            const data = snapshot.data();
            if (data?.isRestricted) {
              auth.signOut();
              setUser(null);
              setUserData(null);
              return;
            }
            setUserData(data);
          }
        });
      } else {
        setUser(null);
        setUserData(null);
        if (unsubscribeUserData) {
          unsubscribeUserData();
        }
      }
      setLoading(false);
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeUserData) unsubscribeUserData();
    };
  }, []);

  const isAdmin = user?.email === 'sauravdhapola04@gmail.com' || user?.email === 'sauravdhapola17@gmail.com' || userData?.role === 'ADMIN';

  return (
    <AuthContext.Provider value={{ user, userData, loading, isAdmin }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);

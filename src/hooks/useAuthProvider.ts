import { useEffect } from 'react';
import { useAuthStore } from '../store/useAuthStore';
import { onAuthStateChange } from '../utils/firebaseUtils';

export function useAuthProvider() {
  const { setUser, setLoading, isSigningUp } = useAuthStore();

  console.log('🚨 AUTH PROVIDER: Hook called - setting up effect');

  useEffect(() => {
    console.log('🔄 AUTH PROVIDER: Setting up auth state listener');
    
    const unsubscribe = onAuthStateChange((user) => {
      console.log('🔄 AUTH STATE CHANGE:', {
        user: user ? {
          uid: user.uid,
          email: user.email,
          emailVerified: user.emailVerified,
          displayName: user.displayName
        } : null,
        isSigningUp,
        timestamp: new Date().toISOString()
      });
      
      // During signup, we expect the user to be signed out after verification email is sent
      // So we ignore unverified users during the signup process
      if (isSigningUp && user && !user.emailVerified) {
        console.log('🔄 AUTH PROVIDER: Ignoring unverified user during signup process');
        setLoading(false);
        return;
      }
      
      // Normal flow: only set verified users
      if (user && !user.emailVerified) {
        console.log('🔄 AUTH PROVIDER: User not verified, not setting in store');
        setUser(null);
      } else {
        setUser(user);
      }
      
      setLoading(false);
      
      console.log('✅ AUTH PROVIDER: Updated store with user:', user ? `${user.email} (verified: ${user.emailVerified})` : 'null');
    });

    return () => {
      console.log('🔄 AUTH PROVIDER: Cleaning up auth listener');
      unsubscribe();
    };
  }, [setUser, setLoading, isSigningUp]);
}
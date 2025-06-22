import { create } from 'zustand';
import type { User } from 'firebase/auth';

interface AuthState {
  user: User | null;
  loading: boolean;
  isSigningUp: boolean;
  setUser: (user: User | null) => void;
  setLoading: (loading: boolean) => void;
  setIsSigningUp: (isSigningUp: boolean) => void;
}

export const useAuthStore = create<AuthState>((set) => {
  console.log('🚨 AUTH STORE: Store created/accessed');
  
  return {
    user: null,
    loading: true,
    isSigningUp: false,
    setUser: (user) => {
      console.log('🏪 AUTH STORE: Setting user:', user ? `${user.email} (verified: ${user.emailVerified})` : 'null');
      set({ user });
    },
    setLoading: (loading) => {
      console.log('🏪 AUTH STORE: Setting loading:', loading);
      set({ loading });
    },
    setIsSigningUp: (isSigningUp) => {
      console.log('🏪 AUTH STORE: Setting isSigningUp:', isSigningUp);
      set({ isSigningUp });
    },
  };
});
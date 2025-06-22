import { useEffect, useState, useCallback } from 'react'
import { useAuthStore } from '../store/useAuthStore'
import { useProfileStore } from '../store/useProfileStore'
import { getUserProfile, createUserProfile, loadProfilePictureFromStorage } from '../utils/profileService'
import type { UserProfile } from '../types'
import { defaultPreferences, defaultWritingSettings } from '../store/useProfileStore'

const createDefaultProfile = (user: any): UserProfile => ({
  uid: user.uid,
  email: user.email || '',
  displayName: user.displayName || user.email?.split('@')[0] || '',
  firstName: '',
  lastName: '',
  bio: '',
  profession: '',
  location: '',
  website: '',
  preferences: defaultPreferences,
  writingSettings: defaultWritingSettings,
  createdAt: new Date(),
  updatedAt: new Date()
})

export const useProfileProvider = () => {
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { user } = useAuthStore()
  const { setProfile: setStoreProfile } = useProfileStore()

  const loadProfile = useCallback(async () => {
    if (!user?.uid) {
      console.log('👤 No user found, clearing profile')
      setProfile(null)
      setStoreProfile(null)
      setIsLoading(false)
      return
    }

    try {
      console.log('📖 Loading profile for user:', user.uid)
      setIsLoading(true)
      setError(null)
      
      const userProfile = await getUserProfile(user.uid)
      
      if (userProfile) {
        console.log('✅ Profile loaded from Firestore')
        
        // Handle profile pictures from different sources
        let finalProfile = { ...userProfile };
        
        // Check if profile indicates localStorage storage
        if (userProfile.profilePictureUrl === 'localStorage' || 
            userProfile.profilePicturePath?.startsWith('localStorage:')) {
          console.log('💾 Profile uses localStorage for picture, loading...');
          const localImage = loadProfilePictureFromStorage(user.uid);
          if (localImage) {
            finalProfile.profilePictureUrl = localImage;
            console.log('📱 Loaded profile picture from localStorage');
          } else {
            console.log('⚠️ localStorage marker found but no image stored, clearing markers');
            finalProfile.profilePictureUrl = undefined;
            finalProfile.profilePicturePath = undefined;
          }
        } else if (userProfile.profilePicturePath?.startsWith('cloudinary:')) {
          // Cloudinary URLs are already stored correctly in profilePictureUrl
          console.log('☁️ Using Cloudinary profile picture:', userProfile.profilePictureUrl);
        } else {
          // Always check localStorage for images, even if not marked in Firestore
          // This handles cases where user uploaded before we had proper markers
          console.log('🔍 Checking localStorage for profile picture...');
          const localImage = loadProfilePictureFromStorage(user.uid);
          if (localImage) {
            finalProfile.profilePictureUrl = localImage;
            console.log('📱 Found profile picture in localStorage');
          }
        }
        
        setProfile(finalProfile)
        setStoreProfile(finalProfile)
      } else {
        console.log('📝 No profile found, creating default profile')
        const defaultProfile = await createUserProfile(
          user.uid,
          user.email || '',
          user.displayName || user.email?.split('@')[0] || 'User'
        )
        
        // Check for localStorage image for new profiles too
        const localImage = loadProfilePictureFromStorage(user.uid);
        if (localImage) {
          defaultProfile.profilePictureUrl = localImage;
          console.log('📱 Applied localStorage image to new profile');
        }
        
        setProfile(defaultProfile)
        setStoreProfile(defaultProfile)
      }
    } catch (err: any) {
      console.error('❌ Error loading profile:', err)
      setError(err.message || 'Failed to load profile')
    } finally {
      setIsLoading(false)
    }
  }, [user?.uid])

  useEffect(() => {
    loadProfile()
  }, [loadProfile])

  const refreshProfile = useCallback(() => {
    loadProfile()
  }, [loadProfile])

  return {
    profile,
    isLoading,
    error,
    refreshProfile
  }
}
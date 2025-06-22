import { 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  collection, 
  query, 
  where, 
  getDocs, 
  deleteDoc 
} from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage'
import { db, storage } from '../firebase'
import type { UserProfile, UserPreferences, WritingSettings } from '../types'
import { defaultPreferences, defaultWritingSettings } from '../store/useProfileStore'
import { getStorage, uploadBytesResumable } from 'firebase/storage'

// Cloudinary configuration
const CLOUDINARY_CLOUD_NAME = 'duclkixrz';
const CLOUDINARY_UPLOAD_PRESET = 'Grammarly-clone'; // Your upload preset name
const CLOUDINARY_UPLOAD_URL = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/upload`;

export const createUserProfile = async (
  uid: string, 
  email: string, 
  displayName: string = ''
): Promise<UserProfile> => {
  const now = new Date()
  
  const profile: UserProfile = {
    uid,
    email,
    displayName,
    firstName: '',
    lastName: '',
    bio: '',
    profession: '',
    location: '',
    website: '',
    preferences: defaultPreferences,
    writingSettings: defaultWritingSettings,
    createdAt: now,
    updatedAt: now
  }

  const profileRef = doc(db, 'profiles', uid)
  await setDoc(profileRef, {
    ...profile,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString()
  })

  return profile
}

export const getUserProfile = async (uid: string): Promise<UserProfile | null> => {
  try {
    const profileRef = doc(db, 'profiles', uid)
    const profileSnap = await getDoc(profileRef)
    
    if (profileSnap.exists()) {
      const data = profileSnap.data()
      return {
        ...data,
        // Ensure writing settings exist for older profiles
        writingSettings: data.writingSettings || defaultWritingSettings,
        createdAt: new Date(data.createdAt),
        updatedAt: new Date(data.updatedAt)
      } as UserProfile
    }
    
    return null
  } catch (error) {
    console.error('Error fetching user profile:', error)
    throw error
  }
}

export const updateUserProfile = async (
  uid: string, 
  updates: Partial<Omit<UserProfile, 'uid' | 'createdAt'>>
): Promise<void> => {
  try {
    console.log('updateUserProfile called with:', { uid, updates })
    const profileRef = doc(db, 'profiles', uid)
    console.log('Profile reference created for path:', `profiles/${uid}`)
    
    // First check if the profile exists
    console.log('Checking if profile exists...')
    const profileSnap = await getDoc(profileRef)
    console.log('Profile existence check result:', profileSnap.exists())
    
    if (profileSnap.exists()) {
      // Profile exists, update it
      console.log('Updating existing profile...')
      const updateData = {
        ...updates,
        updatedAt: new Date().toISOString()
      }
      console.log('Update data:', updateData)
      
      await updateDoc(profileRef, updateData)
      console.log('Profile updated successfully in Firestore')
    } else {
      // Profile doesn't exist, create it with the updates
      console.log('Creating new profile...')
      const now = new Date()
      const newProfile: UserProfile = {
        uid,
        email: updates.email || '',
        displayName: updates.displayName || '',
        firstName: updates.firstName || '',
        lastName: updates.lastName || '',
        bio: updates.bio || '',
        profession: updates.profession || '',
        location: updates.location || '',
        website: updates.website || '',
        preferences: defaultPreferences,
        writingSettings: defaultWritingSettings,
        createdAt: now,
        updatedAt: now,
        ...updates
      }
      
      const createData = {
        ...newProfile,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString()
      }
      console.log('Create data:', createData)
      
      await setDoc(profileRef, createData)
      console.log('Profile created successfully in Firestore')
    }
  } catch (error: any) {
    console.error('Error in updateUserProfile:', {
      error,
      uid,
      updates,
      errorMessage: error?.message || 'Unknown error',
      errorCode: error?.code || 'unknown'
    })
    throw error
  }
}

export const updateUserPreferences = async (
  uid: string, 
  preferences: Partial<UserPreferences>
): Promise<void> => {
  try {
    const profileRef = doc(db, 'profiles', uid)
    const currentProfile = await getUserProfile(uid)
    
    if (currentProfile) {
      const updatedPreferences = {
        ...currentProfile.preferences,
        ...preferences
      }
      
      await updateDoc(profileRef, {
        preferences: updatedPreferences,
        updatedAt: new Date().toISOString()
      })
    }
  } catch (error) {
    console.error('Error updating user preferences:', error)
    throw error
  }
}

export const updateUserWritingSettings = async (
  uid: string, 
  writingSettings: Partial<WritingSettings>
): Promise<void> => {
  try {
    const profileRef = doc(db, 'profiles', uid)
    const currentProfile = await getUserProfile(uid)
    
    if (currentProfile) {
      const updatedSettings = {
        ...currentProfile.writingSettings,
        ...writingSettings
      }
      
      await updateDoc(profileRef, {
        writingSettings: updatedSettings,
        updatedAt: new Date().toISOString()
      })
    }
  } catch (error) {
    console.error('Error updating user writing settings:', error)
    throw error
  }
}

export const searchUserProfiles = async (searchTerm: string): Promise<UserProfile[]> => {
  try {
    const profilesRef = collection(db, 'profiles')
    const q = query(
      profilesRef,
      where('preferences.privacy.profileVisibility', '==', 'public')
    )
    
    const querySnapshot = await getDocs(q)
    const profiles: UserProfile[] = []
    
    querySnapshot.forEach((doc) => {
      const data = doc.data()
      const profile = {
        ...data,
        createdAt: new Date(data.createdAt),
        updatedAt: new Date(data.updatedAt)
      } as UserProfile
      
      // Simple text search (in a real app, you'd use a search service like Algolia)
      const searchFields = [
        profile.displayName,
        profile.firstName,
        profile.lastName,
        profile.profession,
        profile.bio
      ].join(' ').toLowerCase()
      
      if (searchFields.includes(searchTerm.toLowerCase())) {
        profiles.push(profile)
      }
    })
    
    return profiles
  } catch (error) {
    console.error('Error searching user profiles:', error)
    throw error
  }
}

// Profile picture upload functions
export const uploadProfilePicture = async (
  userId: string,
  file: File,
  onProgress?: (progress: number) => void
): Promise<{ url: string; path: string }> => {
  console.log('🚀 Starting profile picture upload for user:', userId);
  
  try {
    // Try Cloudinary first
    console.log('☁️ Attempting Cloudinary upload...');
    const cloudinaryResult = await uploadToCloudinary(userId, file, onProgress);
    console.log('✅ Cloudinary upload successful!');
    return cloudinaryResult;
  } catch (cloudinaryError) {
    console.warn('⚠️ Cloudinary upload failed, falling back to localStorage:', cloudinaryError);
    
    // Fallback to localStorage
    console.log('💾 Using localStorage fallback...');
    const localStorageResult = await uploadToLocalStorage(userId, file, onProgress);
    console.log('✅ localStorage upload successful!');
    return localStorageResult;
  }
};

// Cloudinary upload function
const uploadToCloudinary = async (userId: string, file: File, onProgress?: (progress: number) => void): Promise<{ url: string; path: string }> => {
  console.log('📤 Uploading to Cloudinary...');
  
  // Create FormData for Cloudinary upload
  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
  formData.append('folder', 'profile-pictures'); // Organize files in folders
  formData.append('public_id', `${userId}_avatar`); // Custom filename
  formData.append('overwrite', 'true'); // Replace existing files
  
  // Simulate progress for user feedback
  if (onProgress) {
    onProgress(25);
  }
  
  const response = await fetch(CLOUDINARY_UPLOAD_URL, {
    method: 'POST',
    body: formData,
  });
  
  if (onProgress) {
    onProgress(75);
  }
  
  if (!response.ok) {
    throw new Error(`Cloudinary upload failed: ${response.statusText}`);
  }
  
  const result = await response.json();
  
  if (onProgress) {
    onProgress(100);
  }
  
  console.log('🎉 Cloudinary upload complete:', result.secure_url);
  
  return {
    url: result.secure_url, // Cloudinary optimized URL
    path: `cloudinary:${result.public_id}` // Store the public_id for future operations
  };
};

// localStorage functions
const uploadToLocalStorage = async (userId: string, file: File, onProgress?: (progress: number) => void): Promise<{ url: string; path: string }> => {
  console.log('💾 Converting image to localStorage format...')
  
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    
    reader.onload = (event) => {
      try {
        const dataUrl = event.target?.result as string
        const key = `profile_picture_${userId}`
        
        // Store in localStorage
        localStorage.setItem(key, dataUrl)
        console.log('✅ Image stored in localStorage')
        
        // Simulate progress for UI feedback
        if (onProgress) {
          onProgress(25)
          setTimeout(() => onProgress(50), 100)
          setTimeout(() => onProgress(75), 200)
          setTimeout(() => onProgress(100), 300)
        }
        
        resolve({
          url: dataUrl, // Return the actual data URL for immediate display
          path: `localStorage:${userId}` // Marker to indicate localStorage storage
        })
      } catch (error) {
        console.error('❌ Error storing in localStorage:', error)
        reject(error)
      }
    }
    
    reader.onerror = () => {
      console.error('❌ Error reading file')
      reject(new Error('Failed to read file'))
    }
    
    reader.readAsDataURL(file)
  })
}

export const deleteProfilePicture = async (userId: string, picturePath?: string): Promise<void> => {
  console.log('🗑️ Deleting profile picture for user:', userId);
  
  try {
    // Delete from localStorage
    const localKey = `profile_picture_${userId}`;
    localStorage.removeItem(localKey);
    console.log('💾 Removed from localStorage');
    
    // Note: Cloudinary images are automatically overwritten when uploading 
    // with the same public_id, so no explicit deletion needed for profile pictures
    if (picturePath?.startsWith('cloudinary:')) {
      console.log('☁️ Cloudinary image will be overwritten on next upload');
    }
    
    console.log('✅ Profile picture deletion completed');
  } catch (error) {
    console.error('❌ Error deleting profile picture:', error);
    throw error;
  }
};

export const loadProfilePictureFromStorage = (userId: string): string | null => {
  try {
    const key = `profile_picture_${userId}`;
    const storedImage = localStorage.getItem(key);
    if (storedImage) {
      console.log('📱 Found profile picture in localStorage');
      return storedImage;
    }
    return null;
  } catch (error) {
    console.error('❌ Error loading from localStorage:', error);
    return null;
  }
};

export const updateProfileWithPicture = async (
  userId: string,
  profileData: Partial<UserProfile>,
  file?: File,
  onProgress?: (progress: number) => void
): Promise<void> => {
  console.log('🔄 Starting profile update with picture for user:', userId);
  
  try {
    let finalProfileData = { ...profileData };
    
    if (file) {
      console.log('📸 File provided, uploading picture...');
      const uploadResult = await uploadProfilePicture(userId, file, onProgress);
      
      // For localStorage, we DON'T save the large base64 URL to Firestore
      // Instead, we just save a small marker indicating we have a local image
      finalProfileData.profilePictureUrl = 'localStorage'; // Small marker, not the actual data
      finalProfileData.profilePicturePath = uploadResult.path; // localStorage:userId
      console.log('💾 Using localStorage marker in profile');
    }
    
    // Update profile in Firestore (without large image data)
    console.log('📝 Updating profile in Firestore...');
    await updateUserProfile(userId, finalProfileData);
    console.log('✅ Profile updated successfully!');
    
  } catch (error) {
    console.error('❌ Error updating profile with picture:', error);
    throw new Error('Failed to update profile');
  }
}; 
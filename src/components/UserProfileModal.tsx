import { useState, useEffect, useRef } from 'react'
import { useAuthStore } from '../store/useAuthStore'
import { useProfileStore } from '../store/useProfileStore'
import { updateUserProfile, updateProfileWithPicture } from '../utils/profileService'
import { deleteUser } from 'firebase/auth'
import { collection, query, where, getDocs, deleteDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { useDarkModeStore } from '../store/useDarkModeStore'
import { useProfileProvider } from '../hooks/useProfileProvider'
import { X } from 'lucide-react'
import type { UserProfile } from '../types'

interface UserProfileModalProps {
  isOpen: boolean
  onClose: () => void
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({ isOpen, onClose }) => {
  const { user } = useAuthStore()
  const { profile, isLoading, error, refreshProfile } = useProfileProvider()
  const { isDarkMode } = useDarkModeStore()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [saveMessage, setSaveMessage] = useState<string | null>(null)
  const [isLocalStorageImage, setIsLocalStorageImage] = useState(false)

  const [profileData, setProfileData] = useState<Partial<UserProfile>>({})

  // Update form data when profile loads
  useEffect(() => {
    if (profile) {
      setProfileData({
        firstName: profile.firstName || '',
        lastName: profile.lastName || '',
        displayName: profile.displayName || '',
        bio: profile.bio || '',
        profession: profile.profession || '',
        location: profile.location || '',
        website: profile.website || ''
      })
      
          // Check which storage method is being used
    const isLocalImage = profile.profilePictureUrl?.startsWith('data:') || 
                        profile.profilePicturePath?.startsWith('localStorage:') ||
                        profile.profilePictureUrl === 'localStorage'
    setIsLocalStorageImage(isLocalImage)
    }
  }, [profile])

  console.log('UserProfileModal state:', { 
    isOpen, 
    user: !!user, 
    profile: !!profile,
    profileData: profile ? {
      firstName: profile.firstName,
      lastName: profile.lastName,
      displayName: profile.displayName,
      profession: profile.profession,
      location: profile.location
    } : null
  })
  
  if (!isOpen) return null
  
  if (!user) {
    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-6">
          <p>Please sign in to access your profile.</p>
        </div>
      </div>
    )
  }
  
  if (!profile) {
    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-6">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-600 border-t-transparent mx-auto mb-4"></div>
            <p>Loading your profile...</p>
          </div>
        </div>
      </div>
    )
  }

  const handleInputChange = (field: string, value: string) => {
    setProfileData((prev: Partial<UserProfile>) => ({ ...prev, [field]: value }))
  }

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file')
      return
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('File size must be less than 5MB')
      return
    }

    setSelectedFile(file)
    
    // Create preview URL
    const reader = new FileReader()
    reader.onload = (e) => {
      setPreviewUrl(e.target?.result as string)
    }
    reader.readAsDataURL(file)
  }

  const handleRemoveImage = () => {
    setSelectedFile(null)
    setPreviewUrl(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const triggerFileInput = () => {
    fileInputRef.current?.click()
  }

  const handleSaveProfile = async () => {
    if (!user?.uid) return

    try {
      console.log('💾 Starting profile save process...')
      setIsSaving(true)
      setSaveMessage(null)
      setUploadProgress(0)

      const formData = {
        ...profileData,
        displayName: profileData.displayName || '',
        firstName: profileData.firstName || '',
        lastName: profileData.lastName || '',
        bio: profileData.bio || '',
        profession: profileData.profession || '',
        location: profileData.location || '',
        website: profileData.website || ''
      }

      console.log('📋 Form data prepared:', formData)

      await updateProfileWithPicture(
        user.uid, 
        formData, 
        selectedFile || undefined,
        setUploadProgress
      )

      console.log('✅ Profile update completed!')
      
      // Determine which storage method was used based on the upload result
      let storageMessage = 'Profile updated successfully!';
      if (selectedFile) {
        // The message will depend on which storage method actually worked
        storageMessage = 'Profile updated successfully! ☁️ Image uploaded to cloud storage.';
      }
      setSaveMessage(storageMessage)
      
      // Clear selected file and preview after successful save
      setSelectedFile(null)
      setPreviewUrl(null)
      
      // Refresh the profile data to update the avatar
      refreshProfile()
      
      setTimeout(() => {
        setSaveMessage(null)
        onClose()
      }, 1500)

    } catch (error: any) {
      console.error('❌ Profile save error:', error)
      console.log('Firebase save error details:', {
        error,
        message: error?.message || 'Unknown error',
        code: error?.code || 'unknown',
        uid: user?.uid,
        formData: profileData
      })
      
      setSaveMessage('Failed to save profile. Please try again.')
      setTimeout(() => setSaveMessage(null), 3000)
    } finally {
      setIsSaving(false)
      setUploadProgress(0)
    }
  }

  const handleDeleteAccount = async () => {
    if (!user) return
    
    const confirmed = window.confirm(
      'Are you sure you want to delete your account? This action cannot be undone and will permanently delete all your documents and data.'
    )
    
    if (!confirmed) return

    // Double confirmation for safety
    const doubleConfirmed = window.confirm(
      'This is your final warning. Deleting your account will permanently remove:\n\n' +
      '• All your documents and drafts\n' +
      '• Your profile information\n' +
      '• All writing history and analytics\n' +
      '• This action CANNOT be undone\n\n' +
      'Type "DELETE" in the next prompt to confirm deletion.'
    )

    if (!doubleConfirmed) return

    const finalConfirmation = window.prompt(
      'Please type "DELETE" (in capital letters) to confirm account deletion:'
    )

    if (finalConfirmation !== 'DELETE') {
      alert('Account deletion cancelled. You must type "DELETE" exactly to confirm.')
      return
    }
    
    try {
      setIsSaving(true)
      
      // Step 1: Delete all user documents from Firestore
      console.log('Deleting user documents...')
      const documentsQuery = query(
        collection(db, 'documents'),
        where('userId', '==', user.uid)
      )
      const documentsSnapshot = await getDocs(documentsQuery)
      
      const deletePromises = documentsSnapshot.docs.map(doc => deleteDoc(doc.ref))
      await Promise.all(deletePromises)
      console.log(`Deleted ${documentsSnapshot.docs.length} documents`)

      // Step 2: Delete user profile from Firestore
      console.log('Deleting user profile...')
      try {
        const profileQuery = query(
          collection(db, 'profiles'),
          where('userId', '==', user.uid)
        )
        const profileSnapshot = await getDocs(profileQuery)
        const profileDeletePromises = profileSnapshot.docs.map(doc => deleteDoc(doc.ref))
        await Promise.all(profileDeletePromises)
        console.log('User profile deleted')
      } catch (profileError) {
        console.warn('Error deleting profile (may not exist):', profileError)
      }

      // Step 3: Delete the Firebase Auth user account
      console.log('Deleting Firebase Auth user...')
      await deleteUser(user)
      console.log('User account deleted successfully')

      // Step 4: Show success message and close modal
      alert('Your account has been permanently deleted. Thank you for using StudyWrite.')
      onClose()
      
    } catch (error: any) {
      console.error('Error deleting account:', error)
      
      let errorMessage = 'Failed to delete account. Please try again.'
      
      // Handle specific Firebase Auth errors
      if (error.code === 'auth/requires-recent-login') {
        errorMessage = 'For security reasons, you need to sign in again before deleting your account. Please sign out, sign back in, and try again.'
      } else if (error.code === 'auth/user-not-found') {
        errorMessage = 'User account not found. It may have already been deleted.'
      }
      
      alert(errorMessage)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className={`fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 ${!isOpen ? 'hidden' : ''}`}>
      <div className={`${isDarkMode ? 'bg-gray-800 text-white' : 'bg-white text-gray-900'} rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto mx-4`}>
        <div className={`sticky top-0 ${isDarkMode ? 'bg-gray-800' : 'bg-white'} px-6 py-4 border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-200'} flex justify-between items-center`}>
          <h2 className="text-xl font-semibold">User Profile</h2>
          <button
            onClick={onClose}
            className={`${isDarkMode ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-700'} transition-colors`}
          >
            <X size={24} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Profile Picture Section */}
          <div className="flex flex-col items-center space-y-4">
            <div className="relative">
              {(previewUrl || profile?.profilePictureUrl) ? (
                <img
                  src={previewUrl || profile?.profilePictureUrl}
                  alt="Profile"
                  className="w-24 h-24 rounded-full object-cover border-4 border-blue-500"
                />
              ) : (
                <div className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center border-4 border-blue-500">
                  <span className="text-white text-2xl font-bold">
                    {(profile?.displayName || profile?.email || 'U').charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
              
              {/* Upload Progress Overlay */}
              {isSaving && uploadProgress > 0 && uploadProgress < 100 && (
                <div className="absolute inset-0 bg-black bg-opacity-50 rounded-full flex items-center justify-center">
                  <div className="text-white text-sm font-medium">
                    {uploadProgress}%
                  </div>
                </div>
              )}
            </div>

            {/* Local Storage Indicator */}
            {isLocalStorageImage && (
              <div className={`text-xs px-2 py-1 rounded ${isDarkMode ? 'bg-blue-900 text-blue-200' : 'bg-blue-100 text-blue-800'}`}>
                📱 Stored locally
              </div>
            )}

            {/* File Upload */}
            <div className="flex flex-col items-center space-y-2">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileSelect}
                accept="image/*"
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isSaving}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  isDarkMode 
                    ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                    : 'bg-blue-500 hover:bg-blue-600 text-white'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {selectedFile ? 'Change Picture' : 'Upload Picture'}
              </button>
              
              {selectedFile && (
                <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  Selected: {selectedFile.name}
                </p>
              )}
            </div>
          </div>

          {/* Save Message */}
          {saveMessage && (
            <div className={`p-3 rounded-lg text-center ${
              saveMessage.includes('success') 
                ? (isDarkMode ? 'bg-green-900 text-green-200' : 'bg-green-100 text-green-800')
                : (isDarkMode ? 'bg-red-900 text-red-200' : 'bg-red-100 text-red-800')
            }`}>
              {saveMessage}
            </div>
          )}

          {/* Form Fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={`block text-sm font-medium mb-1 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                Display Name
              </label>
              <input
                type="text"
                value={profileData.displayName || ''}
                onChange={(e) => setProfileData({ ...profileData, displayName: e.target.value })}
                className={`w-full px-3 py-2 border rounded-lg ${
                  isDarkMode 
                    ? 'bg-gray-700 border-gray-600 text-white' 
                    : 'bg-white border-gray-300 text-gray-900'
                } focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
              />
            </div>

            <div>
              <label className={`block text-sm font-medium mb-1 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                Email
              </label>
              <input
                type="email"
                value={profileData.email || ''}
                onChange={(e) => setProfileData({ ...profileData, email: e.target.value })}
                className={`w-full px-3 py-2 border rounded-lg ${
                  isDarkMode 
                    ? 'bg-gray-700 border-gray-600 text-white' 
                    : 'bg-white border-gray-300 text-gray-900'
                } focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
              />
            </div>

            <div>
              <label className={`block text-sm font-medium mb-1 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                First Name
              </label>
              <input
                type="text"
                value={profileData.firstName || ''}
                onChange={(e) => setProfileData({ ...profileData, firstName: e.target.value })}
                className={`w-full px-3 py-2 border rounded-lg ${
                  isDarkMode 
                    ? 'bg-gray-700 border-gray-600 text-white' 
                    : 'bg-white border-gray-300 text-gray-900'
                } focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
              />
            </div>

            <div>
              <label className={`block text-sm font-medium mb-1 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                Last Name
              </label>
              <input
                type="text"
                value={profileData.lastName || ''}
                onChange={(e) => setProfileData({ ...profileData, lastName: e.target.value })}
                className={`w-full px-3 py-2 border rounded-lg ${
                  isDarkMode 
                    ? 'bg-gray-700 border-gray-600 text-white' 
                    : 'bg-white border-gray-300 text-gray-900'
                } focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
              />
            </div>
          </div>

          <div>
            <label className={`block text-sm font-medium mb-1 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
              Bio
            </label>
            <textarea
              value={profileData.bio || ''}
              onChange={(e) => setProfileData({ ...profileData, bio: e.target.value })}
              rows={3}
              className={`w-full px-3 py-2 border rounded-lg ${
                isDarkMode 
                  ? 'bg-gray-700 border-gray-600 text-white' 
                  : 'bg-white border-gray-300 text-gray-900'
              } focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={`block text-sm font-medium mb-1 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                Profession
              </label>
              <input
                type="text"
                value={profileData.profession || ''}
                onChange={(e) => setProfileData({ ...profileData, profession: e.target.value })}
                className={`w-full px-3 py-2 border rounded-lg ${
                  isDarkMode 
                    ? 'bg-gray-700 border-gray-600 text-white' 
                    : 'bg-white border-gray-300 text-gray-900'
                } focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
              />
            </div>

            <div>
              <label className={`block text-sm font-medium mb-1 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                Location
              </label>
              <input
                type="text"
                value={profileData.location || ''}
                onChange={(e) => setProfileData({ ...profileData, location: e.target.value })}
                className={`w-full px-3 py-2 border rounded-lg ${
                  isDarkMode 
                    ? 'bg-gray-700 border-gray-600 text-white' 
                    : 'bg-white border-gray-300 text-gray-900'
                } focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
              />
            </div>
          </div>

          <div>
            <label className={`block text-sm font-medium mb-1 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
              Website
            </label>
            <input
              type="url"
              value={profileData.website || ''}
              onChange={(e) => setProfileData({ ...profileData, website: e.target.value })}
              className={`w-full px-3 py-2 border rounded-lg ${
                isDarkMode 
                  ? 'bg-gray-700 border-gray-600 text-white' 
                  : 'bg-white border-gray-300 text-gray-900'
              } focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
            />
          </div>
        </div>

        <div className={`sticky bottom-0 ${isDarkMode ? 'bg-gray-800' : 'bg-white'} px-6 py-4 border-t ${isDarkMode ? 'border-gray-700' : 'border-gray-200'} flex justify-end space-x-3`}>
          <button
            onClick={onClose}
            disabled={isSaving}
            className={`px-4 py-2 border rounded-lg transition-colors ${
              isDarkMode 
                ? 'border-gray-600 text-gray-300 hover:bg-gray-700' 
                : 'border-gray-300 text-gray-700 hover:bg-gray-50'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            Cancel
          </button>
          <button
            onClick={handleSaveProfile}
            disabled={isSaving}
            className={`px-4 py-2 rounded-lg transition-colors ${
              isDarkMode 
                ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                : 'bg-blue-500 hover:bg-blue-600 text-white'
            } disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2`}
          >
            {isSaving ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                <span>Saving...</span>
              </>
            ) : (
              <span>Save Profile</span>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

export default UserProfileModal 
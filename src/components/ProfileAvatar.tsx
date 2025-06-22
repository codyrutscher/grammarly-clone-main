import { useProfileStore } from '../store/useProfileStore'
import { useDarkModeStore } from '../store/useDarkModeStore'

interface ProfileAvatarProps {
  size?: 'sm' | 'md' | 'lg'
  onClick?: () => void
  className?: string
}

export const ProfileAvatar = ({ size = 'md', onClick, className = '' }: ProfileAvatarProps) => {
  const { profile } = useProfileStore()
  const { isDarkMode } = useDarkModeStore()

  const sizeClasses = {
    sm: 'w-8 h-8 text-sm',
    md: 'w-10 h-10 text-base',
    lg: 'w-12 h-12 text-lg'
  }

  const getInitials = () => {
    if (profile?.firstName && profile?.lastName) {
      return `${profile.firstName[0]}${profile.lastName[0]}`.toUpperCase()
    } else if (profile?.displayName) {
      const names = profile.displayName.split(' ')
      if (names.length >= 2) {
        return `${names[0][0]}${names[1][0]}`.toUpperCase()
      } else {
        return profile.displayName[0].toUpperCase()
      }
    } else if (profile?.email) {
      return profile.email[0].toUpperCase()
    }
    return '👤'
  }

  return (
    <button
      onClick={onClick}
      className={`
        ${sizeClasses[size]} 
        rounded-full overflow-hidden 
        transition-all duration-200 
        hover:scale-105 hover:shadow-lg 
        focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
        ${isDarkMode ? 'focus:ring-offset-gray-800' : 'focus:ring-offset-white'}
        ${className}
      `}
      title={profile?.displayName || profile?.firstName || 'Profile'}
    >
      {profile?.profilePictureUrl ? (
        <img 
          src={profile.profilePictureUrl} 
          alt={profile?.displayName || 'Profile'} 
          className="w-full h-full object-cover"
        />
      ) : (
        <div className={`
          w-full h-full flex items-center justify-center font-semibold
          ${isDarkMode 
            ? 'bg-gradient-to-br from-blue-600 to-purple-600 text-white' 
            : 'bg-gradient-to-br from-blue-500 to-purple-500 text-white'
          }
        `}>
          {getInitials()}
        </div>
      )}
    </button>
  )
} 
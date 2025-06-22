import { useState } from 'react';
import { signUp } from '../utils/firebaseUtils';
import { useDarkModeStore } from '../store/useDarkModeStore';
import { useAuthStore } from '../store/useAuthStore';

interface SignupPageProps {
  isOpen: boolean;
  onClose: () => void;
  onSwitchToLogin: () => void;
  onSignupSuccess?: () => void;
}

export function SignupPage({ isOpen, onClose, onSwitchToLogin, onSignupSuccess }: SignupPageProps) {
  const { isDarkMode } = useDarkModeStore();
  const { setIsSigningUp } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  console.log('📝 SIGNUP PAGE: Render state:', {
    isOpen,
    loading,
    error,
    successMessage,
    email,
    timestamp: new Date().toISOString()
  });

  if (!isOpen) {
    console.log('📝 SIGNUP PAGE: Not open, returning null');
    return null;
  }

  // Password validation helpers
  const isPasswordValid = password.length >= 6;
  const doPasswordsMatch = password === confirmPassword && password.length > 0;
  const showPasswordValidation = password.length > 0;
  const showConfirmValidation = confirmPassword.length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('📝 SIGNUP PAGE: Form submitted for email:', email);
    
    setError('');
    setSuccessMessage('');
    setLoading(true);
    
    // Set signing up flag to prevent auth state flashing
    setIsSigningUp(true);

    if (password !== confirmPassword) {
      console.log('❌ SIGNUP PAGE: Password mismatch');
      setError('Passwords do not match');
      setLoading(false);
      setIsSigningUp(false);
      return;
    }

    if (password.length < 6) {
      console.log('❌ SIGNUP PAGE: Password too short');
      setError('Password must be at least 6 characters long');
      setLoading(false);
      setIsSigningUp(false);
      return;
    }

    try {
      console.log('📝 SIGNUP PAGE: Calling signUp function...');
      const result = await signUp(email, password, displayName);
      console.log('📝 SIGNUP PAGE: SignUp result:', result);

      if (result.error) {
        console.log('❌ SIGNUP PAGE: SignUp error:', result.error.message);
        setError(result.error.message);
        setIsSigningUp(false);
      } else if (result.message) {
        console.log('✅ SIGNUP PAGE: SignUp successful, setting success message');
        setSuccessMessage(result.message);
        // Clear form fields
        setEmail('');
        setPassword('');
        setConfirmPassword('');
        setDisplayName('');
        console.log('📝 SIGNUP PAGE: Form fields cleared, success message set');
        // Notify parent to preserve modal state
        onSignupSuccess?.();
        // Reset signing up flag after a delay to ensure auth state has stabilized
        setTimeout(() => {
          setIsSigningUp(false);
        }, 2000);
      }
    } catch (err) {
      console.error('❌ SIGNUP PAGE: Unexpected error:', err);
      setError('An unexpected error occurred');
      setIsSigningUp(false);
    } finally {
      setLoading(false);
      console.log('📝 SIGNUP PAGE: HandleSubmit completed, loading set to false');
    }
  };

  // Clear success message when switching to login
  const handleSwitchToLogin = () => {
    console.log('📝 SIGNUP PAGE: Switching to login page');
    setSuccessMessage('');
    setError('');
    setIsSigningUp(false);
    onSwitchToLogin();
  };

  // Handle close button click
  const handleClose = () => {
    console.log('📝 SIGNUP PAGE: Closing signup page');
    // Clear all state when closing
    setSuccessMessage('');
    setError('');
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setDisplayName('');
    setIsSigningUp(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Background */}
      <div 
        className={`absolute inset-0 transition-all duration-300 ${
          isDarkMode 
            ? 'bg-gray-900' 
            : 'bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50'
        }`}
      >
        {/* Animated background elements */}
        <div className="absolute inset-0 overflow-hidden">
          <div className={`absolute -top-40 -right-40 w-80 h-80 rounded-full opacity-20 animate-pulse ${
            isDarkMode ? 'bg-blue-500' : 'bg-blue-400'
          }`}></div>
          <div className={`absolute -bottom-40 -left-40 w-80 h-80 rounded-full opacity-20 animate-pulse ${
            isDarkMode ? 'bg-purple-500' : 'bg-purple-400'
          }`} style={{ animationDelay: '1s' }}></div>
        </div>
      </div>

      {/* Content */}
      <div className="relative w-full max-w-md mx-4">
        <div className={`rounded-2xl shadow-2xl p-8 backdrop-blur-sm border transition-all duration-300 ${
          isDarkMode 
            ? 'bg-gray-800/90 border-gray-700' 
            : 'bg-white/90 border-white/50'
        }`}>
          {/* Header */}
          <div className="text-center mb-8">
            <div className="flex items-center justify-center mb-4">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center shadow-lg ${
                successMessage 
                  ? 'bg-gradient-to-br from-green-500 to-green-600' 
                  : 'bg-gradient-to-br from-blue-500 to-purple-600'
              }`}>
                {successMessage ? (
                  <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <span className="text-white font-bold text-xl">S</span>
                )}
              </div>
            </div>
            <h1 className={`text-3xl font-bold mb-2 ${
              isDarkMode ? 'text-white' : 'text-gray-900'
            }`}>
              {successMessage ? 'Account Created!' : 'Create your account'}
            </h1>
            <p className={`text-sm ${
              isDarkMode ? 'text-gray-400' : 'text-gray-600'
            }`}>
              {successMessage ? 'One more step to get started' : 'Join StudyWrite and start improving your writing today'}
            </p>
          </div>

          {/* Success Message Display */}
          {successMessage && (
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-green-50 border border-green-200">
                <div className="flex items-start">
                  <svg className="w-5 h-5 text-green-400 mr-2 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <div className="flex-1">
                    <p className="text-green-700 text-sm font-medium mb-2">{successMessage}</p>
                    <p className="text-green-600 text-xs">
                      Important: You must verify your email before you can sign in. 
                      Check your inbox (and spam folder) for the verification link.
                    </p>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={handleSwitchToLogin}
                className="w-full bg-gradient-to-r from-green-500 to-green-600 text-white py-3 px-4 rounded-lg font-semibold transition-all duration-200 hover:from-green-600 hover:to-green-700 hover:shadow-lg transform hover:scale-[1.02]"
              >
                Go to Sign In
              </button>
            </div>
          )}

          {/* Form - Hidden when success message is shown */}
          {!successMessage && (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="displayName" className={`block text-sm font-medium mb-2 ${
                isDarkMode ? 'text-gray-300' : 'text-gray-700'
              }`}>
                Full Name
              </label>
              <input
                type="text"
                id="displayName"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className={`w-full px-4 py-3 rounded-lg border transition-all duration-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  isDarkMode 
                    ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' 
                    : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                }`}
                placeholder="Enter your full name"
              />
            </div>

            <div>
              <label htmlFor="email" className={`block text-sm font-medium mb-2 ${
                isDarkMode ? 'text-gray-300' : 'text-gray-700'
              }`}>
                Email Address
              </label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className={`w-full px-4 py-3 rounded-lg border transition-all duration-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  isDarkMode 
                    ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' 
                    : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                }`}
                placeholder="Enter your email"
              />
            </div>

            <div>
              <label htmlFor="password" className={`block text-sm font-medium mb-2 ${
                isDarkMode ? 'text-gray-300' : 'text-gray-700'
              }`}>
                Password
              </label>
              <div className="relative">
                <input
                  type="password"
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className={`w-full px-4 py-3 pr-10 rounded-lg border-2 transition-all duration-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    showPasswordValidation 
                      ? isPasswordValid
                        ? 'border-green-500 bg-green-50' 
                        : 'border-red-500 bg-red-50'
                      : isDarkMode 
                        ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' 
                        : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                  }`}
                  placeholder="Create a password (min 6 characters)"
                />
                {showPasswordValidation && (
                  <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                    {isPasswordValid ? (
                      <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    )}
                  </div>
                )}
              </div>
              {showPasswordValidation && (
                <p className={`text-xs mt-1 ${isPasswordValid ? 'text-green-600' : 'text-red-600'}`}>
                  {isPasswordValid ? '✓ Password meets requirements' : '✗ Password must be at least 6 characters'}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="confirmPassword" className={`block text-sm font-medium mb-2 ${
                isDarkMode ? 'text-gray-300' : 'text-gray-700'
              }`}>
                Confirm Password
              </label>
              <div className="relative">
                <input
                  type="password"
                  id="confirmPassword"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={6}
                  className={`w-full px-4 py-3 pr-10 rounded-lg border-2 transition-all duration-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    showConfirmValidation 
                      ? doPasswordsMatch
                        ? 'border-green-500 bg-green-50' 
                        : 'border-red-500 bg-red-50'
                      : isDarkMode 
                        ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' 
                        : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                  }`}
                  placeholder="Confirm your password"
                />
                {showConfirmValidation && (
                  <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                    {doPasswordsMatch ? (
                      <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    )}
                  </div>
                )}
              </div>
              {showConfirmValidation && (
                <p className={`text-xs mt-1 ${doPasswordsMatch ? 'text-green-600' : 'text-red-600'}`}>
                  {doPasswordsMatch ? '✓ Passwords match' : '✗ Passwords do not match'}
                </p>
              )}
            </div>

            {error && (
              <div className="p-4 rounded-lg bg-red-50 border border-red-200">
                <div className="flex items-center">
                  <svg className="w-5 h-5 text-red-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                  <span className="text-red-700 text-sm">{error}</span>
                </div>
              </div>
            )}

            {!successMessage && (
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-blue-500 to-purple-600 text-white py-3 px-4 rounded-lg font-semibold transition-all duration-200 hover:from-blue-600 hover:to-purple-700 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-[1.02]"
              >
                {loading ? (
                  <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent mr-2"></div>
                    Creating Account...
                  </div>
                ) : (
                  'Create Account'
                )}
              </button>
            )}
          </form>
          )}

          {/* Footer - Hidden when success message is shown */}
          {!successMessage && (
            <div className="mt-8 text-center">
              <p className={`text-sm ${
                isDarkMode ? 'text-gray-400' : 'text-gray-600'
              }`}>
                Already have an account?{' '}
                <button
                  onClick={handleSwitchToLogin}
                  className="text-blue-500 hover:text-blue-600 font-medium transition-colors"
                >
                  Sign in
                </button>
              </p>
            </div>
          )}

          {/* Close button */}
          <button
            onClick={handleClose}
            className={`absolute top-4 right-4 p-2 rounded-lg transition-colors ${
              isDarkMode 
                ? 'text-gray-400 hover:text-gray-300 hover:bg-gray-700' 
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
            }`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
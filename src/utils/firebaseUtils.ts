import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged, 
  sendEmailVerification,
  updateProfile,
  type User
} from 'firebase/auth';
import { 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  getDocs, 
  getDoc,
  query, 
  where, 
  orderBy
} from 'firebase/firestore';
import { auth, db } from '../firebase';
import type { Document } from '../store/useDocumentStore';
import type { SharedDocument } from '../types';

// Auth return types
interface AuthResult {
  user: User | null;
  error: Error | null;
  message?: string | null;
  needsVerification?: boolean;
  unverifiedEmail?: string;
  alreadyVerified?: boolean;
}

// Auth functions
export const signUp = async (email: string, password: string, displayName?: string): Promise<AuthResult> => {
  try {
    console.log('📝 SIGNUP: Starting signup process for:', email);
    
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    
    console.log('✅ SIGNUP: User created successfully:', {
      uid: user.uid,
      email: user.email,
      emailVerified: user.emailVerified
    });
    
    // Update display name if provided
    if (displayName) {
      console.log('📝 SIGNUP: Updating display name to:', displayName);
      await updateProfile(user, { displayName });
    }
    
    // Send email verification
    console.log('📧 SIGNUP: Sending verification email to:', user.email);
    await sendEmailVerification(user);
    console.log('✅ SIGNUP: Verification email sent successfully');
    
    // Sign out the user immediately after creating the account
    // This prevents automatic login and forces email verification
    console.log('🚪 SIGNUP: Signing out user to force email verification');
    await signOut(auth);
    console.log('✅ SIGNUP: User signed out successfully');
    
    return { 
      user: null, // Return null since we signed them out
      error: null,
      message: 'Account created successfully! Please check your email to verify your account. You will need to sign in after verifying your email.'
    };
  } catch (error) {
    console.error('❌ SIGNUP: Error during signup:', error);
    return { 
      user: null, 
      error: error as Error,
      message: null
    };
  }
};

export const signIn = async (email: string, password: string): Promise<AuthResult> => {
  try {
    console.log('🔑 SIGNIN: Starting signin process for:', email);
    
    const result = await signInWithEmailAndPassword(auth, email, password);
    
    console.log('✅ SIGNIN: Firebase authentication successful:', {
      uid: result.user.uid,
      email: result.user.email,
      emailVerified: result.user.emailVerified
    });
    
    // Check if email is verified
    if (!result.user.emailVerified) {
      console.log('❌ SIGNIN: Email not verified, signing out user');
      // Sign out the user if email is not verified
      await signOut(auth);
      console.log('🚪 SIGNIN: User signed out due to unverified email');
      return { 
        user: null, 
        error: new Error('Please verify your email before signing in. Check your inbox for the verification link.'),
        needsVerification: true,
        unverifiedEmail: email
      };
    }
    
    console.log('✅ SIGNIN: Email verified, login successful');
    return { user: result.user, error: null };
  } catch (error) {
    console.error('❌ SIGNIN: Error during signin:', error);
    return { user: null, error: error as Error };
  }
};

export const logout = async () => {
  try {
    await signOut(auth);
    return { error: null };
  } catch (error) {
    return { error: error as Error };
  }
};

export const resendVerificationEmail = async (email: string, password: string): Promise<AuthResult> => {
  try {
    // Sign in temporarily to get the user object
    const result = await signInWithEmailAndPassword(auth, email, password);
    
    if (result.user.emailVerified) {
      await signOut(auth);
      return { 
        user: null,
        error: new Error('Email is already verified. You can sign in now.'),
        alreadyVerified: true 
      };
    }
    
    // Send verification email
    await sendEmailVerification(result.user);
    
    // Sign out after sending the email
    await signOut(auth);
    
    return { 
      user: null,
      error: null,
      message: 'Verification email sent successfully! Please check your inbox.'
    };
  } catch (error) {
    return { 
      user: null,
      error: error as Error 
    };
  }
};

export const onAuthStateChange = (callback: (user: User | null) => void) => {
  console.log('🔥 FIREBASE: Setting up onAuthStateChanged listener');
  return onAuthStateChanged(auth, (user) => {
    console.log('🔥 FIREBASE: Auth state changed, calling callback with user:', user ? `${user.email} (verified: ${user.emailVerified})` : 'null');
    callback(user);
  });
};

// Helper function to convert Firestore timestamp to Date
const toDate = (timestamp: any): Date => {
  if (!timestamp) return new Date();
  if (timestamp.toDate && typeof timestamp.toDate === 'function') {
    return timestamp.toDate();
  }
  if (timestamp instanceof Date) {
    return timestamp;
  }
  return new Date(timestamp);
};

// Document functions
export const createDocument = async (userId: string, title: string, content: string = '') => {
  try {
    const docData = {
      title,
      content,
      userId,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    const docRef = await addDoc(collection(db, 'documents'), docData);
    return { 
      document: { 
        id: docRef.id, 
        ...docData 
      } as Document, 
      error: null 
    };
  } catch (error) {
    return { document: null, error: error as Error };
  }
};

export const updateDocument = async (documentId: string, updates: Partial<Document>) => {
  try {
    console.log('updateDocument: Attempting to update document:', documentId, updates);
    
    const docRef = doc(db, 'documents', documentId);
    
    // Check if the document exists first
    const docSnapshot = await getDoc(docRef);
    if (!docSnapshot.exists()) {
      console.error('updateDocument: Document not found:', documentId);
      return { error: new Error('Document not found') };
    }
    
    await updateDoc(docRef, {
      ...updates,
      updatedAt: new Date()
    });
    
    console.log('updateDocument: Successfully updated document:', documentId);
    return { error: null };
  } catch (error) {
    console.error('updateDocument: Error updating document:', documentId, error);
    return { error: error as Error };
  }
};

export const deleteDocument = async (documentId: string) => {
  try {
    console.log('deleteDocument: Deleting document and cleaning up shared references:', documentId);
    
    // First, find and delete all shared document entries that reference this document
    const sharedDocsQuery = query(
      collection(db, 'sharedDocuments'),
      where('originalDocumentId', '==', documentId)
    );
    
    const sharedDocsSnapshot = await getDocs(sharedDocsQuery);
    console.log('deleteDocument: Found shared document entries to clean up:', sharedDocsSnapshot.size);
    
    // Delete all shared document entries
    const deletePromises = sharedDocsSnapshot.docs.map(sharedDoc => {
      console.log('deleteDocument: Deleting shared document entry:', sharedDoc.id);
      return deleteDoc(doc(db, 'sharedDocuments', sharedDoc.id));
    });
    
    await Promise.all(deletePromises);
    console.log('deleteDocument: Cleaned up shared document entries');
    
    // Then delete the original document
    await deleteDoc(doc(db, 'documents', documentId));
    console.log('deleteDocument: Successfully deleted document and cleaned up shared references');
    
    return { error: null };
  } catch (error) {
    console.error('deleteDocument: Error during deletion:', error);
    return { error: error as Error };
  }
};

// Get documents shared with user through teams
export const getSharedDocumentsForUser = async (userId: string) => {
  try {
    console.log('getSharedDocumentsForUser: Starting query for userId:', userId);
    
    // First, get all teams the user is a member of
    const teamsQuery = query(collection(db, 'teams'));
    const teamsSnapshot = await getDocs(teamsQuery);
    
    const userTeamIds: string[] = [];
    teamsSnapshot.forEach((teamDoc) => {
      const teamData = teamDoc.data();
      const isMember = teamData.members?.some((member: any) => member.userId === userId);
      if (isMember) {
        userTeamIds.push(teamDoc.id);
      }
    });
    
    console.log('getSharedDocumentsForUser: User is member of teams:', userTeamIds);
    
    if (userTeamIds.length === 0) {
      return { documents: [], error: null };
    }
    
    // Get all shared documents for the user's teams
    const sharedDocuments: Document[] = [];
    
    for (const teamId of userTeamIds) {
      const sharedDocsQuery = query(
        collection(db, 'sharedDocuments'),
        where('teamId', '==', teamId)
      );
      
      const sharedDocsSnapshot = await getDocs(sharedDocsQuery);
      
      for (const sharedDoc of sharedDocsSnapshot.docs) {
        const sharedDocData = sharedDoc.data() as SharedDocument;
        
        // Get the original document
        try {
          const originalDocRef = doc(db, 'documents', sharedDocData.originalDocumentId);
          const originalDocSnapshot = await getDoc(originalDocRef);
          
          if (originalDocSnapshot.exists()) {
            const originalDocData = originalDocSnapshot.data();
            
            // Create a document object with shared metadata
            const sharedDocument: Document = {
              id: originalDocSnapshot.id,
              title: `[Shared] ${originalDocData.title}`,
              content: originalDocData.content,
              userId: originalDocData.userId,
              createdAt: toDate(originalDocData.createdAt),
              updatedAt: toDate(originalDocData.updatedAt),
              // Add shared document metadata
              isShared: true,
              sharedBy: sharedDocData.sharedBy,
              teamId: teamId,
              permissions: sharedDocData.permissions,
              sharedAt: toDate(sharedDocData.sharedAt),
              sharedDocumentId: sharedDoc.id // Include the shared document ID for proper deletion
            };
            
            console.log('firebaseUtils: Created shared document:', {
              id: sharedDocument.id,
              title: sharedDocument.title,
              permissions: sharedDocument.permissions,
              canEdit: sharedDocument.permissions?.canEdit
            });
            
            sharedDocuments.push(sharedDocument);
          }
        } catch (docError) {
          console.error('Error fetching original document:', sharedDocData.originalDocumentId, docError);
        }
      }
    }
    
    console.log('getSharedDocumentsForUser: Found shared documents:', sharedDocuments.length);
    return { documents: sharedDocuments, error: null };
  } catch (error) {
    console.error('getSharedDocumentsForUser: Error:', error);
    return { documents: [], error: error as Error };
  }
};

export const getUserDocuments = async (userId: string) => {
  try {
    console.log('getUserDocuments: Starting query for userId:', userId);
    
    // Get user's own documents
    let q = query(
      collection(db, 'documents'),
      where('userId', '==', userId),
      orderBy('updatedAt', 'desc')
    );
    
    let querySnapshot;
    try {
      querySnapshot = await getDocs(q);
      console.log('getUserDocuments: Query with orderBy successful');
    } catch (indexError) {
      console.warn('getUserDocuments: OrderBy query failed, trying without orderBy:', indexError);
      // Fallback: query without orderBy if index doesn't exist
      q = query(
        collection(db, 'documents'),
        where('userId', '==', userId)
      );
      querySnapshot = await getDocs(q);
      console.log('getUserDocuments: Query without orderBy successful');
    }
    
    const ownedDocuments: Document[] = [];
    
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      console.log('getUserDocuments: Processing owned document:', doc.id, data);
      
      try {
        ownedDocuments.push({
          id: doc.id,
          title: data.title,
          content: data.content,
          userId: data.userId,
          createdAt: data.createdAt.toDate(),
          updatedAt: data.updatedAt.toDate(),
          isShared: false
        } as Document);
      } catch (timestampError) {
        console.error('getUserDocuments: Error converting timestamps for doc:', doc.id, timestampError);
        // Fallback with current date if timestamp conversion fails
        ownedDocuments.push({
          id: doc.id,
          title: data.title,
          content: data.content,
          userId: data.userId,
          createdAt: new Date(),
          updatedAt: new Date(),
          isShared: false
        } as Document);
      }
    });
    
    // Get shared documents
    const sharedResult = await getSharedDocumentsForUser(userId);
    const sharedDocuments = sharedResult.documents || [];
    
    // Filter out shared documents that are owned by the same user to prevent duplicates
    const filteredSharedDocuments = sharedDocuments.filter(sharedDoc => 
      sharedDoc.userId !== userId
    );
    
    console.log('getUserDocuments: Filtered shared documents to prevent duplicates:', {
      totalShared: sharedDocuments.length,
      filteredShared: filteredSharedDocuments.length,
      removedDuplicates: sharedDocuments.length - filteredSharedDocuments.length
    });
    
    // Combine owned and filtered shared documents
    const allDocuments = [...ownedDocuments, ...filteredSharedDocuments];
    
    // Sort manually by updatedAt (or sharedAt for shared docs)
    allDocuments.sort((a, b) => {
      const aDate = a.isShared ? (a.sharedAt || a.updatedAt) : a.updatedAt;
      const bDate = b.isShared ? (b.sharedAt || b.updatedAt) : b.updatedAt;
      return bDate.getTime() - aDate.getTime();
    });
    
    console.log('getUserDocuments: Successfully loaded documents:', {
      owned: ownedDocuments.length,
      shared: filteredSharedDocuments.length,
      total: allDocuments.length
    });
    
    return { documents: allDocuments, error: null };
  } catch (error) {
    console.error('getUserDocuments: Error loading documents:', error);
    return { documents: [], error: error as Error };
  }
}; 
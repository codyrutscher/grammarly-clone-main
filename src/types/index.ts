export type Suggestion = {
  id: string;
  type: 'grammar' | 'spelling' | 'style' | 'readability' | 'structure' | 'tone';
  message: string;
  suggestion: string;
  severity: 'high' | 'medium' | 'low' | 'error' | 'warning' | 'suggestion';
  explanation?: string;
  startIndex: number;
  endIndex: number;
  originalText: string;
};

export interface Document {
  id: string
  title: string
  content: string
  createdAt: Date
  updatedAt: Date
  userId: string
  // Shared document metadata (only present for shared documents)
  isShared?: boolean
  sharedBy?: string
  teamId?: string
  permissions?: DocumentPermissions
  sharedAt?: Date
  sharedDocumentId?: string // ID of the sharedDocuments collection entry
}

// New types for academic writing features
export type AcademicStyle = 'mla' | 'apa' | 'chicago' | 'harvard' | 'none'
export type LanguageVariant = 'us' | 'uk' | 'au' | 'ca'
export type CheckingMode = 'standard' | 'speed' | 'comprehensive'
export type WritingMode = {
  id: string;
  name: string;
  description: string;
  rules: {
    tone: {
      formality: 'casual' | 'neutral' | 'formal';
      emotion: 'objective' | 'persuasive' | 'engaging';
    };
    style: {
      sentenceLength: 'short' | 'medium' | 'long';
      vocabulary: 'simple' | 'moderate' | 'advanced';
      allowPassiveVoice: boolean;
      technicalTerms: boolean;
    };
    structure: {
      paragraphLength: 'short' | 'medium' | 'long';
      requireTopicSentences: boolean;
      requireTransitions: boolean;
    };
    citations: {
      required: boolean;
      style: 'APA' | 'MLA' | 'Chicago' | 'none';
    };
  };
  customRules?: Record<string, any>;
};

export type WritingModeType = 'academic' | 'business' | 'creative' | 'technical' | 'casual';

export interface WritingSettings {
  academicStyle: 'none' | 'mla' | 'apa' | 'chicago' | 'harvard';
  languageVariant: LanguageVariant;
  checkingMode: CheckingMode;
  writingMode: WritingModeType;
  criticalErrorsOnly: boolean;
  customRules?: Record<string, any>;
}

export interface UserProfile {
  uid: string
  email: string
  displayName: string
  firstName: string
  lastName: string
  bio: string
  profession: string
  location: string
  website: string
  profilePictureUrl?: string
  profilePicturePath?: string
  preferences: UserPreferences
  writingSettings: WritingSettings
  createdAt: Date
  updatedAt: Date
}

export interface UserPreferences {
  writingStyle: 'academic' | 'business' | 'casual' | 'creative'
  languageVariant: 'us' | 'uk' | 'au' | 'ca'
  suggestions: {
    grammar: boolean
    spelling: boolean
    style: boolean
    readability: boolean
  }
  aiAssistance: {
    enabled: boolean
    suggestionLevel: 'basic' | 'standard' | 'advanced'
    autoApply: boolean
  }
  privacy: {
    profileVisibility: 'public' | 'private'
    shareWritingStats: boolean
  }
}

export interface VoiceNote {
  id: string;
  title: string;
  audioBlob: Blob;
  duration: number;
  transcript?: string;
  createdAt: Date;
  documentId?: string;
}

export interface PlagiarismResult {
  overallScore: number;
  matches: PlagiarismMatch[];
  sources: string[];
  isChecking: boolean;
}

export interface PlagiarismMatch {
  text: string;
  startIndex: number;
  endIndex: number;
  similarityScore: number;
  source: string;
  url?: string;
}

// Team Collaboration Types
export interface Team {
  id: string;
  name: string;
  description?: string;
  ownerId: string;
  members: TeamMember[];
  sharedWritingSettings: WritingSettings;
  createdAt: Date;
  updatedAt: Date;
}

export interface TeamMember {
  userId: string;
  email: string;
  displayName?: string;
  role: TeamRole;
  joinedAt: Date;
  status: MemberStatus;
}

export type TeamRole = 'owner' | 'admin' | 'editor' | 'reviewer' | 'viewer';
export type MemberStatus = 'active' | 'pending' | 'inactive';

export interface SharedDocument {
  id: string;
  originalDocumentId: string;
  documentTitle: string;
  teamId: string;
  sharedBy: string;
  permissions: DocumentPermissions;
  sharedAt: Date;
  lastModified: Date;
}

export interface DocumentPermissions {
  canView: boolean;
  canEdit: boolean;
  canComment: boolean;
  canShare: boolean;
}

export interface TeamInvitation {
  id: string;
  teamId: string;
  teamName: string;
  invitedBy: string;
  invitedEmail: string;
  role: TeamRole;
  status: 'pending' | 'accepted' | 'declined' | 'expired';
  createdAt: Date;
  expiresAt: Date;
}

export interface DocumentComment {
  id: string;
  documentId: string;
  userId: string;
  userName: string;
  content: string;
  position: {
    startIndex: number;
    endIndex: number;
  };
  createdAt: Date;
  updatedAt: Date;
  resolved: boolean;
}

export type GrammarSuggestion = {
  id: string;
  type: 'grammar' | 'spelling' | 'style' | 'readability' | 'structure' | 'tone';
  message: string;
  suggestion: string;
  severity: 'high' | 'medium' | 'low' | 'error' | 'warning' | 'suggestion';
  explanation?: string;
  start: number;
  end: number;
  original: string;
  startIndex?: number;
  endIndex?: number;
  originalText?: string;
};

// Research Paper Types
export interface ResearchResult {
  id: string;
  title: string;
  url: string;
  snippet: string;
  source: string;
  publishedDate?: string;
  relevanceScore: number;
  type: 'webpage' | 'article' | 'paper' | 'news';
  tags: string[];
}

export interface ResearchQuery {
  query: string;
  filters?: {
    dateRange?: 'any' | 'past_year' | 'past_month' | 'past_week';
    type?: 'all' | 'academic' | 'news' | 'government';
    language?: string;
  };
  limit?: number;
}

export interface ResearchSearchState {
  results: ResearchResult[];
  isSearching: boolean;
  query: string;
  totalResults: number;
  hasMore: boolean;
  error?: string;
} 
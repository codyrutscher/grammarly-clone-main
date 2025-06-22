import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useDocumentStore } from '../store/useDocumentStore';
import { useAuthStore } from '../store/useAuthStore';
import { useProfileStore } from '../store/useProfileStore';
import { useSuggestionFeedbackStore } from '../store/useSuggestionFeedbackStore';
import { getTextStats } from '../utils/grammarChecker';
import { checkGrammarAndStyle } from '../utils/aiGrammarChecker';
import { createDocument } from '../utils/firebaseUtils';
import type { GrammarSuggestion } from '../store/useDocumentStore';
import type { WritingSettings, Suggestion } from '../types';
import { DocumentSidebar } from './DocumentSidebar';
import { useAutoSave } from '../hooks/useAutoSave';
import { AnalysisPanel } from './AnalysisPanel';
import { VoiceNotesPanel } from './VoiceNotesPanel';
import { PlagiarismPanel } from './PlagiarismPanel';
import { useDarkModeStore } from '../store/useDarkModeStore';
import { ImportExportModal } from './ImportExportModal';

// Helper function to map GrammarSuggestion to Suggestion
const mapGrammarSuggestionToSuggestion = (grammarSuggestion: GrammarSuggestion): Suggestion => {
  return {
    id: grammarSuggestion.id,
    type: grammarSuggestion.type,
    message: grammarSuggestion.message,
    suggestion: grammarSuggestion.suggestion,
    severity: grammarSuggestion.severity,
    explanation: grammarSuggestion.explanation,
    startIndex: grammarSuggestion.startIndex ?? grammarSuggestion.start,
    endIndex: grammarSuggestion.endIndex ?? grammarSuggestion.end,
    originalText: grammarSuggestion.originalText ?? grammarSuggestion.original
  };
};

// Helper function to get cursor offset in plain text
const getCursorOffset = (element: HTMLElement): number => {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return 0;
  
  const range = selection.getRangeAt(0);
  const preCaretRange = range.cloneRange();
  preCaretRange.selectNodeContents(element);
  preCaretRange.setEnd(range.endContainer, range.endOffset);
  
  // Get the text content length
  const div = document.createElement('div');
  div.appendChild(preCaretRange.cloneContents());
  return div.innerText.length;
};

// Helper function to restore cursor position
const restoreCursorPosition = (element: HTMLElement, offset: number): void => {
  const selection = window.getSelection();
  if (!selection) return;
  
  const range = document.createRange();
  let currentOffset = 0;
  
  // Use a more specific type for the result
  const findTextNode = (n: Node, targetOffset: number): { node: Text; offset: number } | null => {
    if (n.nodeType === Node.TEXT_NODE) {
      const textLength = n.textContent?.length || 0;
      if (currentOffset + textLength >= targetOffset) {
        return { node: n as Text, offset: targetOffset - currentOffset };
      }
      currentOffset += textLength;
    } else if (n.nodeType === Node.ELEMENT_NODE) {
      for (let i = 0; i < n.childNodes.length; i++) {
        const result = findTextNode(n.childNodes[i], targetOffset);
        if (result) {
          return result;
        }
      }
    }
    return null;
  };
  
  const result = findTextNode(element, offset);
  
  if (result) {
    try {
      range.setStart(result.node, Math.min(result.offset, result.node.textContent?.length || 0));
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);
    } catch (e) {
      console.warn('Could not restore cursor position:', e);
    }
  }
};

// Function to apply highlights to text with inline styles
const applyHighlights = (text: string, suggestions: Suggestion[], isDarkMode: boolean): string => {
  if (!suggestions || suggestions.length === 0) {
    return text.replace(/\n/g, '<br>');
  }

  // Define inline styles for each suggestion type
  const getInlineStyle = (type: string, isDarkMode: boolean) => {
    const styles = {
      grammar: {
        backgroundColor: isDarkMode ? 'rgba(239, 68, 68, 0.3)' : 'rgba(254, 202, 202, 0.7)',
        borderBottom: `3px solid ${isDarkMode ? '#f87171' : '#ef4444'}`,
        textDecoration: 'underline wavy #ef4444',
        color: 'inherit'
      },
      spelling: {
        backgroundColor: isDarkMode ? 'rgba(239, 68, 68, 0.3)' : 'rgba(254, 202, 202, 0.7)',
        borderBottom: `3px solid ${isDarkMode ? '#f87171' : '#ef4444'}`,
        textDecoration: 'underline wavy #ef4444',
        color: 'inherit'
      },
      style: {
        backgroundColor: isDarkMode ? 'rgba(139, 92, 246, 0.3)' : 'rgba(221, 214, 254, 0.7)',
        borderBottom: `3px solid ${isDarkMode ? '#a78bfa' : '#8b5cf6'}`,
        textDecoration: 'underline wavy #8b5cf6',
        color: 'inherit'
      },
      readability: {
        backgroundColor: isDarkMode ? 'rgba(249, 115, 22, 0.3)' : 'rgba(254, 215, 170, 0.7)',
        borderBottom: `3px solid ${isDarkMode ? '#fb923c' : '#f97316'}`,
        textDecoration: 'underline wavy #f97316',
        color: 'inherit'
      },
      structure: {
        backgroundColor: isDarkMode ? 'rgba(16, 185, 129, 0.3)' : 'rgba(187, 247, 208, 0.7)',
        borderBottom: `3px solid ${isDarkMode ? '#34d399' : '#10b981'}`,
        textDecoration: 'underline wavy #10b981',
        color: 'inherit'
      },
      tone: {
        backgroundColor: isDarkMode ? 'rgba(245, 158, 11, 0.3)' : 'rgba(254, 240, 138, 0.7)',
        borderBottom: `3px solid ${isDarkMode ? '#fbbf24' : '#f59e0b'}`,
        textDecoration: 'underline wavy #f59e0b',
        color: 'inherit'
      }
    };
    
    const style = styles[type as keyof typeof styles] || styles.style;
    return Object.entries(style)
      .map(([key, value]) => `${key.replace(/([A-Z])/g, '-$1').toLowerCase()}: ${value}`)
      .join('; ');
  };

  // Sort suggestions by start position in descending order to avoid index shifting
  const sortedSuggestions = [...suggestions].sort((a, b) => b.startIndex - a.startIndex);
  
  let highlightedText = text;
  
  sortedSuggestions.forEach(suggestion => {
    const start = suggestion.startIndex;
    const end = suggestion.endIndex;
    
    if (start >= 0 && end <= text.length && start < end) {
      const beforeText = highlightedText.slice(0, start);
      const suggestionText = highlightedText.slice(start, end);
      const afterText = highlightedText.slice(end);
      
      // Create a short tooltip text
      const tooltip = suggestion.message.length > 50 
        ? suggestion.message.substring(0, 47) + '...' 
        : suggestion.message;
      
      const inlineStyle = getInlineStyle(suggestion.type, isDarkMode);
      
      highlightedText = `${beforeText}<span class="suggestion-highlight ${suggestion.type}" style="${inlineStyle}; cursor: pointer; position: relative; display: inline-block; padding: 1px 2px; border-radius: 3px;" data-suggestion-id="${suggestion.id}" data-tooltip="${tooltip.replace(/"/g, '&quot;')}">${suggestionText}</span>${afterText}`;
    }
  });
  
  // Replace newlines with <br> tags
  return highlightedText.replace(/\n/g, '<br>');
};

export function TextEditor() {
  const { user } = useAuthStore();
  const { currentDocument, suggestions, setSuggestions, setCurrentDocument, updateDocument, addDocument } = useDocumentStore();
  const { profile } = useProfileStore();
  const { isDarkMode } = useDarkModeStore();
  const [content, setContent] = useState(currentDocument?.content || '');
  const [currentWritingSettings, setCurrentWritingSettings] = useState<WritingSettings>(profile?.writingSettings || {
    academicStyle: 'none',
    languageVariant: 'us',
    checkingMode: 'standard',
    writingMode: 'academic',
    criticalErrorsOnly: false
  });
  const [selectedSuggestion, setSelectedSuggestion] = useState<GrammarSuggestion | null>(null);
  const [showVoiceNotes, setShowVoiceNotes] = useState(false);
  const [showPlagiarism, setShowPlagiarism] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showDocumentSidebar, setShowDocumentSidebar] = useState(false);
  const editorRef = useRef<HTMLDivElement>(null);
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [suggestionsEnabled, setSuggestionsEnabled] = useState(true);
  const [isCreatingDocument, setIsCreatingDocument] = useState(false);
  const [hasGeneratedSuggestions, setHasGeneratedSuggestions] = useState(false);
  const [showImportExport, setShowImportExport] = useState(false);
  const lastAutoSaveTime = useRef<number>(0);
  const currentDocumentId = useRef<string | null>(null);
  const isApplyingHighlights = useRef(false);

  const addFeedback = useSuggestionFeedbackStore(state => state.addFeedback);

  // Check if current document is editable - all shared documents have full access
  const isDocumentEditable = currentDocument && (!currentDocument.isShared || true);
  
  // Debug logging for permissions
  useEffect(() => {
    if (currentDocument) {
      console.log('TextEditor: Current document permissions check:', {
        id: currentDocument.id,
        title: currentDocument.title,
        isShared: currentDocument.isShared,
        isDocumentEditable
      });
    }
  }, [currentDocument, isDocumentEditable]);

  // Update writing settings when profile changes
  useEffect(() => {
    if (profile) {
      setCurrentWritingSettings(profile.writingSettings);
    }
  }, [profile]);

  // AI analysis function - now purely manual
  const analyzeText = useCallback(
    async (text: string) => {
      if (!text || text.trim().length === 0 || !suggestionsEnabled) {
        setSuggestions([]);
        setHasGeneratedSuggestions(false);
        return;
      }

      // Check if API key is configured
      const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
      if (!apiKey || apiKey.trim() === '') {
        console.error('OpenAI API key not configured. Please add VITE_OPENAI_API_KEY to your .env file');
        alert('AI suggestions require an OpenAI API key. Please add VITE_OPENAI_API_KEY to your .env file.');
        setIsAnalyzing(false);
        return;
      }

      setIsAnalyzing(true);
      console.log('Starting manual AI text analysis with settings:', currentWritingSettings);

      try {
        // Add timeout to prevent infinite loading
        const timeoutPromise = new Promise<GrammarSuggestion[]>((_, reject) => {
          setTimeout(() => reject(new Error('Analysis timeout')), 45000); // 45 second timeout
        });

        const analysisPromise = checkGrammarAndStyle(text, currentWritingSettings.writingMode);
        
        const newSuggestions = await Promise.race([analysisPromise, timeoutPromise]);
        
        console.log('AI analysis complete:', newSuggestions.length, 'suggestions');
        
        // Map GrammarSuggestions to Suggestions
        const mappedSuggestions = newSuggestions.map(mapGrammarSuggestionToSuggestion);
        setSuggestions(mappedSuggestions);
        setHasGeneratedSuggestions(true);
      } catch (error) {
        console.error('Error analyzing text:', error);
        
        // Set empty suggestions but mark as generated to show "no issues found" message
        setSuggestions([]);
        setHasGeneratedSuggestions(true);
        
        // Show user-friendly error message
        if (error instanceof Error && error.message === 'Analysis timeout') {
          console.warn('AI analysis timed out - this may be due to network issues or API limitations');
          alert('AI analysis timed out. Please try again.');
        } else {
          console.warn('AI analysis failed - this may be due to API configuration or network issues');
          alert('AI analysis failed. Please check your API key and try again.');
        }
      } finally {
        setIsAnalyzing(false);
      }
    },
    [setSuggestions, suggestionsEnabled, currentWritingSettings]
  );

  // Update content when currentDocument changes
  useEffect(() => {
    if (currentDocument) {
      console.log('📄 Document change detected:', {
        id: currentDocument.id,
        title: currentDocument.title,
        contentPreview: currentDocument.content.substring(0, 100),
        contentLength: currentDocument.content.length,
        previousDocumentId: currentDocumentId.current,
        isNewDocument: currentDocumentId.current !== currentDocument.id
      });
      
      // Check if this is actually a new document
      const isNewDocument = currentDocumentId.current !== currentDocument.id;
      
      // Update the tracked document ID
      currentDocumentId.current = currentDocument.id;
      
      console.log('📝 Setting content:', currentDocument.content);
      setContent(currentDocument.content);
      
              // Update the editor content
        if (editorRef.current) {
          if (suggestions.length > 0 && !isNewDocument) {
            // Apply highlights if there are suggestions
            editorRef.current.innerHTML = applyHighlights(currentDocument.content, suggestions, isDarkMode);
            editorRef.current.classList.add('with-highlights');
          } else {
            // Otherwise, just set the text
            editorRef.current.innerText = currentDocument.content;
            editorRef.current.classList.remove('with-highlights');
          }
        }
      
      // ONLY clear suggestions when switching to a DIFFERENT document
      if (isNewDocument) {
        console.log('📄 NEW DOCUMENT - clearing suggestions');
        setSuggestions([]);
        setHasGeneratedSuggestions(false);
      } else {
        console.log('📄 SAME DOCUMENT UPDATE - preserving suggestions');
      }
    }
  }, [currentDocument, setSuggestions]);

  // Apply highlights when suggestions change
  useEffect(() => {
    if (editorRef.current && content && !isApplyingHighlights.current) {
      isApplyingHighlights.current = true;
      
      // Save cursor position
      const cursorOffset = getCursorOffset(editorRef.current);
      
      if (suggestions.length > 0) {
        // Apply highlights
        const highlightedHTML = applyHighlights(content, suggestions, isDarkMode);
        editorRef.current.innerHTML = highlightedHTML;
        editorRef.current.classList.add('with-highlights');
      } else {
        // Remove highlights
        editorRef.current.innerText = content;
        editorRef.current.classList.remove('with-highlights');
      }
      
      // Restore cursor position
      setTimeout(() => {
        if (editorRef.current) {
          restoreCursorPosition(editorRef.current, cursorOffset);
        }
        isApplyingHighlights.current = false;
      }, 0);
    }
  }, [suggestions, content]);

  const handleCreateNewDocument = async () => {
    if (!user) return;
    
    setIsCreatingDocument(true);
    try {
      const result = await createDocument(user.uid, 'Untitled Document');
      if (result.document) {
        addDocument(result.document);
        setCurrentDocument(result.document);
        setContent('');
      }
    } catch (error) {
      console.error('Error creating document:', error);
    } finally {
      setIsCreatingDocument(false);
    }
  };

  const handleSuggestionClick = (suggestion: Suggestion | GrammarSuggestion) => {
    if (!currentDocument) return;
    
    // Map GrammarSuggestion to Suggestion if needed
    const mappedSuggestion: Suggestion = 'start' in suggestion 
      ? mapGrammarSuggestionToSuggestion(suggestion as GrammarSuggestion)
      : suggestion as Suggestion;
    
    // Apply the suggestion to the content
    const newContent = content.slice(0, mappedSuggestion.startIndex) +
      mappedSuggestion.suggestion +
      content.slice(mappedSuggestion.endIndex);
    
    setContent(newContent);
    updateDocument(currentDocument.id, { content: newContent });
    
    // Remove the applied suggestion and update remaining suggestions
    const remainingSuggestions = suggestions.filter(s => s.id !== mappedSuggestion.id);
    setSuggestions(remainingSuggestions);
    
    // Update the editor with highlighting for remaining suggestions
    if (editorRef.current) {
      if (remainingSuggestions.length > 0) {
        // Update positions of remaining suggestions based on the text change
        const lengthChange = mappedSuggestion.suggestion.length - mappedSuggestion.originalText.length;
        const updatedSuggestions = remainingSuggestions.map(s => {
          if (s.startIndex > mappedSuggestion.endIndex) {
            return {
              ...s,
              startIndex: s.startIndex + lengthChange,
              endIndex: s.endIndex + lengthChange
            };
          }
          return s;
        });
        setSuggestions(updatedSuggestions);
        editorRef.current.innerHTML = applyHighlights(newContent, updatedSuggestions, isDarkMode);
        editorRef.current.classList.add('with-highlights');
      } else {
        editorRef.current.innerText = newContent;
        editorRef.current.classList.remove('with-highlights');
      }
    }
    
    // Add to feedback store
    addFeedback({
      suggestionId: mappedSuggestion.id,
      type: mappedSuggestion.type,
      accepted: true
    });
  };

  const handleSuggestionReject = (suggestion: Suggestion) => {
    // Remove the rejected suggestion
    setSuggestions(suggestions.filter(s => s.id !== suggestion.id));
    
    // Add to feedback store
    addFeedback({
      suggestionId: suggestion.id,
      type: suggestion.type,
      accepted: false
    });
  };

  const handleGenerateNewSuggestions = () => {
    if (content && content.trim().length > 0) {
      console.log('Manually generating new suggestions - clearing existing ones first');
      console.log('Content to analyze:', content);
      console.log('Writing settings:', currentWritingSettings);
      
      // Clear existing suggestions when user explicitly requests new analysis
      setSuggestions([]);
      setHasGeneratedSuggestions(false); // Reset flag to allow new analysis
      analyzeText(content); // Force analysis
    } else {
      console.log('No content to analyze');
    }
  };

  const dismissSuggestion = (suggestionId?: string) => {
    if (suggestionId) {
      // Dismiss specific suggestion
      const updatedSuggestions = suggestions.filter(s => s.id !== suggestionId);
      setSuggestions(updatedSuggestions);
      
      if (selectedSuggestion?.id === suggestionId) {
        setSelectedSuggestion(null);
      }
    } else {
      // Dismiss currently selected suggestion
      setSelectedSuggestion(null);
    }
  };

  const handleInsertTranscript = (transcript: string) => {
    if (transcript.trim()) {
      // Insert transcript at the end of current content
      const newContent = content + (content ? ' ' : '') + transcript;
      setContent(newContent);
      if (editorRef.current) {
        editorRef.current.innerText = newContent;
      }
      // Clear suggestions when new content is added - user must manually regenerate
      setSuggestions([]);
      setHasGeneratedSuggestions(false);
    }
    
    setShowVoiceNotes(false);
  };

  const stats = getTextStats(content);
  const errorCount = suggestions.filter(s => s.type === 'spelling' || s.type === 'grammar').length;
  const suggestionCount = suggestions.filter(s => s.type === 'style' || s.type === 'readability').length;

  // Auto-save functionality with enhanced tracking
  const handleAutoSaveStateChange = useCallback((saving: boolean) => {
    console.log('Auto-save state change:', saving);
    
    if (saving) {
      lastAutoSaveTime.current = Date.now();
    }
  }, []);

  const { saveStatus } = useAutoSave(handleAutoSaveStateChange);
  
  // Log save status for debugging (prevents TypeScript unused variable warning)
  useEffect(() => {
    console.log('Auto-save status:', saveStatus);
  }, [saveStatus]);

  // Debug: Track suggestions changes
  useEffect(() => {
    console.log('🔍 === SUGGESTIONS STATE CHANGE ===');
    console.log('💡 New suggestions state:', {
      count: suggestions.length,
      ids: suggestions.map(s => s.id),
      types: suggestions.map(s => s.type),
      hasGeneratedSuggestions: hasGeneratedSuggestions
    });
    
    if (suggestions.length === 0) {
      console.log('❌ ALL SUGGESTIONS CLEARED! Stack trace:');
      console.trace();
    }
    
    console.log('🔍 === END SUGGESTIONS STATE CHANGE ===\n');
  }, [suggestions, hasGeneratedSuggestions]);

    // Fixed handleInput to work with highlighted text
  const handleInput = (e: React.FormEvent<HTMLDivElement>) => {
    if (!currentDocument || isApplyingHighlights.current) return;
     
    // Get the plain text content (this strips HTML but preserves the actual text)
    const newContent = e.currentTarget.innerText || '';
    
    // Only update if content actually changed
    if (newContent !== content) {
      setContent(newContent);
      updateDocument(currentDocument.id, { content: newContent });
      
      // Clear suggestions when user edits text, as positions may have changed
      if (suggestions.length > 0) {
        setSuggestions([]);
        setHasGeneratedSuggestions(false);
      }
    }
  };

  // Handle click on highlighted suggestions
  useEffect(() => {
    const handleHighlightClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.classList.contains('suggestion-highlight')) {
        const suggestionId = target.getAttribute('data-suggestion-id');
        if (suggestionId) {
          const suggestion = suggestions.find(s => s.id === suggestionId);
          if (suggestion) {
            // Convert Suggestion to GrammarSuggestion format
            const grammarSuggestion: GrammarSuggestion = {
              id: suggestion.id,
              type: suggestion.type,
              start: suggestion.startIndex,
              end: suggestion.endIndex,
              original: suggestion.originalText,
              originalText: suggestion.originalText,
              suggestion: suggestion.suggestion,
              message: suggestion.message,
              explanation: suggestion.explanation,
              severity: suggestion.severity,
              startIndex: suggestion.startIndex,
              endIndex: suggestion.endIndex
            };
            setSelectedSuggestion(grammarSuggestion);
          }
        }
      }
    };

    const editor = editorRef.current;
    if (editor) {
      editor.addEventListener('click', handleHighlightClick);
      return () => {
        editor.removeEventListener('click', handleHighlightClick);
      };
    }
  }, [suggestions]);

  // Handle key press events for better control
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    // Handle Tab key
    if (e.key === 'Tab') {
      e.preventDefault();
      document.execCommand('insertText', false, '\t');
    }
    // Don't prevent default for Enter or Space - let them work naturally
  };

  // Handle paste to maintain plain text
  const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    document.execCommand('insertText', false, text);
  };

  const handleBlur = () => {
    // Save content on blur
    if (currentDocument && content !== currentDocument.content) {
      updateDocument(currentDocument.id, { content });
    }
  };

  const handleImportContent = (importedContent: string) => {
    if (!currentDocument) return;
    
    setContent(importedContent);
    if (editorRef.current) {
      editorRef.current.innerText = importedContent;
    }
    updateDocument(currentDocument.id, { content: importedContent });
    
    // Clear suggestions for new content
    setSuggestions([]);
    setHasGeneratedSuggestions(false);
  };

  const renderSuggestionsByType = (type: Suggestion['type']) => {
    const typeStyles = {
      grammar: { 
        bg: isDarkMode ? 'bg-red-900/20' : 'bg-red-50', 
        border: isDarkMode ? 'border-red-700' : 'border-red-300',
        text: isDarkMode ? 'text-red-300' : 'text-red-700',
        icon: '🔴'
      },
      spelling: { 
        bg: isDarkMode ? 'bg-blue-900/20' : 'bg-blue-50', 
        border: isDarkMode ? 'border-blue-700' : 'border-blue-300',
        text: isDarkMode ? 'text-blue-300' : 'text-blue-700',
        icon: '🔵'
      },
      style: { 
        bg: isDarkMode ? 'bg-purple-900/20' : 'bg-purple-50', 
        border: isDarkMode ? 'border-purple-700' : 'border-purple-300',
        text: isDarkMode ? 'text-purple-300' : 'text-purple-700',
        icon: '🟣'
      },
      readability: { 
        bg: isDarkMode ? 'bg-orange-900/20' : 'bg-orange-50', 
        border: isDarkMode ? 'border-orange-700' : 'border-orange-300',
        text: isDarkMode ? 'text-orange-300' : 'text-orange-700',
        icon: '🟠'
      },
      structure: { 
        bg: isDarkMode ? 'bg-green-900/20' : 'bg-green-50', 
        border: isDarkMode ? 'border-green-700' : 'border-green-300',
        text: isDarkMode ? 'text-green-300' : 'text-green-700',
        icon: '🟢'
      },
      tone: { 
        bg: isDarkMode ? 'bg-yellow-900/20' : 'bg-yellow-50', 
        border: isDarkMode ? 'border-yellow-700' : 'border-yellow-300',
        text: isDarkMode ? 'text-yellow-300' : 'text-yellow-700',
        icon: '🟡'
      }
    };

    const style = typeStyles[type] || typeStyles.style;

    return suggestions
      .filter(s => s.type === type)
      .map(suggestion => (
        <div
          key={suggestion.id}
          className={`group p-4 rounded-lg border-2 transition-all duration-200 cursor-pointer ${style.bg} ${style.border} hover:shadow-md hover:scale-[1.02]`}
        >
          <div className="flex items-start gap-3">
            <span className="text-lg mt-0.5">{style.icon}</span>
            <div className="flex-1">
              <div className={`font-medium text-sm mb-2 ${style.text}`}>
                {type.charAt(0).toUpperCase() + type.slice(1)} Issue
              </div>
              
              {/* Original vs Suggested text */}
              <div className={`space-y-2 mb-3 p-3 rounded-md ${isDarkMode ? 'bg-gray-800/50' : 'bg-white/50'}`}>
                <div className="flex items-start gap-2">
                  <span className={`text-xs font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-500'} min-w-[60px]`}>Original:</span>
                  <span className={`text-sm line-through ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    {suggestion.originalText}
                  </span>
                </div>
                <div className="flex items-start gap-2">
                  <span className={`text-xs font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-500'} min-w-[60px]`}>Suggested:</span>
                  <span className={`text-sm font-medium ${isDarkMode ? 'text-green-400' : 'text-green-700'}`}>
                    {suggestion.suggestion}
                  </span>
                </div>
              </div>
              
              {/* Explanation */}
              <p className={`text-xs mb-3 ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                {suggestion.explanation}
              </p>
              
              {/* Action buttons */}
              <div className="flex gap-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSuggestionClick(suggestion);
                  }}
                  className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                    isDarkMode 
                      ? 'bg-green-600 text-white hover:bg-green-700' 
                      : 'bg-green-600 text-white hover:bg-green-700'
                  }`}
                >
                  ✓ Fix It
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSuggestionReject(suggestion);
                  }}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                    isDarkMode 
                      ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' 
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        </div>
      ));
  };

  // If no document is selected, show the "Create New Document" interface
  if (!currentDocument) {
    return (
      <div className={`flex h-full ${isDarkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
        {/* Document Sidebar */}
        {showDocumentSidebar && (
          <div className="w-80 flex-shrink-0">
            <DocumentSidebar />
          </div>
        )}
        
        <div className={`flex-1 flex items-center justify-center transition-colors`}>
          <div className="text-center max-w-md mx-auto p-8">
            <div className={`w-24 h-24 mx-auto rounded-full bg-gradient-to-br from-blue-100 to-purple-100 flex items-center justify-center mb-6 border-4 ${
              isDarkMode ? 'border-gray-600' : 'border-gray-200'
            }`}>
              <span className="text-4xl">📝</span>
            </div>
            
            <h2 className={`text-2xl font-bold mb-4 transition-colors ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
              Ready to start writing?
            </h2>
            
            <p className={`text-lg mb-8 transition-colors ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
              Create your first document to begin writing with AI-powered assistance.
            </p>
            
            <button
              onClick={handleCreateNewDocument}
              disabled={isCreatingDocument}
              className="bg-gradient-to-r from-blue-500 to-purple-600 text-white px-8 py-4 rounded-xl text-lg font-semibold transition-all duration-300 hover:shadow-xl hover:shadow-blue-500/25 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
            >
              {isCreatingDocument ? (
                <div className="flex items-center gap-3">
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                  <span>Creating...</span>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <span>📄 Create New Document</span>
                  <svg className="w-5 h-5 transition-transform duration-300 group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </div>
              )}
            </button>
            
            <div className={`mt-6 text-sm transition-colors ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
              Or select an existing document from the sidebar
            </div>
            
          
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full">
      {/* Document Sidebar */}
      {showDocumentSidebar && (
        <div className="w-80 flex-shrink-0">
          <DocumentSidebar />
        </div>
      )}
      
      <div className={`flex-1 relative overflow-x-auto ${showAnalysis ? 'border-r border-gray-200 dark:border-gray-700' : ''}`}>
        <div className={`h-full flex transition-colors ${isDarkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
          {/* Main Editor Area */}
          <div className="flex-1 flex flex-col min-w-0">
            {/* Editor Header */}
            <div className={`border-b shadow-sm transition-colors duration-300 ${
              isDarkMode 
                ? 'bg-gray-800 border-gray-700' 
                : 'bg-white border-gray-200'
            }`}>
              {/* First Row - Main Controls */}
              <div className="flex items-center justify-between p-4">
                <div className="flex items-center space-x-4">
                  <h2 className={`text-lg font-semibold transition-colors ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>✍️ Document Editor</h2>
                  
                  {/* Writing Settings Display */}
                  <div className="flex items-center space-x-2 text-xs">
                    <div className={`flex items-center space-x-1 px-2 py-1 rounded-md transition-colors ${
                      isDarkMode 
                        ? 'bg-indigo-900/50 text-indigo-300' 
                        : 'bg-indigo-50 text-indigo-700'
                    }`}>
                      <span>📚</span>
                      <span>{currentWritingSettings.academicStyle === 'none' ? 'General' : currentWritingSettings.academicStyle.toUpperCase()}</span>
                    </div>
                    <div className={`flex items-center space-x-1 px-2 py-1 rounded-md transition-colors ${
                      isDarkMode 
                        ? 'bg-blue-900/50 text-blue-300' 
                        : 'bg-blue-50 text-blue-700'
                    }`}>
                      <span>🌍</span>
                      <span>{currentWritingSettings.languageVariant.toUpperCase()}</span>
                    </div>
                    <div className={`flex items-center space-x-1 px-2 py-1 rounded-md transition-colors ${
                      isDarkMode 
                        ? 'bg-green-900/50 text-green-300' 
                        : 'bg-green-50 text-green-700'
                    }`}>
                      <span>{currentWritingSettings.checkingMode === 'speed' ? '⚡' : currentWritingSettings.checkingMode === 'comprehensive' ? '🔍' : '⚖️'}</span>
                      <span>{currentWritingSettings.checkingMode === 'comprehensive' ? 'Thorough' : currentWritingSettings.checkingMode}</span>
                    </div>
                  </div>
                  
                  <div className={`flex items-center space-x-2 text-sm transition-colors ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                    {errorCount > 0 && (
                      <span className={`px-3 py-1 rounded-full font-medium transition-colors ${
                        isDarkMode 
                          ? 'bg-red-900/50 text-red-300' 
                          : 'bg-red-100 text-red-700'
                      }`}>
                        {errorCount} error{errorCount !== 1 ? 's' : ''}
                      </span>
                    )}
                    {suggestionCount > 0 && (
                      <span className={`px-3 py-1 rounded-full font-medium transition-colors ${
                        isDarkMode 
                          ? 'bg-blue-900/50 text-blue-300' 
                          : 'bg-blue-100 text-blue-700'
                      }`}>
                        {suggestionCount} suggestion{suggestionCount !== 1 ? 's' : ''}
                      </span>
                    )}
                    {errorCount === 0 && suggestionCount === 0 && content.trim() && hasGeneratedSuggestions && (
                      <span className={`px-3 py-1 rounded-full font-medium transition-colors ${
                        isDarkMode 
                          ? 'bg-green-900/50 text-green-300' 
                          : 'bg-green-100 text-green-700'
                      }`}>
                        ✓ No issues found
                      </span>
                    )}
                    {isAnalyzing && (
                      <span className={`flex items-center px-3 py-1 rounded-full font-medium transition-colors ${
                        isDarkMode 
                          ? 'bg-yellow-900/50 text-yellow-300' 
                          : 'bg-yellow-100 text-yellow-700'
                      }`}>
                        <div className={`animate-spin rounded-full h-3 w-3 border-2 border-t-transparent mr-2 ${
                          isDarkMode ? 'border-yellow-300' : 'border-yellow-600'
                        }`}></div>
                        Analyzing...
                      </span>
                    )}
                  </div>
                </div>
                
                {/* AI Suggestions Toggle - Always Visible */}
                <div className="flex items-center space-x-6">
                  {/* Generate Suggestions Button */}
                  {suggestionsEnabled && content.trim() && (
                    <button
                      onClick={handleGenerateNewSuggestions}
                      disabled={isAnalyzing}
                      className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                        isAnalyzing
                          ? isDarkMode 
                            ? 'bg-gray-600 text-gray-300' 
                            : 'bg-gray-300 text-gray-600'
                          : 'bg-blue-600 text-white hover:bg-blue-700'
                      }`}
                      title="Generate AI writing suggestions"
                    >
                      {isAnalyzing ? (
                        <span className="flex items-center">
                          <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
                          Analyzing...
                        </span>
                      ) : (
                        <span className="flex items-center">
                          <span className="mr-2">✨</span>
                          Get AI Suggestions
                        </span>
                      )}
                    </button>
                  )}
                  
                  {/* AI Suggestions Toggle */}
                  <div className="flex items-center space-x-3">
                    <span className={`text-sm transition-colors ${
                      !suggestionsEnabled 
                        ? isDarkMode ? 'text-white font-medium' : 'text-gray-900 font-medium'
                        : isDarkMode ? 'text-gray-400' : 'text-gray-500'
                    }`}>
                      Off
                    </span>
                    <button
                      onClick={() => setSuggestionsEnabled(!suggestionsEnabled)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                        isDarkMode ? 'focus:ring-offset-gray-800' : 'focus:ring-offset-white'
                      } ${
                        suggestionsEnabled ? 'bg-blue-600' : isDarkMode ? 'bg-gray-600' : 'bg-gray-200'
                      }`}
                      title={`Turn AI suggestions ${suggestionsEnabled ? 'off' : 'on'}`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          suggestionsEnabled ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                    <span className={`text-sm transition-colors ${
                      suggestionsEnabled 
                        ? isDarkMode ? 'text-white font-medium' : 'text-gray-900 font-medium'
                        : isDarkMode ? 'text-gray-400' : 'text-gray-500'
                    }`}>
                      🤖 AI Mode
                    </span>
                  </div>
                </div>
              </div>
              
              {/* Second Row - Additional Tools */}
              <div className={`px-4 pb-4 border-t transition-colors ${
                isDarkMode ? 'border-gray-600' : 'border-gray-100'
              }`}>
                <div className="flex items-center justify-center space-x-4 pt-2">
                  <button
                    onClick={() => setShowDocumentSidebar(!showDocumentSidebar)}
                    className={`px-4 py-2 text-sm border rounded-lg font-medium transition-colors ${
                      showDocumentSidebar
                        ? isDarkMode 
                          ? 'bg-gray-700 border-gray-500 text-white' 
                          : 'bg-gray-100 border-gray-400 text-gray-900'
                        : isDarkMode 
                          ? 'border-gray-600 text-gray-300 hover:bg-gray-700 hover:border-gray-500' 
                          : 'border-gray-300 text-gray-700 hover:bg-gray-50 hover:border-gray-400'
                    }`}
                  >
                    📁 Documents
                  </button>
                  
                  <button
                    onClick={() => setShowStats(!showStats)}
                    className={`px-4 py-2 text-sm border rounded-lg font-medium transition-colors ${
                      isDarkMode 
                        ? 'border-gray-600 text-gray-300 hover:bg-gray-700 hover:border-gray-500' 
                        : 'border-gray-300 text-gray-700 hover:bg-gray-50 hover:border-gray-400'
                    }`}
                  >
                    📊 Stats
                  </button>
                  
                  <button
                    onClick={() => setShowVoiceNotes(true)}
                    className={`px-4 py-2 text-sm border rounded-lg font-medium transition-colors ${
                      isDarkMode 
                        ? 'border-gray-600 text-gray-300 hover:bg-gray-700 hover:border-gray-500' 
                        : 'border-gray-300 text-gray-700 hover:bg-gray-50 hover:border-gray-400'
                    }`}
                    title="Voice Notes & Speech-to-Text"
                  >
                    🎤 Voice Notes
                  </button>
                  
                  <button
                    onClick={() => setShowPlagiarism(true)}
                    className={`px-4 py-2 text-sm border rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                      isDarkMode 
                        ? 'border-gray-600 text-gray-300 hover:bg-gray-700 hover:border-gray-500 disabled:hover:bg-transparent disabled:hover:border-gray-600' 
                        : 'border-gray-300 text-gray-700 hover:bg-gray-50 hover:border-gray-400 disabled:hover:bg-transparent disabled:hover:border-gray-300'
                    }`}
                    title="Check for Plagiarism"
                    disabled={!content.trim()}
                  >
                    🔍 Plagiarism Check
                  </button>
                  
                 
                  
                  <button
                    onClick={() => setShowImportExport(true)}
                    className={`px-4 py-2 text-sm border rounded-lg font-medium transition-colors ${
                      isDarkMode 
                        ? 'border-gray-600 text-gray-300 hover:bg-gray-700 hover:border-gray-500' 
                        : 'border-gray-300 text-gray-700 hover:bg-gray-50 hover:border-gray-400'
                    }`}
                    title="Import/Export Document"
                  >
                    📤 Import/Export
                  </button>
                </div>
              </div>
            </div>

            {/* Stats Panel */}
            {showStats && (
              <div className={`p-6 border-b shadow-sm transition-colors ${
                isDarkMode 
                  ? 'bg-gray-800 border-gray-700' 
                  : 'bg-white border-gray-200'
              }`}>
                <div className="grid grid-cols-2 md:grid-cols-6 gap-6 text-sm">
                  <div className={`text-center p-3 rounded-lg transition-colors ${
                    isDarkMode ? 'bg-blue-900/30' : 'bg-blue-50'
                  }`}>
                    <div className={`text-2xl font-bold transition-colors ${
                      isDarkMode ? 'text-blue-300' : 'text-blue-600'
                    }`}>{stats.words}</div>
                    <div className={`font-medium transition-colors ${
                      isDarkMode ? 'text-blue-400' : 'text-blue-700'
                    }`}>Words</div>
                  </div>
                  <div className={`text-center p-3 rounded-lg transition-colors ${
                    isDarkMode ? 'bg-green-900/30' : 'bg-green-50'
                  }`}>
                    <div className={`text-2xl font-bold transition-colors ${
                      isDarkMode ? 'text-green-300' : 'text-green-600'
                    }`}>{stats.characters}</div>
                    <div className={`font-medium transition-colors ${
                      isDarkMode ? 'text-green-400' : 'text-green-700'
                    }`}>Characters</div>
                  </div>
                  <div className={`text-center p-3 rounded-lg transition-colors ${
                    isDarkMode ? 'bg-purple-900/30' : 'bg-purple-50'
                  }`}>
                    <div className={`text-2xl font-bold transition-colors ${
                      isDarkMode ? 'text-purple-300' : 'text-purple-600'
                    }`}>{stats.sentences}</div>
                    <div className={`font-medium transition-colors ${
                      isDarkMode ? 'text-purple-400' : 'text-purple-700'
                    }`}>Sentences</div>
                  </div>
                  <div className={`text-center p-3 rounded-lg transition-colors ${
                    isDarkMode ? 'bg-orange-900/30' : 'bg-orange-50'
                  }`}>
                    <div className={`text-2xl font-bold transition-colors ${
                      isDarkMode ? 'text-orange-300' : 'text-orange-600'
                    }`}>{stats.paragraphs}</div>
                    <div className={`font-medium transition-colors ${
                      isDarkMode ? 'text-orange-400' : 'text-orange-700'
                    }`}>Paragraphs</div>
                  </div>
                  <div className={`text-center p-3 rounded-lg transition-colors ${
                    isDarkMode ? 'bg-indigo-900/30' : 'bg-indigo-50'
                  }`}>
                    <div className={`text-2xl font-bold transition-colors ${
                      isDarkMode ? 'text-indigo-300' : 'text-indigo-600'
                    }`}>{stats.avgWordsPerSentence}</div>
                    <div className={`font-medium transition-colors ${
                      isDarkMode ? 'text-indigo-400' : 'text-indigo-700'
                    }`}>Avg Words/Sentence</div>
                  </div>
                  <div className={`text-center p-3 rounded-lg transition-colors ${
                    isDarkMode ? 'bg-pink-900/30' : 'bg-pink-50'
                  }`}>
                    <div className={`text-2xl font-bold transition-colors ${
                      isDarkMode ? 'text-pink-300' : 'text-pink-600'
                    }`}>{stats.readabilityScore}</div>
                    <div className={`font-medium transition-colors ${
                      isDarkMode ? 'text-pink-400' : 'text-pink-700'
                    }`}>Readability</div>
                  </div>
                </div>
              </div>
            )}

            {/* Editor Container */}
            <div className="flex-1 p-6">
              <div className="relative">
                {/* Plain Text Editor with Highlighting Support */}
                <div
                  className={`w-full min-h-screen p-6 focus:outline-none text-editor ${
                    isDarkMode ? 'dark' : ''
                  }`}
                  contentEditable={isDocumentEditable ? "true" : "false"}
                  ref={editorRef}
                  onInput={handleInput}
                  onKeyDown={handleKeyDown}
                  onPaste={handlePaste}
                  onBlur={handleBlur}
                  suppressContentEditableWarning
                  style={{
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    lineHeight: '1.6',
                    fontSize: '16px',
                    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                    minHeight: '100vh',
                    caretColor: isDarkMode ? '#fff' : '#000'
                  }}
                />

                {/* Read-only indicator */}
                {!isDocumentEditable && currentDocument?.isShared && (
                  <div className={`absolute top-4 right-4 px-3 py-1 rounded-full text-xs font-medium transition-colors z-30 ${
                    isDarkMode 
                      ? 'bg-yellow-900/50 text-yellow-300 border border-yellow-700' 
                      : 'bg-yellow-100 text-yellow-800 border border-yellow-300'
                  }`}>
                    👁️ Read-only
                  </div>
                )}
              </div>
            </div>

            {/* Suggestion Popup */}
            {selectedSuggestion && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div className={`rounded-xl shadow-2xl p-6 w-96 max-w-90vw transition-colors ${
                  isDarkMode ? 'bg-gray-800' : 'bg-white'
                }`}>
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center space-x-3">
                      <div className={`w-4 h-4 rounded-full ${
                        selectedSuggestion.type === 'spelling' || selectedSuggestion.type === 'grammar' 
                          ? 'bg-red-500' 
                          : selectedSuggestion.type === 'style' 
                          ? 'bg-blue-500' 
                          : 'bg-orange-500'
                      }`} />
                      <span className={`text-lg font-semibold capitalize transition-colors ${
                        isDarkMode ? 'text-white' : 'text-gray-800'
                      }`}>
                        {selectedSuggestion.type} Suggestion
                      </span>
                    </div>
                    <button
                      onClick={() => dismissSuggestion()}
                      className={`text-xl transition-colors ${
                        isDarkMode ? 'text-gray-400 hover:text-gray-200' : 'text-gray-400 hover:text-gray-600'
                      }`}
                    >
                      ×
                    </button>
                  </div>
                  
                  <p className={`mb-4 leading-relaxed transition-colors ${
                    isDarkMode ? 'text-gray-300' : 'text-gray-700'
                  }`}>
                    {selectedSuggestion.message}
                  </p>
                  
                  <div className="space-y-3 mb-4">
                    <div>
                      <div className={`text-xs font-medium mb-1 transition-colors ${
                        isDarkMode ? 'text-gray-400' : 'text-gray-500'
                      }`}>Current text:</div>
                      <div className={`p-3 border-l-4 border-red-400 rounded text-sm transition-colors ${
                        isDarkMode ? 'bg-red-900/20' : 'bg-red-50'
                      }`}>
                        "{selectedSuggestion.original}"
                      </div>
                    </div>
                    
                    {selectedSuggestion.suggestion && selectedSuggestion.suggestion !== selectedSuggestion.original && (
                      <div>
                        <div className={`text-xs font-medium mb-1 transition-colors ${
                          isDarkMode ? 'text-gray-400' : 'text-gray-500'
                        }`}>Suggested improvement:</div>
                        <div className={`p-3 border-l-4 border-green-400 rounded text-sm transition-colors ${
                          isDarkMode ? 'bg-green-900/20' : 'bg-green-50'
                        }`}>
                          "{selectedSuggestion.suggestion}"
                        </div>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex space-x-3">
                    {selectedSuggestion.suggestion && 
                     selectedSuggestion.suggestion !== selectedSuggestion.original && 
                     !selectedSuggestion.suggestion.toLowerCase().includes('consider') &&
                     !selectedSuggestion.suggestion.toLowerCase().includes('try to') &&
                     !selectedSuggestion.suggestion.toLowerCase().includes('you might') &&
                     !(selectedSuggestion.suggestion.startsWith('[') && selectedSuggestion.suggestion.endsWith(']')) ? (
                      <button
                        onClick={(e) => {
                          console.log('Apply button clicked in modal!', e);
                          handleSuggestionClick(selectedSuggestion);
                        }}
                        disabled={!isDocumentEditable}
                        className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                          isDarkMode 
                            ? 'bg-green-600 text-white hover:bg-green-700 disabled:hover:bg-green-600' 
                            : 'bg-grammarly-green text-white hover:bg-green-600 disabled:hover:bg-grammarly-green'
                        }`}
                      >
                        ✅ Apply Suggestion
                      </button>
                    ) : (
                      <div className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium text-center transition-colors ${
                        isDarkMode ? 'bg-gray-700 text-gray-400' : 'bg-gray-100 text-gray-500'
                      }`}>
                        ℹ️ Advisory Only
                      </div>
                    )}
                    <button
                      onClick={() => dismissSuggestion(selectedSuggestion.id)}
                      className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
                        isDarkMode 
                          ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' 
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {selectedSuggestion.suggestion && selectedSuggestion.suggestion !== selectedSuggestion.original ? 'Ignore' : 'Dismiss'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
          
          {/* Suggestions Sidebar */}
        <div className={`w-80 border-l-2 flex flex-col shadow-xl transition-colors flex-shrink-0 ${
          isDarkMode 
            ? 'bg-gray-800 border-gray-600' 
            : 'bg-white border-gray-300'
        }`}>
          <div className={`p-4 border-b-2 transition-colors ${
            isDarkMode 
              ? 'border-gray-600 bg-gray-700/50' 
              : 'border-gray-300 bg-gray-50/50'
          }`}>
            <div className={`p-3 rounded-lg border ${
              isDarkMode ? 'border-gray-600 bg-gray-700/30' : 'border-gray-200 bg-white/50'
            }`}>
              <div className="flex items-center justify-between">
                <h3 className={`text-lg font-semibold flex items-center transition-colors ${
                  isDarkMode ? 'text-white' : 'text-gray-700'
                }`}>
                  <span className="text-xl mr-2">🤖</span>
                  AI Writing Assistant
                </h3>
                
                {suggestionsEnabled && content && content.trim().length > 0 && (
                  <button
                    onClick={handleGenerateNewSuggestions}
                    disabled={isAnalyzing}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                      isDarkMode 
                        ? 'bg-blue-600 text-white hover:bg-blue-700 disabled:hover:bg-blue-600 border-blue-500' 
                        : 'bg-blue-600 text-white hover:bg-blue-700 disabled:hover:bg-blue-600 border-blue-400'
                    }`}
                    title="Generate new AI suggestions for current text"
                  >
                    {isAnalyzing ? '⏳ Analyzing...' : '✨ Generate Suggestions'}
                  </button>
                )}
              </div>
              
              {!suggestionsEnabled && (
                <div className={`mt-3 p-3 rounded-lg border transition-colors ${
                  isDarkMode 
                    ? 'bg-yellow-900/30 border-yellow-600' 
                    : 'bg-yellow-50 border-yellow-200'
                }`}>
                  <p className={`text-sm transition-colors ${
                    isDarkMode ? 'text-yellow-300' : 'text-yellow-700'
                  }`}>
                    AI suggestions are turned off. Enable them to get real-time writing assistance.
                  </p>
                </div>
              )}
            </div>
          </div>
          
          {!suggestionsEnabled ? (
            <div className="flex-1 flex items-center justify-center p-8">
              <div className={`text-center p-6 rounded-lg border transition-colors ${
                isDarkMode ? 'text-gray-400 border-gray-600 bg-gray-700/30' : 'text-gray-500 border-gray-200 bg-gray-50'
              }`}>
                <div className="text-4xl mb-3">🤖</div>
                <p className="text-sm mb-2">AI suggestions are disabled</p>
                <p className={`text-xs transition-colors ${
                  isDarkMode ? 'text-gray-500' : 'text-gray-400'
                }`}>Turn on AI suggestions to get smart writing assistance</p>
              </div>
            </div>
          ) : suggestions.length === 0 ? (
            <div className="flex-1 flex items-center justify-center p-8">
              <div className={`text-center p-6 rounded-lg border transition-colors ${
                isDarkMode ? 'text-gray-400 border-gray-600 bg-gray-700/30' : 'text-gray-500 border-gray-200 bg-gray-50'
              }`}>
                <div className="text-4xl mb-3">✨</div>
                <p className="text-sm mb-2">
                  {content.trim() 
                    ? hasGeneratedSuggestions 
                      ? 'Great writing!' 
                      : isAnalyzing 
                        ? 'Analyzing your text...' 
                        : 'Ready to analyze your text'
                    : 'Start typing to get AI suggestions'
                  }
                </p>
                <p className={`text-xs mb-4 transition-colors ${
                  isDarkMode ? 'text-gray-500' : 'text-gray-400'
                }`}>
                  {content.trim() 
                    ? hasGeneratedSuggestions 
                      ? 'No improvements needed' 
                      : 'AI will provide writing suggestions and improvements'
                    : 'AI will analyze your text as you write'
                  }
                </p>
                {content.trim() && !hasGeneratedSuggestions && !isAnalyzing && (
                  <button
                    onClick={handleGenerateNewSuggestions}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                  >
                    ✨ Generate AI Suggestions
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto p-4 space-y-3 max-h-96 lg:max-h-none">
              {renderSuggestionsByType('grammar')}
              {renderSuggestionsByType('spelling')}
              {renderSuggestionsByType('style')}
              {renderSuggestionsByType('readability')}
              {renderSuggestionsByType('structure')}
              {renderSuggestionsByType('tone')}
            </div>
          )}
        </div>
        </div>
      </div>
      
      {/* Voice Notes Modal */}
      {showVoiceNotes && (
        <VoiceNotesPanel
          onInsertTranscript={handleInsertTranscript}
          onClose={() => setShowVoiceNotes(false)}
        />
      )}
      
      {/* Plagiarism Check Modal */}
      {showPlagiarism && (
        <PlagiarismPanel text={content} onClose={() => setShowPlagiarism(false)} />
      )}

      {/* Analysis Panel */}
      {showAnalysis && currentDocument && (
        <AnalysisPanel
          isOpen={showAnalysis}
          onClose={() => setShowAnalysis(false)}
        />
      )}
      
      {/* Import/Export Modal */}
      {showImportExport && (
        <ImportExportModal
          content={content}
          documentTitle={currentDocument?.title || 'Untitled'}
          onImport={handleImportContent}
          onClose={() => setShowImportExport(false)}
        />
      )}
    </div>
  );
}
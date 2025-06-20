import type { GrammarSuggestion as StoreGrammarSuggestion } from '../store/useDocumentStore';
import type { WritingModeType, WritingSettings, WritingMode } from '../types';
import { useSuggestionFeedbackStore } from '../store/useSuggestionFeedbackStore';

const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY;

interface OpenAISuggestion {
  original: string;
  suggestion: string;
  reason: string;
  type: 'grammar' | 'spelling' | 'style' | 'readability';
  severity: 'low' | 'medium' | 'high';
  start_pos: number;
  end_pos: number;
}

// Use the store's GrammarSuggestion type and extend it if needed
export type GrammarSuggestion = StoreGrammarSuggestion;

const modeInstructions: Record<WritingModeType, string> = {
  academic: 'Use academic writing style with formal language and proper citations.',
  business: 'Use professional business writing style with clear and concise language.',
  creative: 'Use creative writing style with expressive and engaging language.',
  technical: 'Use technical writing style with precise terminology and clear structure.',
  casual: 'Use casual writing style with informal language and natural flow.'
};

// Default writing modes for type checking
const defaultWritingModes: Record<WritingModeType, WritingMode> = {
  academic: {
    id: 'academic',
    name: 'Academic Writing',
    description: 'Formal academic style',
    rules: {
      tone: { formality: 'formal', emotion: 'objective' },
      style: { sentenceLength: 'medium', vocabulary: 'advanced', allowPassiveVoice: true, technicalTerms: true },
      structure: { paragraphLength: 'medium', requireTopicSentences: true, requireTransitions: true },
      citations: { required: true, style: 'APA' }
    }
  },
  business: {
    id: 'business',
    name: 'Business Writing',
    description: 'Professional business communication',
    rules: {
      tone: { formality: 'formal', emotion: 'persuasive' },
      style: { sentenceLength: 'short', vocabulary: 'moderate', allowPassiveVoice: false, technicalTerms: true },
      structure: { paragraphLength: 'short', requireTopicSentences: true, requireTransitions: true },
      citations: { required: false, style: 'none' }
    }
  },
  creative: {
    id: 'creative',
    name: 'Creative Writing',
    description: 'Artistic and expressive style',
    rules: {
      tone: { formality: 'casual', emotion: 'engaging' },
      style: { sentenceLength: 'long', vocabulary: 'advanced', allowPassiveVoice: true, technicalTerms: false },
      structure: { paragraphLength: 'long', requireTopicSentences: false, requireTransitions: true },
      citations: { required: false, style: 'none' }
    }
  },
  technical: {
    id: 'technical',
    name: 'Technical Writing',
    description: 'Clear technical documentation',
    rules: {
      tone: { formality: 'neutral', emotion: 'objective' },
      style: { sentenceLength: 'short', vocabulary: 'advanced', allowPassiveVoice: false, technicalTerms: true },
      structure: { paragraphLength: 'short', requireTopicSentences: true, requireTransitions: true },
      citations: { required: false, style: 'none' }
    }
  },
  casual: {
    id: 'casual',
    name: 'Casual Writing',
    description: 'Informal conversational style',
    rules: {
      tone: { formality: 'casual', emotion: 'engaging' },
      style: { sentenceLength: 'medium', vocabulary: 'simple', allowPassiveVoice: true, technicalTerms: false },
      structure: { paragraphLength: 'medium', requireTopicSentences: false, requireTransitions: false },
      citations: { required: false, style: 'none' }
    }
  }
};

// Generate system prompt based on writing settings
function generateSystemPrompt(settings: WritingSettings): string {
  let basePrompt = `You are an expert writing assistant. Analyze the provided text and identify specific writing improvements.`;

  // Add user feedback context
  const feedbackStats = useSuggestionFeedbackStore.getState().getFeedbackStats();
  
  if (feedbackStats.commonAccepted.length > 0 || feedbackStats.commonRejected.length > 0) {
    basePrompt += `\n\nBased on this user's history:`;
    
    if (feedbackStats.commonAccepted.length > 0) {
      basePrompt += `\nThey typically accept suggestions like: ${feedbackStats.commonAccepted.slice(0, 5).join(', ')}`;
    }
    
    if (feedbackStats.commonRejected.length > 0) {
      basePrompt += `\nThey typically reject suggestions like: ${feedbackStats.commonRejected.slice(0, 5).join(', ')}`;
    }
    
    // Add acceptance rates by type
    const rates = feedbackStats.acceptanceRate;
    if (Object.keys(rates).length > 0) {
      basePrompt += `\n\nSuggestion acceptance rates by type:`;
      Object.entries(rates).forEach(([type, rate]) => {
        basePrompt += `\n- ${type}: ${Math.round(rate)}%`;
      });
      
      // Adjust suggestion strategy based on acceptance rates
      const highAcceptanceTypes = Object.entries(rates)
        .filter(([, rate]) => rate > 70)
        .map(([type]) => type);
        
      if (highAcceptanceTypes.length > 0) {
        basePrompt += `\n\nPrioritize suggestions of types: ${highAcceptanceTypes.join(', ')} as they are more likely to be helpful to this user.`;
      }
    }
  }

  // Add language variant specific instructions
  const languageInstructions = {
    us: "Use American English spelling (e.g., 'color', 'organize', 'analyze').",
    uk: "Use British English spelling (e.g., 'colour', 'organise', 'analyse').",
    au: "Use Australian English spelling and conventions.",
    ca: "Use Canadian English spelling and conventions."
  };

  // Add academic style specific instructions
  const academicInstructions = {
    mla: "Follow MLA style guidelines: use present tense for literary analysis, avoid contractions, use formal academic language.",
    apa: "Follow APA style guidelines: use past tense for research descriptions, emphasize clear and concise writing, avoid bias.",
    chicago: "Follow Chicago style guidelines: maintain formal academic tone, use precise citations format.",
    harvard: "Follow Harvard referencing style: maintain academic formality, use third person perspective.",
    none: "Use general academic writing conventions."
  };

  // Add writing mode specific instructions
  basePrompt += `\n\n${languageInstructions[settings.languageVariant]}`;
  basePrompt += `\n${academicInstructions[settings.academicStyle]}`;
  basePrompt += `\n${modeInstructions[settings.writingMode]}`;

  // Add checking mode specific instructions
  const checkingInstructions = {
    speed: "Focus only on critical errors: grammar mistakes, spelling errors, and major clarity issues.",
    standard: "Provide balanced checking: grammar, spelling, basic style, and readability improvements.",
    comprehensive: "Provide thorough analysis: grammar, spelling, advanced style, readability, tone, and structural improvements."
  };

  basePrompt += `\n${checkingInstructions[settings.checkingMode]}`;

  // Add focus areas based on checking mode
  if (settings.checkingMode === 'speed' || settings.criticalErrorsOnly) {
    basePrompt += `\n\nFocus ONLY on:
1. Grammar errors (subject-verb agreement, tense consistency, etc.)
2. Spelling mistakes
3. Critical clarity issues that affect comprehension`;
  } else {
    basePrompt += `\n\nFocus on:
1. Grammar errors (subject-verb agreement, tense consistency, etc.)
2. Spelling mistakes  
3. Style improvements (word choice, sentence variety, clarity)
4. Readability issues (sentence length, passive voice, filler words)`;
  }

  basePrompt += `\n\nFor each issue found, provide:
- The exact original text that needs changing
- The suggested replacement
- A clear reason why this change improves the writing
- The type of issue (grammar, spelling, style, readability)
- Severity level (low, medium, high)
- The exact character positions where the issue starts and ends

Respond with a JSON array of suggestions. Each suggestion should have this exact format:
{
  "original": "exact text to replace",
  "suggestion": "improved text",
  "reason": "explanation of why this is better",
  "type": "grammar|spelling|style|readability",
  "severity": "low|medium|high",
  "start_pos": number,
  "end_pos": number
}

Only suggest improvements that genuinely make the writing better. Be specific and actionable.`;

  return basePrompt;
}

export async function checkTextWithAI(text: string, settings?: WritingSettings): Promise<GrammarSuggestion[]> {
  if (!text || text.trim().length === 0) {
    return [];
  }

  // Check if API key is configured
  if (!OPENAI_API_KEY || OPENAI_API_KEY.trim() === '') {
    console.warn('AI Grammar Checker: OpenAI API key not configured, returning empty suggestions');
    return [];
  }

  // Use default settings if none provided
  const defaultSettings: WritingSettings = {
    academicStyle: 'none',
    languageVariant: 'us',
    checkingMode: 'standard',
    writingMode: 'academic',
    criticalErrorsOnly: false
  };

  const currentSettings = settings || defaultSettings;

  console.log('AI Grammar Checker: Analyzing text with OpenAI...', {
    length: text.length,
    preview: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
    settings: currentSettings
  });

  try {
    const systemPrompt = generateSystemPrompt(currentSettings);
    
    // Add timeout to prevent infinite loading
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: systemPrompt
          },
          {
            role: 'user',
            content: `Please analyze this text and provide specific writing suggestions:\n\n"${text}"`
          }
        ],
        max_tokens: currentSettings.checkingMode === 'speed' ? 1000 : 2000,
        temperature: 0.3
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorData = await response.text();
      console.error('OpenAI API error:', response.status, errorData);
      
      // Handle specific error cases
      if (response.status === 401) {
        console.error('AI Grammar Checker: Invalid API key');
        return [];
      } else if (response.status === 429) {
        console.error('AI Grammar Checker: Rate limit exceeded');
        return [];
      } else if (response.status >= 500) {
        console.error('AI Grammar Checker: OpenAI server error');
        return [];
      }
      
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const aiResponse = data.choices[0]?.message?.content;

    if (!aiResponse) {
      console.error('No response from OpenAI');
      return [];
    }

    console.log('AI Grammar Checker: Raw OpenAI response:', aiResponse);

    // Parse the JSON response
    let aiSuggestions: OpenAISuggestion[];
    try {
      // Try to extract JSON from the response
      const jsonMatch = aiResponse.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        aiSuggestions = JSON.parse(jsonMatch[0]);
      } else {
        // If no JSON array found, try parsing the entire response
        aiSuggestions = JSON.parse(aiResponse);
      }
    } catch (parseError) {
      console.warn('Failed to parse JSON response, trying text parsing:', parseError);
      return parseTextResponse(aiResponse, text);
    }

    if (!Array.isArray(aiSuggestions)) {
      console.warn('AI response is not an array, returning empty suggestions');
      return [];
    }

    console.log('AI Grammar Checker: Parsed suggestions:', aiSuggestions.length);

    // Filter out invalid suggestions
    const filteredSuggestions = aiSuggestions.filter(suggestion => {
      return suggestion.original && 
             suggestion.suggestion && 
             typeof suggestion.start_pos === 'number' &&
             typeof suggestion.end_pos === 'number' &&
             suggestion.start_pos >= 0 &&
             suggestion.end_pos <= text.length &&
             suggestion.start_pos < suggestion.end_pos;
    });

    console.log('AI Grammar Checker: Filtered suggestions:', filteredSuggestions.length);

    // Convert OpenAI suggestions to our format
    const suggestions: GrammarSuggestion[] = filteredSuggestions
      .map((aiSugg, index) => {
        // Validate the AI suggestion
        if (!aiSugg.original || !aiSugg.suggestion || typeof aiSugg.start_pos !== 'number') {
          console.warn('Invalid AI suggestion:', aiSugg);
          return null;
        }

        // Verify the positions are correct
        const actualText = text.substring(aiSugg.start_pos, aiSugg.end_pos);
        if (actualText !== aiSugg.original) {
          console.warn('Position mismatch, attempting to find correct position:', {
            expected: aiSugg.original,
            actualAtPosition: actualText,
            positions: `${aiSugg.start_pos}-${aiSugg.end_pos}`
          });
          
          // Try to find the text in the document
          const foundIndex = text.indexOf(aiSugg.original);
          if (foundIndex !== -1) {
            aiSugg.start_pos = foundIndex;
            aiSugg.end_pos = foundIndex + aiSugg.original.length;
            console.log('Corrected positions:', aiSugg.start_pos, aiSugg.end_pos);
          } else {
            console.warn('Could not find original text in document, skipping suggestion');
            return null;
          }
        }

        return {
          id: `ai-${index}-${Date.now()}-${Math.random()}`,
          type: aiSugg.type as GrammarSuggestion['type'],
          start: aiSugg.start_pos,
          end: aiSugg.end_pos,
          original: aiSugg.original,
          originalText: aiSugg.original,
          suggestion: aiSugg.suggestion,
          message: aiSugg.reason,
          explanation: aiSugg.reason,
          severity: mapSeverity(aiSugg.severity),
          startIndex: aiSugg.start_pos,
          endIndex: aiSugg.end_pos
        } as GrammarSuggestion;
      })
      .filter((suggestion): suggestion is GrammarSuggestion => suggestion !== null);

    console.log('AI Grammar Checker: Processed suggestions:', {
      total: suggestions.length,
      byType: suggestions.reduce((acc, s) => {
        acc[s.type] = (acc[s.type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      bySeverity: suggestions.reduce((acc, s) => {
        acc[s.severity] = (acc[s.severity] || 0) + 1;
        return acc;
      }, {} as Record<string, number>)
    });

    // Filter suggestions based on user feedback patterns
    const feedbackStats = useSuggestionFeedbackStore.getState().getFeedbackStats();
    const uniqueSuggestions = [...new Set(suggestions)];
    const personalizedSuggestions = uniqueSuggestions
      .sort((a, b) => {
        // Prioritize suggestion types with higher acceptance rates
        const aRate = feedbackStats.acceptanceRate[a.type] || 50;
        const bRate = feedbackStats.acceptanceRate[b.type] || 50;
        return bRate - aRate;
      })
      .filter(suggestion => {
        // Filter out suggestions similar to commonly rejected ones
        const isCommonlyRejected = feedbackStats.commonRejected.some(
          rejected => suggestion.suggestion.toLowerCase().includes(rejected.toLowerCase())
        );
        return !isCommonlyRejected;
      });

    console.log('Grammar Checker: Final results:', {
      totalSuggestions: personalizedSuggestions.length,
      uniqueSuggestions: uniqueSuggestions.length,
      byType: uniqueSuggestions.reduce((acc, s) => {
        acc[s.type] = (acc[s.type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      bySeverity: uniqueSuggestions.reduce((acc, s) => {
        acc[s.severity] = (acc[s.severity] || 0) + 1;
        return acc;
      }, {} as Record<string, number>)
    });

    return personalizedSuggestions;

  } catch (error) {
    console.error('AI Grammar Checker: Error:', error);
    
    // Handle specific error types
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        console.error('AI Grammar Checker: Request timed out');
      } else if (error.message.includes('fetch')) {
        console.error('AI Grammar Checker: Network error');
      }
    }
    
    return [];
  }
}

// Helper function to map severity
function mapSeverity(severity: 'low' | 'medium' | 'high'): GrammarSuggestion['severity'] {
  switch (severity) {
    case 'high':
      return 'error';
    case 'medium':
      return 'warning';
    case 'low':
    default:
      return 'suggestion';
  }
}

// Fallback function to parse text-based responses
function parseTextResponse(response: string, originalText: string): GrammarSuggestion[] {
  console.log('Attempting to parse text response for suggestions...');
  
  // This is a simple fallback - you could make this more sophisticated
  const suggestions: GrammarSuggestion[] = [];
  
  // Look for common patterns in text responses
  const lines = response.split('\n');
  lines.forEach((line, index) => {
    // Simple pattern matching for suggestions
    const suggestionMatch = line.match(/["']([^"']+)["']\s*(?:should be|→|->|to)\s*["']([^"']+)["']/i);
    if (suggestionMatch) {
      const original = suggestionMatch[1];
      const suggestion = suggestionMatch[2];
      const foundIndex = originalText.indexOf(original);
      
      if (foundIndex !== -1) {
        suggestions.push({
          id: `fallback-${index}-${Date.now()}`,
          type: 'style',
          start: foundIndex,
          end: foundIndex + original.length,
          original,
          originalText: original,
          suggestion,
          message: 'AI-suggested improvement',
          explanation: 'AI-suggested improvement',
          severity: 'suggestion',
          startIndex: foundIndex,
          endIndex: foundIndex + original.length
        });
      }
    }
  });
  
  return suggestions;
}

// Function to get AI-powered text improvement suggestions
export async function getAITextSuggestions(text: string, _context?: string): Promise<string[]> {
  if (!text || text.trim().length === 0) {
    return [];
  }

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are a helpful writing assistant. Provide 3-5 brief, actionable suggestions to improve the given text. Focus on clarity, engagement, and readability. Each suggestion should be one sentence and start with an action verb.`
          },
          {
            role: 'user',
            content: `Please provide writing improvement suggestions for this text:\n\n"${text}"`
          }
        ],
        max_tokens: 300,
        temperature: 0.7
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const aiResponse = data.choices[0]?.message?.content;

    if (!aiResponse) {
      return [];
    }

    // Parse suggestions from the response
    const suggestions = aiResponse
      .split('\n')
      .filter((line: string) => line.trim().length > 0)
      .map((line: string) => line.replace(/^\d+\.\s*/, '').replace(/^[-•]\s*/, '').trim())
      .filter((suggestion: string) => suggestion.length > 10);

    return suggestions.slice(0, 5); // Limit to 5 suggestions

  } catch (error) {
    console.error('Error getting AI text suggestions:', error);
    return [];
  }
}

// Updated function signature to accept WritingModeType and return WritingMode
export function checkGrammarAndStyle(text: string, modeType: WritingModeType | null): Promise<GrammarSuggestion[]> {
  if (!text || !modeType) {
    return Promise.resolve([]);
  }

  // Get the full WritingMode object from the type
  const mode = defaultWritingModes[modeType];
  if (!mode) {
    console.warn(`Unknown writing mode type: ${modeType}`);
    return Promise.resolve([]);
  }

  // For now, return the AI-powered suggestions
  // You can add the rule-based suggestions here if needed
  const settings: WritingSettings = {
    academicStyle: 'none',
    languageVariant: 'us',
    checkingMode: 'standard',
    writingMode: modeType,
    criticalErrorsOnly: false
  };

  return checkTextWithAI(text, settings);
}

export function getWritingScore(text: string, modeType: WritingModeType | null): number {
  if (!text || !modeType) return 0;

  // This is a simplified version - you might want to make it async and use actual suggestions
  const textLength = text.length;
  const words = text.trim().split(/\s+/).length;
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0).length;
  
  // Calculate base score based on text characteristics
  let score = 100;
  
  // Deduct points for very short or very long sentences
  const avgWordsPerSentence = sentences > 0 ? words / sentences : 0;
  if (avgWordsPerSentence < 5 || avgWordsPerSentence > 30) {
    score -= 10;
  }
  
  // Normalize score based on text length
  const normalizedScore = Math.max(0, Math.min(100, score * (1 + Math.log10(textLength / 1000 + 1))));

  return Math.round(normalizedScore);
}

// Export the main checking function
export const checkGrammar = checkTextWithAI;
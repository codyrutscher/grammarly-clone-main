import React, { useState, useEffect } from 'react';
import { analyzeWriting } from '../utils/writingAnalytics';
import { analyzeText } from '../utils/advancedAnalysis';
import { useDocumentStore } from '../store/useDocumentStore';
import { useDarkModeStore } from '../store/useDarkModeStore';

interface AnalysisPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AnalysisPanel: React.FC<AnalysisPanelProps> = ({ isOpen, onClose }) => {
  const { currentDocument, suggestions } = useDocumentStore();
  const { isDarkMode } = useDarkModeStore();
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<any>(null);

  // Basic analytics (non-AI)
  const basicAnalytics = React.useMemo(() => {
    if (!currentDocument?.content) return null;
    return analyzeWriting(currentDocument.content, suggestions);
  }, [currentDocument?.content, suggestions]);

  // AI-powered analysis
  useEffect(() => {
    if (isOpen && currentDocument?.content && !aiAnalysis && !isAnalyzing) {
      performAIAnalysis();
    }
  }, [isOpen, currentDocument?.content]);

  const performAIAnalysis = async () => {
    if (!currentDocument?.content || isAnalyzing) return;
    
    setIsAnalyzing(true);
    try {
      const analysis = await analyzeText(currentDocument.content);
      setAiAnalysis(analysis);
    } catch (error) {
      console.error('AI analysis failed:', error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  if (!isOpen) return null;

  if (!basicAnalytics) {
    return (
      <div className={`fixed right-0 top-0 h-full w-96 shadow-lg z-40 ${
        isDarkMode ? 'bg-gray-800' : 'bg-white'
      }`}>
        <div className="flex justify-between items-center mb-4 p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
            Analysis
          </h2>
          <button 
            onClick={onClose} 
            className={`${isDarkMode ? 'text-gray-400 hover:text-gray-200' : 'text-gray-500 hover:text-gray-700'}`}
          >
            <span className="sr-only">Close panel</span>
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className={`p-4 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
          No document selected for analysis
        </div>
      </div>
    );
  }

  const formatNumber = (num: number) => {
    if (isNaN(num) || !isFinite(num)) return '0';
    return Number(num.toFixed(2)).toString();
  };

  const renderMetricCard = (title: string, value: number | string, description?: string, color?: string) => (
    <div className={`rounded-lg p-4 shadow-sm ${
      isDarkMode ? 'bg-gray-700' : 'bg-gray-50'
    }`}>
      <h3 className={`text-sm font-medium ${
        isDarkMode ? 'text-gray-400' : 'text-gray-500'
      }`}>{title}</h3>
      <p className={`mt-1 text-2xl font-semibold ${
        color || (isDarkMode ? 'text-gray-100' : 'text-gray-900')
      }`}>{value}</p>
      {description && (
        <p className={`mt-1 text-xs ${
          isDarkMode ? 'text-gray-400' : 'text-gray-500'
        }`}>{description}</p>
      )}
    </div>
  );

  const getScoreColor = (score: number) => {
    if (score >= 80) return isDarkMode ? 'text-green-400' : 'text-green-600';
    if (score >= 60) return isDarkMode ? 'text-yellow-400' : 'text-yellow-600';
    return isDarkMode ? 'text-red-400' : 'text-red-600';
  };

  return (
    <div className={`fixed right-0 top-0 h-full w-96 shadow-lg z-40 ${
      isDarkMode ? 'bg-gray-800' : 'bg-white'
    }`}>
      <div className="flex justify-between items-center mb-4 p-4 border-b border-gray-200 dark:border-gray-700">
        <h2 className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
          📊 AI-Powered Analysis
        </h2>
        <button 
          onClick={onClose} 
          className={`${isDarkMode ? 'text-gray-400 hover:text-gray-200' : 'text-gray-500 hover:text-gray-700'}`}
        >
          <span className="sr-only">Close panel</span>
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      
      <div className="h-full overflow-y-auto pb-20">
        <div className="p-4 space-y-6">
          {/* AI Analysis Section */}
          {isAnalyzing ? (
            <div className="text-center py-8">
              <div className="relative mx-auto w-24 h-24">
                <div className="absolute inset-0 animate-spin rounded-full border-4 border-blue-200 border-t-blue-500"></div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-2xl">🤖</span>
                </div>
              </div>
              <p className={`mt-4 ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                AI is analyzing your writing...
              </p>
              <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'} animate-pulse`}>
                This usually takes a few seconds
              </p>
            </div>
          ) : aiAnalysis ? (
            <>
              {/* AI Scores */}
              <div>
                <h2 className={`text-lg font-semibold mb-3 ${
                  isDarkMode ? 'text-gray-100' : 'text-gray-900'
                }`}>
                  🤖 AI Writing Scores
                </h2>
                <div className="grid grid-cols-2 gap-3">
                  {renderMetricCard(
                    'Overall Score',
                    `${aiAnalysis.score.overall}%`,
                    'AI assessment of writing quality',
                    getScoreColor(aiAnalysis.score.overall)
                  )}
                  {renderMetricCard(
                    'Correctness',
                    `${aiAnalysis.score.correctness}%`,
                    'Grammar & spelling accuracy',
                    getScoreColor(aiAnalysis.score.correctness)
                  )}
                  {renderMetricCard(
                    'Clarity',
                    `${aiAnalysis.score.clarity}%`,
                    'How clear your writing is',
                    getScoreColor(aiAnalysis.score.clarity)
                  )}
                  {renderMetricCard(
                    'Engagement',
                    `${aiAnalysis.score.engagement}%`,
                    'Reader interest level',
                    getScoreColor(aiAnalysis.score.engagement)
                  )}
                </div>
              </div>

              {/* AI Improvements */}
              {aiAnalysis.improvements && aiAnalysis.improvements.length > 0 && (
                <div>
                  <h2 className={`text-lg font-semibold mb-3 ${
                    isDarkMode ? 'text-gray-100' : 'text-gray-900'
                  }`}>
                    💡 AI Suggestions
                  </h2>
                  <div className="space-y-2">
                    {aiAnalysis.improvements.slice(0, 5).map((improvement: string, index: number) => (
                      <div key={index} className={`p-3 rounded-lg text-sm ${
                        isDarkMode ? 'bg-gray-700' : 'bg-blue-50'
                      }`}>
                        <p className={isDarkMode ? 'text-gray-200' : 'text-gray-700'}>
                          • {improvement}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* AI Strengths */}
              {aiAnalysis.strengths && aiAnalysis.strengths.length > 0 && (
                <div>
                  <h2 className={`text-lg font-semibold mb-3 ${
                    isDarkMode ? 'text-gray-100' : 'text-gray-900'
                  }`}>
                    ✨ Strengths
                  </h2>
                  <div className="space-y-2">
                    {aiAnalysis.strengths.map((strength: string, index: number) => (
                      <div key={index} className={`p-3 rounded-lg text-sm ${
                        isDarkMode ? 'bg-gray-700' : 'bg-green-900/30'
                      }`}>
                        <p className={isDarkMode ? 'text-gray-200' : 'text-gray-700'}>
                          • {strength}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Tone Analysis */}
              {aiAnalysis.toneAnalysis && (
                <div>
                  <h2 className={`text-lg font-semibold mb-3 ${
                    isDarkMode ? 'text-gray-100' : 'text-gray-900'
                  }`}>
                    🎭 Tone Analysis
                  </h2>
                  <div className={`p-3 rounded-lg ${
                    isDarkMode ? 'bg-gray-700' : 'bg-gray-50'
                  }`}>
                    <p className={`text-sm font-medium ${
                      isDarkMode ? 'text-gray-300' : 'text-gray-600'
                    }`}>
                      Detected tone: <span className="font-bold capitalize">{aiAnalysis.toneAnalysis.tone}</span>
                    </p>
                    <p className={`text-xs mt-1 ${
                      isDarkMode ? 'text-gray-400' : 'text-gray-500'
                    }`}>
                      Confidence: {aiAnalysis.toneAnalysis.confidence}%
                    </p>
                  </div>
                </div>
              )}
            </>
          ) : (
            <button
              onClick={performAIAnalysis}
              className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              🤖 Run AI Analysis
            </button>
          )}

          {/* Basic Metrics */}
          <div>
            <h2 className={`text-lg font-semibold mb-3 ${
              isDarkMode ? 'text-gray-100' : 'text-gray-900'
            }`}>
              📖 Readability Metrics
            </h2>
            <div className="grid grid-cols-2 gap-3">
              {renderMetricCard(
                'Grade Level',
                formatNumber(basicAnalytics.readabilityScores.fleschKincaid),
                'Flesch-Kincaid score'
              )}
              {renderMetricCard(
                'Reading Ease',
                `${100 - Math.round(basicAnalytics.readabilityScores.fleschKincaid * 5)}%`,
                'How easy to read'
              )}
            </div>
          </div>

          <div>
            <h2 className={`text-lg font-semibold mb-3 ${
              isDarkMode ? 'text-gray-100' : 'text-gray-900'
            }`}>
              📊 Basic Statistics
            </h2>
            <div className="grid grid-cols-2 gap-3">
              {renderMetricCard(
                'Unique Words',
                basicAnalytics.vocabularyMetrics.uniqueWords,
                'Vocabulary variety'
              )}
              {renderMetricCard(
                'Avg Sentence',
                formatNumber(basicAnalytics.structureMetrics.averageSentenceLength),
                'Words per sentence'
              )}
              {renderMetricCard(
                'Paragraphs',
                basicAnalytics.structureMetrics.paragraphCount
              )}
              {renderMetricCard(
                'Passive Voice',
                `${formatNumber(basicAnalytics.styleMetrics.passiveVoicePercentage)}%`
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
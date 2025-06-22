import React, { useState, useEffect } from 'react';
import { useDarkModeStore } from '../store/useDarkModeStore';
import { searchResources, getSuggestedTopics, formatCitation } from '../utils/researchService';
import type { ResearchResult, ResearchQuery, ResearchSearchState } from '../types';

interface ResearchPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ResearchPanel: React.FC<ResearchPanelProps> = ({ isOpen, onClose }) => {
  const { isDarkMode } = useDarkModeStore();
  const [searchState, setSearchState] = useState<ResearchSearchState>({
    results: [],
    isSearching: false,
    query: '',
    totalResults: 0,
    hasMore: false
  });
  const [searchInput, setSearchInput] = useState('');
  const [selectedFilters, setSelectedFilters] = useState({
    dateRange: 'any' as const,
    type: 'all' as const
  });
  const [suggestedTopics, setSuggestedTopics] = useState<string[]>([]);

  const handleSearch = async (query: string, append: boolean = false) => {
    if (!query.trim()) return;

    setSearchState(prev => ({
      ...prev,
      isSearching: true,
      query: query.trim(),
      error: undefined
    }));

    try {
      const searchQuery: ResearchQuery = {
        query: query.trim(),
        filters: selectedFilters,
        limit: 10
      };

      const results = await searchResources(searchQuery);
      
      setSearchState(prev => ({
        ...prev,
        results: append ? [...prev.results, ...results.results] : results.results,
        totalResults: results.totalResults,
        hasMore: results.hasMore,
        isSearching: false
      }));

      // Generate suggested topics only for new searches
      if (!append) {
        const suggestions = getSuggestedTopics(query.trim());
        setSuggestedTopics(suggestions);
      }

    } catch (error) {
      console.error('Research search failed:', error);
      setSearchState(prev => ({
        ...prev,
        isSearching: false,
        error: 'Failed to search for resources. Please try again.'
      }));
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch(searchInput);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      // You could add a toast notification here
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
    }
  };

  const getTypeIcon = (type: ResearchResult['type']) => {
    switch (type) {
      case 'webpage': return '🌐';
      case 'article': return '📄';
      case 'paper': return '📚';
      case 'news': return '📰';
      default: return '📄';
    }
  };

  const getTypeColor = (type: ResearchResult['type']) => {
    switch (type) {
      case 'webpage': return isDarkMode ? 'text-blue-400' : 'text-blue-600';
      case 'article': return isDarkMode ? 'text-green-400' : 'text-green-600';
      case 'paper': return isDarkMode ? 'text-purple-400' : 'text-purple-600';
      case 'news': return isDarkMode ? 'text-orange-400' : 'text-orange-600';
      default: return isDarkMode ? 'text-gray-400' : 'text-gray-600';
    }
  };

  if (!isOpen) return null;

  return (
    <div className={`fixed right-0 top-0 h-full w-96 shadow-lg z-40 ${
      isDarkMode ? 'bg-gray-800' : 'bg-white'
    }`}>
      {/* Header */}
      <div className="flex justify-between items-center mb-4 p-4 border-b border-gray-200 dark:border-gray-700">
        <h2 className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
          🔍 Research Assistant
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
          {/* Search Input */}
          <div className="space-y-3">
            <label className={`block text-sm font-medium ${
              isDarkMode ? 'text-gray-300' : 'text-gray-700'
            }`}>
              What would you like to research?
            </label>
            <div className="relative">
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="e.g., climate change, artificial intelligence, renewable energy..."
                className={`w-full px-4 py-3 pr-12 rounded-lg border transition-colors ${
                  isDarkMode 
                    ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400 focus:border-blue-500' 
                    : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500 focus:border-blue-500'
                } focus:outline-none focus:ring-2 focus:ring-blue-500/20`}
              />
              <button
                onClick={() => handleSearch(searchInput)}
                disabled={searchState.isSearching || !searchInput.trim()}
                className={`absolute right-2 top-1/2 transform -translate-y-1/2 p-2 rounded-md transition-colors ${
                  searchState.isSearching || !searchInput.trim()
                    ? 'text-gray-400 cursor-not-allowed'
                    : isDarkMode 
                      ? 'text-blue-400 hover:bg-gray-600' 
                      : 'text-blue-600 hover:bg-gray-100'
                }`}
              >
                {searchState.isSearching ? (
                  <div className="animate-spin w-5 h-5 border-2 border-current border-t-transparent rounded-full" />
                ) : (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {/* Filters */}
          <div className="space-y-3">
            <h3 className={`text-sm font-medium ${
              isDarkMode ? 'text-gray-300' : 'text-gray-700'
            }`}>
              Filters
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <select
                value={selectedFilters.dateRange}
                onChange={(e) => setSelectedFilters(prev => ({ 
                  ...prev, 
                  dateRange: e.target.value as any 
                }))}
                className={`px-3 py-2 rounded-md border text-sm ${
                  isDarkMode 
                    ? 'bg-gray-700 border-gray-600 text-white' 
                    : 'bg-white border-gray-300 text-gray-900'
                }`}
              >
                <option value="any">Any time</option>
                <option value="past_year">Past year</option>
                <option value="past_month">Past month</option>
                <option value="past_week">Past week</option>
              </select>
              <select
                value={selectedFilters.type}
                onChange={(e) => setSelectedFilters(prev => ({ 
                  ...prev, 
                  type: e.target.value as any 
                }))}
                className={`px-3 py-2 rounded-md border text-sm ${
                  isDarkMode 
                    ? 'bg-gray-700 border-gray-600 text-white' 
                    : 'bg-white border-gray-300 text-gray-900'
                }`}
              >
                <option value="all">All sources</option>
                <option value="academic">Academic</option>
                <option value="news">News</option>
                <option value="government">Government</option>
              </select>
            </div>
          </div>

          {/* Suggested Topics */}
          {suggestedTopics.length > 0 && (
            <div className="space-y-3">
              <h3 className={`text-sm font-medium ${
                isDarkMode ? 'text-gray-300' : 'text-gray-700'
              }`}>
                Related searches
              </h3>
              <div className="flex flex-wrap gap-2">
                {suggestedTopics.map((topic, index) => (
                  <button
                    key={index}
                    onClick={() => {
                      setSearchInput(topic);
                      handleSearch(topic);
                    }}
                    className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                      isDarkMode 
                        ? 'border-gray-600 text-gray-300 hover:bg-gray-700' 
                        : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {topic}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Search Results */}
          {searchState.isSearching && (
            <div className="text-center py-8">
              <div className="relative mx-auto w-24 h-24">
                <div className="absolute inset-0 animate-spin rounded-full border-4 border-blue-200 border-t-blue-500"></div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-2xl">🔍</span>
                </div>
              </div>
              <p className={`mt-4 ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                Searching for research resources...
              </p>
            </div>
          )}

          {searchState.error && (
            <div className={`p-4 rounded-lg ${
              isDarkMode ? 'bg-red-900/30 text-red-200' : 'bg-red-50 text-red-700'
            }`}>
              <p className="text-sm">{searchState.error}</p>
            </div>
          )}

          {searchState.results.length > 0 && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className={`text-lg font-semibold ${
                  isDarkMode ? 'text-gray-100' : 'text-gray-900'
                }`}>
                  Research Results
                </h3>
                <span className={`text-sm ${
                  isDarkMode ? 'text-gray-400' : 'text-gray-500'
                }`}>
                  {searchState.totalResults} results found
                </span>
              </div>

              <div className="space-y-4">
                {searchState.results.map((result) => (
                  <div
                    key={result.id}
                    className={`p-4 rounded-lg border transition-colors hover:shadow-md ${
                      isDarkMode 
                        ? 'border-gray-600 bg-gray-700/50 hover:bg-gray-700' 
                        : 'border-gray-200 bg-gray-50 hover:bg-white'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <span className="text-lg">{getTypeIcon(result.type)}</span>
                        <span className={`text-xs px-2 py-1 rounded-full ${getTypeColor(result.type)} bg-current bg-opacity-10`}>
                          {result.type}
                        </span>
                      </div>
                      <div className="flex space-x-1">
                        <button
                          onClick={() => copyToClipboard(result.url)}
                          className={`p-1 rounded transition-colors ${
                            isDarkMode ? 'hover:bg-gray-600' : 'hover:bg-gray-200'
                          }`}
                          title="Copy URL"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => copyToClipboard(formatCitation(result, 'APA'))}
                          className={`p-1 rounded transition-colors ${
                            isDarkMode ? 'hover:bg-gray-600' : 'hover:bg-gray-200'
                          }`}
                          title="Copy citation"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4V2a1 1 0 011-1h8a1 1 0 011 1v2m0 0V3a1 1 0 011 1v11a1 1 0 01-1 1H8a1 1 0 01-1-1V4z" />
                          </svg>
                        </button>
                      </div>
                    </div>

                    <h4 className={`font-medium mb-2 ${
                      isDarkMode ? 'text-blue-400' : 'text-blue-600'
                    }`}>
                      <a 
                        href={result.url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="hover:underline"
                      >
                        {result.title}
                      </a>
                    </h4>

                    <p className={`text-sm mb-2 ${
                      isDarkMode ? 'text-gray-300' : 'text-gray-600'
                    }`}>
                      {result.snippet}
                    </p>

                    <div className="flex justify-between items-center text-xs">
                      <span className={isDarkMode ? 'text-gray-400' : 'text-gray-500'}>
                        {result.source} • {result.publishedDate}
                      </span>
                      <div className="flex space-x-1">
                        {result.tags.slice(0, 3).map((tag, index) => (
                          <span
                            key={index}
                            className={`px-2 py-1 rounded-full ${
                              isDarkMode 
                                ? 'bg-gray-600 text-gray-300' 
                                : 'bg-gray-200 text-gray-600'
                            }`}
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {searchState.hasMore && (
                <button
                  onClick={() => handleSearch(searchState.query, true)}
                  disabled={searchState.isSearching}
                  className={`w-full py-2 px-4 rounded-lg border transition-colors ${
                    searchState.isSearching
                      ? 'opacity-50 cursor-not-allowed'
                      : isDarkMode 
                        ? 'border-gray-600 text-gray-300 hover:bg-gray-700' 
                        : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {searchState.isSearching ? 'Loading...' : 'Load more results'}
                </button>
              )}
            </div>
          )}

          {/* Getting Started Message */}
          {!searchState.query && !searchState.isSearching && (
            <div className={`text-center py-8 ${
              isDarkMode ? 'text-gray-400' : 'text-gray-500'
            }`}>
              <div className="text-4xl mb-4">🔍</div>
              <h3 className="text-lg font-medium mb-2">Start Your Research</h3>
              <p className="text-sm">
                Enter a topic above to find relevant web pages, academic papers, and research resources.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}; 
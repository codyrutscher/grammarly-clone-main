import type { ResearchResult, ResearchQuery } from '../types';

// Mock research service - In production, you'd use real APIs like:
// - Google Custom Search API
// - Bing Web Search API
// - CORE API for academic papers
// - CrossRef API for academic papers
// - arXiv API for preprints

export const searchResources = async (query: ResearchQuery): Promise<{
  results: ResearchResult[];
  totalResults: number;
  hasMore: boolean;
}> => {
  console.log('🔍 Searching for research resources:', query.query);
  
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 1500));
  
  // Mock results based on the query
  const mockResults = generateMockResults(query.query, query.limit || 10);
  
  return {
    results: mockResults,
    totalResults: mockResults.length + Math.floor(Math.random() * 100),
    hasMore: mockResults.length >= (query.limit || 10)
  };
};

const generateMockResults = (query: string, limit: number): ResearchResult[] => {
  const topics = query.toLowerCase().split(' ');
  
  // Generate additional results for "load more" functionality
  const additionalResults: Omit<ResearchResult, 'id' | 'relevanceScore'>[] = [
    {
      title: `Advanced ${query} Techniques and Methods`,
      url: `https://academic.oup.com/search?q=${encodeURIComponent(query)}`,
      snippet: `Advanced techniques and methodologies in ${query} research. Comprehensive coverage of cutting-edge approaches and emerging trends in the field.`,
      source: 'Oxford Academic',
      publishedDate: '2024-01-05',
      type: 'article',
      tags: ['advanced', 'techniques', 'methodology']
    },
    {
      title: `${query} Policy and Regulations`,
      url: `https://www.regulations.gov/search?filter=${encodeURIComponent(query)}`,
      snippet: `Government policies and regulatory frameworks related to ${query}. Official documentation and compliance requirements.`,
      source: 'Regulations.gov',
      publishedDate: '2024-02-18',
      type: 'webpage',
      tags: ['policy', 'regulations', 'government']
    },
    {
      title: `International Perspectives on ${query}`,
      url: `https://www.un.org/search?q=${encodeURIComponent(query)}`,
      snippet: `Global perspectives and international approaches to ${query}. Cross-cultural analysis and comparative studies from around the world.`,
      source: 'United Nations',
      publishedDate: '2024-01-25',
      type: 'webpage',
      tags: ['international', 'global', 'comparative']
    },
    {
      title: `${query} Technology and Innovation`,
      url: `https://ieeexplore.ieee.org/search/searchresult.jsp?queryText=${encodeURIComponent(query)}`,
      snippet: `Technological innovations and developments in ${query}. Engineering solutions and technical breakthroughs in the field.`,
      source: 'IEEE Xplore',
      publishedDate: '2024-02-03',
      type: 'paper',
      tags: ['technology', 'innovation', 'engineering']
    },
    {
      title: `${query} Market Analysis and Trends`,
      url: `https://www.marketresearch.com/search?q=${encodeURIComponent(query)}`,
      snippet: `Market analysis, trends, and economic impact of ${query}. Industry reports and business intelligence insights.`,
      source: 'Market Research',
      publishedDate: '2024-02-14',
      type: 'article',
      tags: ['market', 'trends', 'economics']
    }
  ];

  const baseResults: Omit<ResearchResult, 'id' | 'relevanceScore'>[] = [
    {
      title: `${query} - Comprehensive Overview`,
      url: `https://en.wikipedia.org/wiki/${query.replace(/\s+/g, '_')}`,
      snippet: `A comprehensive overview of ${query}, covering key concepts, historical development, and current research trends. This article provides foundational knowledge and references to primary sources.`,
      source: 'Wikipedia',
      publishedDate: '2024-01-15',
      type: 'webpage',
      tags: ['overview', 'encyclopedia', 'general']
    },
    {
      title: `Recent Advances in ${query} Research`,
      url: `https://scholar.google.com/scholar?q=${encodeURIComponent(query)}`,
      snippet: `Latest research findings and developments in ${query}. Peer-reviewed articles, citations, and academic papers from leading researchers in the field.`,
      source: 'Google Scholar',
      publishedDate: '2024-02-10',
      type: 'article',
      tags: ['academic', 'research', 'peer-reviewed']
    },
    {
      title: `${query}: Key Statistics and Data`,
      url: `https://www.statista.com/search/?q=${encodeURIComponent(query)}`,
      snippet: `Statistical data, market research, and quantitative analysis related to ${query}. Includes charts, graphs, and data visualizations from reliable sources.`,
      source: 'Statista',
      publishedDate: '2024-01-28',
      type: 'webpage',
      tags: ['statistics', 'data', 'analysis']
    },
    {
      title: `Government Resources on ${query}`,
      url: `https://www.usa.gov/search?query=${encodeURIComponent(query)}`,
      snippet: `Official government information and resources about ${query}. Includes policy documents, regulations, and official statements from government agencies.`,
      source: 'USA.gov',
      publishedDate: '2024-02-05',
      type: 'webpage',
      tags: ['government', 'official', 'policy']
    },
    {
      title: `${query} News and Current Events`,
      url: `https://news.google.com/search?q=${encodeURIComponent(query)}`,
      snippet: `Latest news articles and current events related to ${query}. Breaking news, analysis, and expert commentary from major news outlets.`,
      source: 'Google News',
      publishedDate: '2024-02-15',
      type: 'news',
      tags: ['news', 'current events', 'journalism']
    },
    {
      title: `Academic Papers on ${query}`,
      url: `https://arxiv.org/search/?query=${encodeURIComponent(query)}`,
      snippet: `Preprint research papers and academic publications about ${query}. Access to cutting-edge research before peer review publication.`,
      source: 'arXiv',
      publishedDate: '2024-02-12',
      type: 'paper',
      tags: ['preprint', 'academic', 'research']
    },
    {
      title: `${query} Case Studies and Examples`,
      url: `https://www.researchgate.net/search?q=${encodeURIComponent(query)}`,
      snippet: `Real-world case studies, practical applications, and examples of ${query}. Includes methodology, results, and lessons learned.`,
      source: 'ResearchGate',
      publishedDate: '2024-01-20',
      type: 'article',
      tags: ['case study', 'practical', 'examples']
    },
    {
      title: `${query} - Educational Resources`,
      url: `https://www.coursera.org/search?query=${encodeURIComponent(query)}`,
      snippet: `Educational materials, online courses, and learning resources about ${query}. Includes video lectures, assignments, and expert instruction.`,
      source: 'Coursera',
      publishedDate: '2024-01-10',
      type: 'webpage',
      tags: ['education', 'courses', 'learning']
    },
    {
      title: `Industry Analysis: ${query}`,
      url: `https://www.mckinsey.com/search?q=${encodeURIComponent(query)}`,
      snippet: `Professional industry analysis and consulting insights on ${query}. Market trends, business implications, and strategic recommendations.`,
      source: 'McKinsey & Company',
      publishedDate: '2024-02-08',
      type: 'article',
      tags: ['industry', 'business', 'consulting']
    },
    {
      title: `${query} Research Methodology and Best Practices`,
      url: `https://www.nature.com/search?q=${encodeURIComponent(query)}`,
      snippet: `Research methodologies, best practices, and scientific approaches for studying ${query}. Peer-reviewed articles from Nature publications.`,
      source: 'Nature',
      publishedDate: '2024-02-01',
      type: 'paper',
      tags: ['methodology', 'scientific', 'nature']
    }
  ];

  // Combine base and additional results for variety
  const allResults = [...baseResults, ...additionalResults];
  
  return allResults
    .slice(0, limit)
    .map((result, index) => ({
      ...result,
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}-${index}`,
      relevanceScore: Math.max(0.6, 1 - (index * 0.05)) // Decreasing relevance more gradually
    }));
};

// Function to get suggested search terms
export const getSuggestedTopics = (query: string): string[] => {
  const suggestions = [
    `${query} research methods`,
    `${query} case studies`,
    `${query} statistics`,
    `${query} recent developments`,
    `${query} best practices`,
    `${query} literature review`,
    `${query} theoretical framework`,
    `${query} empirical studies`
  ];
  
  return suggestions.slice(0, 5);
};

// Function to extract key terms from a query
export const extractKeyTerms = (query: string): string[] => {
  const stopWords = ['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'about'];
  return query
    .toLowerCase()
    .split(' ')
    .filter(word => word.length > 2 && !stopWords.includes(word))
    .slice(0, 5);
};

// Function to format citation from research result
export const formatCitation = (result: ResearchResult, style: 'APA' | 'MLA' | 'Chicago' = 'APA'): string => {
  const date = result.publishedDate ? new Date(result.publishedDate) : new Date();
  const year = date.getFullYear();
  
  switch (style) {
    case 'APA':
      return `${result.source}. (${year}). ${result.title}. Retrieved from ${result.url}`;
    case 'MLA':
      return `"${result.title}." ${result.source}, ${year}, ${result.url}.`;
    case 'Chicago':
      return `${result.source}. "${result.title}." Accessed ${date.toLocaleDateString()}. ${result.url}.`;
    default:
      return `${result.title} - ${result.source} (${year}) - ${result.url}`;
  }
}; 
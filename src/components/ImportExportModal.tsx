import React, { useState, useRef } from 'react';
import { useDarkModeStore } from '../store/useDarkModeStore';

interface ImportExportModalProps {
  content: string;
  documentTitle: string;
  onImport: (content: string) => void;
  onClose: () => void;
}

export const ImportExportModal: React.FC<ImportExportModalProps> = ({
  content,
  documentTitle,
  onImport,
  onClose
}) => {
  const { isDarkMode } = useDarkModeStore();
  const [activeTab, setActiveTab] = useState<'export' | 'import'>('export');
  const [importText, setImportText] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExportText = () => {
    // Strip HTML tags for plain text export
    const plainText = content.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ');
    const blob = new Blob([plainText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${documentTitle}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleExportMarkdown = () => {
    // Convert plain text to markdown format
    const lines = content.split('\n');
    let markdown = `# ${documentTitle}\n\n`;
    
    lines.forEach(line => {
      if (line.trim()) {
        markdown += `${line}\n\n`;
      }
    });

    const blob = new Blob([markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${documentTitle}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleExportDocx = async () => {
    console.log('Exporting content:', content);
    console.log('Content length:', content.length);
    console.log('First 500 chars:', content.substring(0, 500));
    console.log('Last 500 chars:', content.substring(content.length - 500));
    try {
      // Dynamic import to avoid loading the library if not needed
      const { Document, Packer, Paragraph, TextRun } = await import('docx');
      
      // Parse HTML content to extract formatted text
      const parser = new DOMParser();
      const htmlDoc = parser.parseFromString(content, 'text/html');
      
      const paragraphs: any[] = [];
      
      // Function to process a node and extract formatted text
      const processNode = (node: Node, currentRuns: any[] = []): any[] => {
        if (node.nodeType === Node.TEXT_NODE) {
          const text = node.textContent || '';
          if (text.trim()) {
            currentRuns.push(new TextRun({
              text: text,
              bold: false,
              italics: false,
              underline: undefined
            }));
          }
        } else if (node.nodeType === Node.ELEMENT_NODE) {
          const element = node as HTMLElement;
          const tagName = element.tagName.toLowerCase();
          
          if (tagName === 'br') {
            // Handle line breaks
            currentRuns.push(new TextRun({ text: '\n' }));
            return currentRuns;
          } else if (tagName === 'div' || tagName === 'p') {
            // Handle block elements
            const newRuns: any[] = [];
            element.childNodes.forEach(child => {
              const childRuns = processNode(child, []);
              newRuns.push(...childRuns);
            });
            if (newRuns.length > 0) {
              paragraphs.push(new Paragraph({ children: newRuns }));
            }
            return [];
          } else {
            // Handle inline formatting
            const isBold = tagName === 'strong' || tagName === 'b' || 
              element.style.fontWeight === 'bold' || 
              window.getComputedStyle(element).fontWeight === 'bold';
            
            const isItalic = tagName === 'em' || tagName === 'i' || 
              element.style.fontStyle === 'italic' || 
              window.getComputedStyle(element).fontStyle === 'italic';
            
            const isUnderline = tagName === 'u' || 
              element.style.textDecoration?.includes('underline') ||
              window.getComputedStyle(element).textDecoration?.includes('underline');
            
            // Extract font family from style
            let fontFamily = element.style.fontFamily || window.getComputedStyle(element).fontFamily;
            if (fontFamily) {
              // Clean up font family string
              fontFamily = fontFamily.replace(/['"]/g, '').split(',')[0].trim();
            }
            
            const newRuns: any[] = [];
            element.childNodes.forEach(child => {
              if (child.nodeType === Node.TEXT_NODE) {
                const text = child.textContent || '';
                if (text.trim()) {
                  const runOptions: any = {
                    text: text,
                    bold: isBold,
                    italics: isItalic,
                    underline: isUnderline ? {} : undefined
                  };
                  
                  // Add font if specified
                  if (fontFamily && fontFamily !== 'inherit') {
                    runOptions.font = { name: fontFamily };
                  }
                  
                  newRuns.push(new TextRun(runOptions));
                }
              } else {
                const childRuns = processNode(child, []);
                childRuns.forEach(run => {
                  // Inherit parent formatting if not already set
                  if (run.bold === undefined || run.bold === false) run.bold = isBold;
                  if (run.italics === undefined || run.italics === false) run.italics = isItalic;
                  if (run.underline === undefined && isUnderline) run.underline = {};
                  
                  // Inherit font if not already set
                  if (fontFamily && fontFamily !== 'inherit' && !run.font) {
                    run.font = { name: fontFamily };
                  }
                  
                  newRuns.push(run);
                });
              }
            });
            return newRuns;
          }
        }
        return currentRuns;
      };
      
      // Process the HTML content
      const bodyChildren = htmlDoc.body.childNodes;
      let currentRuns: any[] = [];
      
      bodyChildren.forEach(node => {
        const runs = processNode(node, currentRuns);
        if (runs.length > 0) {
          currentRuns = runs;
        }
      });
      
      // Add any remaining runs as a paragraph
      if (currentRuns.length > 0) {
        paragraphs.push(new Paragraph({ children: currentRuns }));
      }
      
      // If no paragraphs were created, create one with the plain text
      if (paragraphs.length === 0) {
        // Parse any remaining text content
        const text = htmlDoc.body.textContent || '';
        if (text.trim()) {
          paragraphs.push(new Paragraph({
            children: [new TextRun({
              text: text,
              font: { name: 'Arial' } // Default font
            })]
          }));
        }
      }
      
      const doc = new Document({
        sections: [{
          properties: {},
          children: paragraphs
        }]
      });
  
      const blob = await Packer.toBlob(doc);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${documentTitle}.docx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting to DOCX:', error);
      alert('Failed to export as DOCX. Please try another format.');
    }
  };

  const handleFileImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      setImportText(text);
    };

    if (file.type === 'text/plain' || file.type === 'text/markdown' || file.name.endsWith('.txt') || file.name.endsWith('.md')) {
      reader.readAsText(file);
    } else {
      alert('Please select a text file (.txt or .md)');
    }
  };

  const handleImport = () => {
    if (importText.trim()) {
      onImport(importText);
      onClose();
    }
  };

  const handleCopyToClipboard = async () => {
    try {
      // Copy as rich text (HTML) if possible
      if (navigator.clipboard.write) {
        const htmlBlob = new Blob([content], { type: 'text/html' });
        const plainText = content.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ');
        const textBlob = new Blob([plainText], { type: 'text/plain' });
        
        await navigator.clipboard.write([
          new ClipboardItem({
            'text/html': htmlBlob,
            'text/plain': textBlob
          })
        ]);
      } else {
        // Fallback to plain text
        const plainText = content.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ');
        await navigator.clipboard.writeText(plainText);
      }
      alert('Content copied to clipboard!');
    } catch (error) {
      console.error('Failed to copy:', error);
      alert('Failed to copy to clipboard');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className={`w-full max-w-2xl rounded-lg shadow-xl ${
        isDarkMode ? 'bg-gray-800' : 'bg-white'
      }`}>
        {/* Header */}
        <div className={`border-b p-6 ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
          <div className="flex items-center justify-between">
            <h2 className={`text-xl font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
              Import / Export Document
            </h2>
            <button
              onClick={onClose}
              className={`text-gray-400 hover:text-gray-600 transition-colors`}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className={`flex border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
          <button
            onClick={() => setActiveTab('export')}
            className={`flex-1 py-3 px-4 text-sm font-medium transition-colors ${
              activeTab === 'export'
                ? isDarkMode
                  ? 'bg-gray-700 text-white border-b-2 border-blue-500'
                  : 'bg-gray-50 text-gray-900 border-b-2 border-blue-500'
                : isDarkMode
                  ? 'text-gray-400 hover:text-gray-200'
                  : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            📤 Export
          </button>
          <button
            onClick={() => setActiveTab('import')}
            className={`flex-1 py-3 px-4 text-sm font-medium transition-colors ${
              activeTab === 'import'
                ? isDarkMode
                  ? 'bg-gray-700 text-white border-b-2 border-blue-500'
                  : 'bg-gray-50 text-gray-900 border-b-2 border-blue-500'
                : isDarkMode
                  ? 'text-gray-400 hover:text-gray-200'
                  : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            📥 Import
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {activeTab === 'export' ? (
            <div className="space-y-4">
              <p className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                Choose a format to export your document:
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button
                  onClick={handleExportText}
                  className={`p-4 rounded-lg border transition-colors ${
                    isDarkMode
                      ? 'border-gray-600 hover:bg-gray-700'
                      : 'border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <div className="text-3xl mb-2">📄</div>
                  <div className={`font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    Plain Text (.txt)
                  </div>
                  <div className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    Simple text format
                  </div>
                </button>

                <button
                  onClick={handleExportMarkdown}
                  className={`p-4 rounded-lg border transition-colors ${
                    isDarkMode
                      ? 'border-gray-600 hover:bg-gray-700'
                      : 'border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <div className="text-3xl mb-2">📝</div>
                  <div className={`font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    Markdown (.md)
                  </div>
                  <div className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    Formatted text
                  </div>
                </button>

                <button
                  onClick={handleExportDocx}
                  className={`p-4 rounded-lg border transition-colors ${
                    isDarkMode
                      ? 'border-gray-600 hover:bg-gray-700'
                      : 'border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <div className="text-3xl mb-2">📘</div>
                  <div className={`font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    Word Document (.docx)
                  </div>
                  <div className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    Microsoft Word format
                  </div>
                </button>

                <button
                  onClick={handleCopyToClipboard}
                  className={`p-4 rounded-lg border transition-colors ${
                    isDarkMode
                      ? 'border-gray-600 hover:bg-gray-700'
                      : 'border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <div className="text-3xl mb-2">📋</div>
                  <div className={`font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    Copy to Clipboard
                  </div>
                  <div className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    Copy text to paste elsewhere
                  </div>
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <p className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                Import content from a file or paste text below:
              </p>

              <div className={`border-2 border-dashed rounded-lg p-6 text-center ${
                isDarkMode ? 'border-gray-600' : 'border-gray-300'
              }`}>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".txt,.md,text/plain,text/markdown"
                  onChange={handleFileImport}
                  className="hidden"
                />
                <div className="text-3xl mb-2">📁</div>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="text-blue-600 hover:text-blue-700 font-medium"
                >
                  Choose a file
                </button>
                <p className={`text-sm mt-2 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  or drag and drop a .txt or .md file
                </p>
              </div>

              <div className="space-y-2">
                <label className={`block text-sm font-medium ${
                  isDarkMode ? 'text-gray-300' : 'text-gray-700'
                }`}>
                  Or paste your text here:
                </label>
                <textarea
                  value={importText}
                  onChange={(e) => setImportText(e.target.value)}
                  className={`w-full h-48 p-3 rounded-lg border resize-none ${
                    isDarkMode
                      ? 'bg-gray-700 border-gray-600 text-white'
                      : 'bg-white border-gray-300 text-gray-900'
                  }`}
                  placeholder="Paste your text here..."
                />
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  onClick={onClose}
                  className={`px-4 py-2 rounded-lg border ${
                    isDarkMode
                      ? 'border-gray-600 text-gray-300 hover:bg-gray-700'
                      : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  Cancel
                </button>
                <button
                  onClick={handleImport}
                  disabled={!importText.trim()}
                  className={`px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  Import
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
const pdf = require('pdf-parse');
const mammoth = require('mammoth');
const fs = require('fs').promises;

class FileProcessor {
  constructor() {
    this.supportedTypes = {
      'application/pdf': 'pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
      'application/msword': 'doc',
      'text/plain': 'txt',
      'text/markdown': 'md',
      'application/json': 'json',
      'text/csv': 'csv'
    };
  }

  /**
   * Check if file type is supported
   */
  isSupported(mimeType) {
    return this.supportedTypes.hasOwnProperty(mimeType);
  }

  /**
   * Extract text from uploaded file based on its type
   */
  async extractText(file) {
    try {
      const mimeType = file.mimetype;
      const fileType = this.supportedTypes[mimeType];

      if (!fileType) {
        throw new Error(`Unsupported file type: ${mimeType}`);
      }

      console.log(`📄 Extracting text from ${fileType.toUpperCase()} file: ${file.originalname}`);

      let extractedText = '';
      let metadata = {
        fileType: fileType,
        originalName: file.originalname,
        size: file.size,
        mimeType: mimeType
      };

      switch (fileType) {
        case 'pdf':
          const result = await this.extractFromPDF(file.buffer);
          extractedText = result.text;
          metadata.pageCount = result.pageCount;
          break;

        case 'docx':
          const docxResult = await this.extractFromDOCX(file.buffer);
          extractedText = docxResult.text;
          metadata.wordCount = docxResult.wordCount;
          break;

        case 'doc':
          // For older .doc files, we'll treat them as text for now
          // In production, you might want to use a more sophisticated library
          extractedText = file.buffer.toString('utf8');
          break;

        case 'txt':
        case 'md':
          extractedText = file.buffer.toString('utf8');
          break;

        case 'json':
          const jsonData = JSON.parse(file.buffer.toString('utf8'));
          extractedText = this.extractFromJSON(jsonData);
          break;

        case 'csv':
          extractedText = this.extractFromCSV(file.buffer.toString('utf8'));
          break;

        default:
          throw new Error(`Handler not implemented for file type: ${fileType}`);
      }

      // Clean and validate extracted text
      extractedText = this.cleanText(extractedText);
      
      if (!extractedText || extractedText.trim().length === 0) {
        throw new Error('No text content could be extracted from the file');
      }

      // Add text statistics to metadata
      metadata.wordCount = metadata.wordCount || this.countWords(extractedText);
      metadata.characterCount = extractedText.length;
      metadata.extractedAt = new Date().toISOString();

      console.log(`✅ Extracted ${metadata.wordCount} words (${metadata.characterCount} characters) from ${file.originalname}`);

      return {
        text: extractedText,
        metadata: metadata,
        success: true
      };

    } catch (error) {
      console.error('❌ Error extracting text from file:', error.message);
      throw error;
    }
  }

  /**
   * Extract text from PDF file
   */
  async extractFromPDF(buffer) {
    try {
      const data = await pdf(buffer);
      
      return {
        text: data.text,
        pageCount: data.numpages,
        info: data.info
      };
    } catch (error) {
      throw new Error(`Failed to extract text from PDF: ${error.message}`);
    }
  }

  /**
   * Extract text from DOCX file
   */
  async extractFromDOCX(buffer) {
    try {
      const result = await mammoth.extractRawText({ buffer: buffer });
      
      return {
        text: result.value,
        wordCount: this.countWords(result.value),
        messages: result.messages
      };
    } catch (error) {
      throw new Error(`Failed to extract text from DOCX: ${error.message}`);
    }
  }

  /**
   * Extract text from JSON object
   */
  extractFromJSON(jsonData) {
    try {
      // Convert JSON to readable text format
      const extractText = (obj, prefix = '') => {
        let text = '';
        
        for (const [key, value] of Object.entries(obj)) {
          const currentKey = prefix ? `${prefix}.${key}` : key;
          
          if (typeof value === 'object' && value !== null) {
            if (Array.isArray(value)) {
              text += `${currentKey}: [${value.length} items]\n`;
              value.forEach((item, index) => {
                if (typeof item === 'object') {
                  text += extractText(item, `${currentKey}[${index}]`);
                } else {
                  text += `${currentKey}[${index}]: ${item}\n`;
                }
              });
            } else {
              text += `${currentKey}:\n`;
              text += extractText(value, currentKey);
            }
          } else {
            text += `${currentKey}: ${value}\n`;
          }
        }
        
        return text;
      };

      return extractText(jsonData);
    } catch (error) {
      throw new Error(`Failed to extract text from JSON: ${error.message}`);
    }
  }

  /**
   * Extract text from CSV file
   */
  extractFromCSV(csvContent) {
    try {
      const lines = csvContent.split('\n');
      let text = '';

      lines.forEach((line, index) => {
        if (line.trim()) {
          const columns = line.split(',').map(col => col.trim().replace(/"/g, ''));
          if (index === 0) {
            text += `Headers: ${columns.join(', ')}\n`;
          } else {
            text += `Row ${index}: ${columns.join(', ')}\n`;
          }
        }
      });

      return text;
    } catch (error) {
      throw new Error(`Failed to extract text from CSV: ${error.message}`);
    }
  }

  /**
   * Clean extracted text
   */
  cleanText(text) {
    if (!text) return '';

    return text
      // Normalize whitespace
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      // Remove excessive blank lines
      .replace(/\n\s*\n\s*\n/g, '\n\n')
      // Remove excessive spaces
      .replace(/[ \t]+/g, ' ')
      // Trim each line
      .split('\n')
      .map(line => line.trim())
      .join('\n')
      // Remove leading/trailing whitespace
      .trim();
  }

  /**
   * Count words in text
   */
  countWords(text) {
    if (!text) return 0;
    
    return text
      .trim()
      .split(/\s+/)
      .filter(word => word.length > 0)
      .length;
  }

  /**
   * Validate file before processing
   */
  validateFile(file) {
    const errors = [];

    // Check if file exists
    if (!file) {
      errors.push('No file provided');
      return errors;
    }

    // Check file size (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      errors.push(`File size (${(file.size / 1024 / 1024).toFixed(2)}MB) exceeds maximum allowed size (10MB)`);
    }

    // Check if file type is supported
    if (!this.isSupported(file.mimetype)) {
      errors.push(`Unsupported file type: ${file.mimetype}. Supported types: ${Object.keys(this.supportedTypes).join(', ')}`);
    }

    // Check file name
    if (!file.originalname || file.originalname.trim().length === 0) {
      errors.push('File must have a valid name');
    }

    return errors;
  }

  /**
   * Get supported file types information
   */
  getSupportedTypes() {
    return {
      types: this.supportedTypes,
      mimeTypes: Object.keys(this.supportedTypes),
      extensions: {
        'pdf': 'application/pdf',
        'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'doc': 'application/msword',
        'txt': 'text/plain',
        'md': 'text/markdown',
        'json': 'application/json',
        'csv': 'text/csv'
      }
    };
  }

  /**
   * Generate file processing summary
   */
  generateProcessingSummary(file, extractionResult) {
    return {
      originalFile: {
        name: file.originalname,
        size: file.size,
        sizeFormatted: this.formatFileSize(file.size),
        mimeType: file.mimetype,
        type: this.supportedTypes[file.mimetype]
      },
      extraction: {
        success: extractionResult.success,
        wordCount: extractionResult.metadata.wordCount,
        characterCount: extractionResult.metadata.characterCount,
        pageCount: extractionResult.metadata.pageCount || null,
        extractedAt: extractionResult.metadata.extractedAt
      },
      content: {
        preview: extractionResult.text.substring(0, 300) + (extractionResult.text.length > 300 ? '...' : ''),
        fullLength: extractionResult.text.length
      }
    };
  }

  /**
   * Format file size in human readable format
   */
  formatFileSize(bytes) {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    const i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  }
}

module.exports = new FileProcessor();
/**
 * A utility to split large text into chunks of a given maximum size.
 * Uses a simple recursive character splitting strategy (paragraphs -> sentences -> words)
 * with overlap to preserve context between chunks.
 */

export interface Chunk {
  text: string;
  index: number;
}

export function chunkText(text: string, maxChunkSize = 1000, overlapSize = 100): Chunk[] {
  if (!text) return [];

  // Normalize newlines
  const normalizedText = text.replace(/\r\n/g, "\n");
  
  if (normalizedText.length <= maxChunkSize) {
    return [{ text: normalizedText, index: 0 }];
  }

  const chunks: string[] = [];
  let currentPos = 0;

  while (currentPos < normalizedText.length) {
    // If the remaining text is smaller than max size, grab it all
    if (normalizedText.length - currentPos <= maxChunkSize) {
      chunks.push(normalizedText.slice(currentPos));
      break;
    }

    // Try to find a good splitting point within the maxChunkSize limit
    const chunkEndPos = currentPos + maxChunkSize;
    const textToSearch = normalizedText.slice(currentPos, chunkEndPos);
    
    // Prefer splitting at double newline (paragraphs)
    let splitIndex = textToSearch.lastIndexOf("\n\n");
    
    // If no paragraph break, try single newline
    if (splitIndex === -1 || splitIndex < maxChunkSize * 0.5) {
      const singleNewline = textToSearch.lastIndexOf("\n");
      if (singleNewline > maxChunkSize * 0.5) {
        splitIndex = singleNewline;
      }
    }
    
    // If no newline, try period + space (sentence)
    if (splitIndex === -1 || splitIndex < maxChunkSize * 0.5) {
      const periodSpace = textToSearch.lastIndexOf(". ");
      if (periodSpace > maxChunkSize * 0.5) {
        splitIndex = periodSpace + 1; // include the period
      }
    }
    
    // If no sentence break, try any space
    if (splitIndex === -1 || splitIndex < maxChunkSize * 0.5) {
      splitIndex = textToSearch.lastIndexOf(" ");
    }
    
    // If still no good split, just hard split at maxChunkSize
    if (splitIndex === -1 || splitIndex < maxChunkSize * 0.5) {
      splitIndex = maxChunkSize;
    } else {
      // Include the split character itself (if it was a newline, maybe exclude it or keep it)
      // We'll keep it for simplicity.
    }

    chunks.push(normalizedText.slice(currentPos, currentPos + splitIndex).trim());
    
    // Advance currentPos, moving back by overlapSize to maintain context
    currentPos += splitIndex;
    if (currentPos < normalizedText.length) {
      currentPos = Math.max(0, currentPos - overlapSize);
    }
  }

  return chunks.map((text: any, index: any) => ({ text, index }));
}


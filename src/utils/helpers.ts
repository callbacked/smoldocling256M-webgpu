// extract LaTeX content from formula tags
export function extractFormulaContent(rawOutput: string): string {
  if (!rawOutput) return '';
  // match content within <formula>...</formula> tags
  const match = rawOutput.match(/<formula>([\s\S]*?)<\/formula>/);
  if (match && match[1]) {
    // strip <loc_...> tags 
    return match[1].replace(/<loc_.*?>/g, '').trim();
  }

  return "Could not parse formula from model output.";
}

// extract code content and language
export function extractCodeContent(rawOutput: string): { code: string, language: string } {
  if (!rawOutput) return { code: '', language: 'text' };
  
  let code = '';
  let language = 'text';
  
  // the raw output contains the lang name like <_Java_>, <_Python_>, etc before showing the code.
  const langMatch = rawOutput.match(/<_([A-Za-z0-9#+]+)_>/);
  if (langMatch && langMatch[1]) {
    language = langMatch[1].toLowerCase();
  }
  
  // extract everything after the language tag
  if (langMatch) {
    const startPos = rawOutput.indexOf(langMatch[0]) + langMatch[0].length;
    code = rawOutput.substring(startPos).trim();
  } else {

    code = rawOutput;
  }
  
  // clean up 
  code = code
    .replace(/<\/code>/g, '') // closing code tags
    .replace(/<end_of_utterance>/g, '') // end of utterance tags
    .replace(/<\/.*?>/g, '') // other closing tags
    .trim();
  
  return { code, language };
}

// convert OTSL to an HTML table (to render in the UI, when copying the output in md view)
export function otslToHTML(otslString: string): string {
  if (!otslString) return '<p>No table data available.</p>';

  // match <otsl> or <chart> tags
  const otslMatch = otslString.match(/<(otsl|chart)>([\s\S]*?)<\/\1>/);
  if (!otslMatch) return '<p>Could not find OTSL tags in the output.</p>';
  
  const cleanOtsl = otslMatch[2].replace(/<loc_.*?>/g, '').trim();
  
  // Tokenize the OTSL string into tags and their corresponding text
  const parts = cleanOtsl.split(/(<[^>]+>)/g).filter(p => p.trim());
  const tokens: { tag: string; text: string }[] = [];
  for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (part.startsWith('<')) {
          const tag = part;
          const text = (i + 1 < parts.length && !parts[i + 1].startsWith('<')) ? parts[i + 1].trim() : '';
          tokens.push({ tag, text });
          if (text) i++;
      } else {
          tokens.push({ tag: '<fcel>', text: part.trim() });
      }
  }

  if (tokens.length === 0) return '<p>Could not parse any tokens from OTSL.</p>';
  
  // First pass: Build a 2D grid representation from tokens
  const grid: { 
    text: string; 
    tag: string; 
    isColSpan: boolean;
    isRowSpan: boolean;
    isCrossSpan: boolean;
  }[][] = [[]];
  
  let currentRow = 0;
  
  for (const token of tokens) {
      if (token.tag === '<nl>') {
          currentRow++;
          grid[currentRow] = [];
      } else {
          if (!grid[currentRow]) grid[currentRow] = [];
          grid[currentRow].push({ 
            text: token.text, 
            tag: token.tag,
            isColSpan: token.tag === '<lcel>',
            isRowSpan: token.tag === '<ucel>',
            isCrossSpan: token.tag === '<xcel>'
          });
      }
  }

  // Second pass: Calculate row and column spans
  // Create a new grid with span information
  const processedGrid: {
    text: string;
    tag: string;
    rowSpan: number;
    colSpan: number;
    skip: boolean;
  }[][] = [];

  // Initialize processedGrid with basic cell info
  for (let r = 0; r < grid.length; r++) {
    processedGrid[r] = [];
    for (let c = 0; c < (grid[r] || []).length; c++) {
      const cell = grid[r][c];
      processedGrid[r][c] = {
        text: cell.text,
        tag: cell.tag,
        rowSpan: 1,
        colSpan: 1,
        skip: cell.isColSpan || cell.isRowSpan || cell.isCrossSpan
      };
    }
  }

  // Calculate column spans (horizontal spans)
  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < (grid[r] || []).length; c++) {
      if (!processedGrid[r][c].skip) {
        // Count consecutive <lcel> or <xcel> cells to the right
        let colSpan = 1;
        for (let nextCol = c + 1; nextCol < (grid[r] || []).length; nextCol++) {
          if (grid[r][nextCol].isColSpan || grid[r][nextCol].isCrossSpan) {
            colSpan++;
          } else {
            break;
          }
        }
        processedGrid[r][c].colSpan = colSpan;
      }
    }
  }

  // Calculate row spans (vertical spans)
  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < (grid[r] || []).length; c++) {
      if (!processedGrid[r][c].skip) {
        // Count consecutive <ucel> or <xcel> cells below
        let rowSpan = 1;
        for (let nextRow = r + 1; nextRow < grid.length; nextRow++) {
          if (nextRow < grid.length && 
              c < (grid[nextRow] || []).length && 
              (grid[nextRow][c].isRowSpan || grid[nextRow][c].isCrossSpan)) {
            rowSpan++;
          } else {
            break;
          }
        }
        processedGrid[r][c].rowSpan = rowSpan;
      }
    }
  }

  // Generate HTML from the processed grid
  let html = '<table class="rendered-table">';
  
  for (let r = 0; r < processedGrid.length; r++) {
    const row = processedGrid[r];
    if (!row || row.length === 0) continue;

    html += '<tr>';
    for (let c = 0; c < row.length; c++) {
      const cell = row[c];
      
      // Skip cells that are part of a span
      if (cell.skip) continue;

      // Determine if this is a header cell
      const isHeader = cell.tag === '<ched>' || cell.tag === '<rhed>' || cell.tag === '<srow>' || 
                      (c === 0 && (cell.tag === '<fcel>' || cell.tag === '<unknown>')); // First column in charts is often headers
      
      const tag = isHeader ? 'th' : 'td';
      const rowSpanAttr = cell.rowSpan > 1 ? ` rowspan="${cell.rowSpan}"` : '';
      const colSpanAttr = cell.colSpan > 1 ? ` colspan="${cell.colSpan}"` : '';
      const cellContent = cell.text || '&nbsp;'; // Use non-breaking space for empty cells

      html += `<${tag}${rowSpanAttr}${colSpanAttr}>${cellContent}</${tag}>`;
    }
    html += '</tr>';
  }

  html += '</table>';
  return html;
}

// doctags to markdown conversion 
export function docTagsToMarkdown(docTags: string): string {
  const cleanedTags = docTags
    .replace(/<end_of_utterance>|Assistant:|<pad>|User:|Convert this page to docling\./g, '')
    .trim();
  
  // Check if we have proper DocTags format with <doctag> wrapper
  if (cleanedTags.includes('<doctag>')) {
    // Process section headers with proper formatting
    let markdown = cleanedTags
      // Process section headers
      .replace(/<section_header_level_1>.*?<loc_.*?>(.*?)<\/section_header_level_1>/g, '\n## $1\n')
      .replace(/<section_header_level_2>.*?<loc_.*?>(.*?)<\/section_header_level_2>/g, '\n### $1\n')
      .replace(/<section_header_level_3>.*?<loc_.*?>(.*?)<\/section_header_level_3>/g, '\n#### $1\n')
      
      // Process text elements
      .replace(/<text>.*?<loc_.*?>(.*?)<\/text>/g, '$1\n')
      
      // Process lists with proper formatting
      .replace(/<unordered_list>\s*/g, '\n')
      .replace(/\s*<\/unordered_list>/g, '\n')
      .replace(/<list_item>.*?<loc_.*?>(.*?)<\/list_item>/g, '- $1\n')
      
      // Process tables (if any)
      .replace(/<table>.*?<loc_.*?>(.*?)<\/table>/g, '\n$1\n')
      .replace(/<table_row>.*?<loc_.*?>(.*?)<\/table_row>/g, '| $1 |\n')
      .replace(/<table_cell>.*?<loc_.*?>(.*?)<\/table_cell>/g, ' $1 |')
      
      // Clean up any remaining tags
      .replace(/<[^>]+>/g, '')
      
      // Fix multiple newlines
      .replace(/\n{3,}/g, '\n\n');
      
    // Add some final formatting touches
    markdown = markdown.trim();
    
    return markdown;
  } else {
    // We have the raw format with location numbers
    // Replace location patterns like 1>154>22>346>38> with empty string
    let markdown = cleanedTags.replace(/\d+>\d+>\d+>\d+>\d+>/g, '');
    
    // Fix email addresses (they might be broken by the location pattern replacement)
    markdown = markdown.replace(/([a-zA-Z0-9._%+-]+)@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g, '$1@$2');
    
    // Add proper line breaks
    markdown = markdown.replace(/\s{2,}/g, '\n\n');
    
    return markdown;
  }
}

// doctags to json conversion
export function docTagsToJSON(docTags: string): string {
  const cleanedTags = docTags
    .replace(/<end_of_utterance>|Assistant:|<pad>|User:|Convert this page to docling\./g, '')
    .trim();
  
  // Initialize the document structure
  const document: {
    sections: Array<{
      type: string;
      level?: number;
      content: string;
      location?: string;
      position?: number; // Position in the original document
      items?: Array<{ content: string; location?: string }>;
      rows?: Array<{ cells: Array<{ content: string; location?: string }> }>;
    }>;
  } = {
    sections: []
  };
  
  // Helper function to clean location tags from content
  const cleanLocationTags = (text: string): string => {
    return text.replace(/<loc_\d+>/g, '');
  };
  
  try {
    // Check if we have proper DocTags format with <doctag> wrapper
    if (cleanedTags.includes('<doctag>')) {
      // We'll create a map of all elements with their positions in the original text
      const allElements: Array<{
        type: string;
        level?: number;
        content: string;
        location?: string;
        position: number; // Position in the original document
        items?: Array<{ content: string; location?: string }>;
        rows?: Array<{ cells: Array<{ content: string; location?: string }> }>;
      }> = [];
      
      // Extract section headers with their positions
      const extractElements = (regex: RegExp, type: string, level?: number) => {
        let match;
        while ((match = regex.exec(cleanedTags)) !== null) {
          allElements.push({
            type,
            level,
            content: cleanLocationTags(match[2]),
            location: match[1],
            position: match.index // Store the position in the original string
          });
        }
      };
      
      // Define all the regexes
      const sectionHeaderRegex1 = /<section_header_level_1>.*?<loc_(.*?)>(.*?)<\/section_header_level_1>/g;
      const sectionHeaderRegex2 = /<section_header_level_2>.*?<loc_(.*?)>(.*?)<\/section_header_level_2>/g;
      const sectionHeaderRegex3 = /<section_header_level_3>.*?<loc_(.*?)>(.*?)<\/section_header_level_3>/g;
      const textRegex = /<text>.*?<loc_(.*?)>(.*?)<\/text>/g;
      
      // Extract all elements with their positions
      extractElements(sectionHeaderRegex1, 'header', 1);
      extractElements(sectionHeaderRegex2, 'header', 2);
      extractElements(sectionHeaderRegex3, 'header', 3);
      extractElements(textRegex, 'text');
      
      // Extract lists and list items
      const listRegex = /<unordered_list>([\s\S]*?)<\/unordered_list>/g;
      const listItemRegex = /<list_item>.*?<loc_(.*?)>(.*?)<\/list_item>/g;
      
      let match;
      while ((match = listRegex.exec(cleanedTags)) !== null) {
        const listContent = match[1];
        const listSection = {
          type: 'unordered_list',
          content: '',
          position: match.index,
          items: [] as Array<{ content: string; location?: string }>
        };
        
        // Find all list items within this list
        let itemMatch;
        const localListItemRegex = new RegExp(listItemRegex.source, 'g');
        while ((itemMatch = localListItemRegex.exec(listContent)) !== null) {
          listSection.items?.push({
            content: cleanLocationTags(itemMatch[2]),
            location: itemMatch[1]
          });
        }
        
        allElements.push(listSection);
      }
      
      // Extract tables
      const tableRegex = /<table>.*?<loc_(.*?)>(.*?)<\/table>/g;
      const tableRowRegex = /<table_row>.*?<loc_(.*?)>(.*?)<\/table_row>/g;
      const tableCellRegex = /<table_cell>.*?<loc_(.*?)>(.*?)<\/table_cell>/g;
      
      while ((match = tableRegex.exec(cleanedTags)) !== null) {
        const tableSection = {
          type: 'table',
          content: cleanLocationTags(match[2]),
          location: match[1],
          position: match.index,
          rows: [] as Array<{ cells: Array<{ content: string; location?: string }> }>
        };
        
        // Extract the table content
        const tableContent = match[0];
        
        // Find all rows in this table
        let rowMatch;
        const rowRegex = new RegExp(tableRowRegex.source, 'g');
        while ((rowMatch = rowRegex.exec(tableContent)) !== null) {
          const rowContent = rowMatch[0];
          const row = {
            cells: [] as Array<{ content: string; location?: string }>
          };
          
          // Find all cells in this row
          let cellMatch;
          const cellRegex = new RegExp(tableCellRegex.source, 'g');
          while ((cellMatch = cellRegex.exec(rowContent)) !== null) {
            row.cells.push({
              content: cleanLocationTags(cellMatch[2]),
              location: cellMatch[1]
            });
          }
          
          tableSection.rows.push(row);
        }
        
        allElements.push(tableSection);
      }
      
      // Sort elements by their position in the original document
      allElements.sort((a, b) => a.position - b.position);
      
      // Remove the position property before adding to final document
      document.sections = allElements.map(({ position, ...rest }) => rest);
      
    } else {
      // For raw format, we need a different approach
      // First, find all location patterns and their positions
      const locationPattern = /(\d+)>(\d+)>(\d+)>(\d+)>(\d+)>/g;
      const locations: Array<{ index: number, text: string, position: number }> = [];
      
      let match;
      while ((match = locationPattern.exec(cleanedTags)) !== null) {
        locations.push({
          index: match.index,
          text: match[0],
          position: parseInt(match[2]) // Use the second number as position
        });
      }
      
      // Split the text by location patterns
      const parts = cleanedTags.split(locationPattern);
      
      // Remove empty parts and create text sections with positions
      const sections: Array<{ content: string, position: number }> = [];
      
      for (let i = 1; i < parts.length; i += 1) {
        const part = parts[i];
        if (part && part.trim() && !part.match(/^\d+$/)) {
          // Find the corresponding location
          const locationIndex = Math.floor((i - 1) / 5);
          const position = locationIndex < locations.length ? locations[locationIndex].position : i;
          
          sections.push({
            content: cleanLocationTags(part.trim()),
            position
          });
        }
      }
      
      // Sort by position
      sections.sort((a, b) => a.position - b.position);
      
      // Convert to document sections
      document.sections = sections.map(section => ({
        type: 'text',
        content: section.content
      }));
    }
    
    return JSON.stringify(document, null, 2);
  } catch (error) {
    console.error('Error converting DocTags to JSON:', error);
    return JSON.stringify({ error: 'Failed to parse DocTags', rawContent: cleanedTags }, null, 2);
  }
}

// convert OTSL to markdown table (this is used for the code that is copied to the clipboard or downloaded)
export function otslToMarkdown(otslString: string): string {
  if (!otslString) return 'No table data available.';

  // Match either <otsl> or <chart> tags
  const otslMatch = otslString.match(/<(otsl|chart)>([\s\S]*?)<\/\1>/);
  if (!otslMatch) return 'Could not find OTSL tags in the output.';
  
  const cleanOtsl = otslMatch[2].replace(/<loc_.*?>/g, '').trim();
  
  // Tokenize the OTSL string into tags and their corresponding text
  const parts = cleanOtsl.split(/(<[^>]+>)/g).filter(p => p.trim());
  const tokens: { tag: string; text: string }[] = [];
  for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (part.startsWith('<')) {
          const tag = part;
          const text = (i + 1 < parts.length && !parts[i + 1].startsWith('<')) ? parts[i + 1].trim() : '';
          tokens.push({ tag, text });
          if (text) i++;
      } else {
          tokens.push({ tag: '<fcel>', text: part.trim() });
      }
  }

  if (tokens.length === 0) return 'Could not parse any tokens from OTSL.';
  
  // Build a 2D grid representation from tokens
  const rows: string[][] = [[]];
  let currentRow = 0;
  
  for (const token of tokens) {
      if (token.tag === '<nl>') {
          currentRow++;
          rows[currentRow] = [];
      } else if (token.tag !== '<xcel>' && token.tag !== '<lcel>' && token.tag !== '<ucel>') {
          // Skip span cells as they're just placeholders
          if (!rows[currentRow]) rows[currentRow] = [];
          rows[currentRow].push(token.text);
      }
  }

  // Convert the grid to a Markdown table
  let markdown = '';
  
  // Add header row
  if (rows.length > 0) {
      markdown += '| ' + rows[0].join(' | ') + ' |\n';
      // Add separator row
      markdown += '| ' + rows[0].map(() => '---').join(' | ') + ' |\n';
      
      // Add data rows
      for (let i = 1; i < rows.length; i++) {
          if (rows[i].length > 0) {
              markdown += '| ' + rows[i].join(' | ') + ' |\n';
          }
      }
  }
  
  return markdown;
} 
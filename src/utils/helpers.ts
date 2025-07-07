/* 
otsl and doctags ref (gemini did me a solid on the parsing stuff here): 
https://arxiv.org/pdf/2305.03393
https://github.com/docling-project/docling-core/blob/bf88e9d55db936d57d090bf8331fc92c3b513087/test/test_otsl_table_export.py#L258-L284
https://github.com/docling-project/docling-core/blob/bf88e9d55db936d57d090bf8331fc92c3b513087/test/data/legacy_doc/doc-export.md#L102-L106
https://huggingface.co/spaces/ds4sd/SmolDocling-256M-Demo/blob/12df581e7fb68a527eb8e857c6a1caea6da3828c/app.py#L35
*/
// extract math formulas from formula tags
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

export function extractCodeContent(rawOutput: string): { code: string, language: string } {
  if (!rawOutput) return { code: '', language: 'text' };
  
  let code = '';
  let language = 'text';
  
  // the raw output contains the lang name like <_Java_>, <_Python_>, etc before showing the code
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
    .replace(/<\/code>/g, '') 
    .replace(/<end_of_utterance>/g, '') 
    .replace(/<\/.*?>/g, '') 
    .trim();
  
  return { code, language };
}

function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// handles both HTML rendering for UI and Markdown generation for clipboard/download
// HTML rendering is done because markdown rendering does not allow for rowspan/colspan, so for presentation purposes in the UI it is rendered as HTML
// but the markdown representation of the parsed OTSL used in the copy/download retains the table structure as accurately as possible
// this is a reasonable approach tbh
// alternatively, we could use inline html in markdown, but I think it'd be messier to export and use

export function processOTSL(otslString: string, format: 'html' | 'markdown' = 'html'): string {
  if (!otslString) return format === 'html' ? '<p>No table data available.</p>' : 'No table data available.';

  // Match either <otsl> or <chart> tags
  const otslMatch = otslString.match(/<(otsl|chart)>([\s\S]*?)<\/\1>/);
  if (!otslMatch) {
    return format === 'html' ? 
      '<p>Could not find OTSL tags in the output.</p>' : 
      'Could not find OTSL tags in the output.';
  }
  
  const cleanOtsl = otslMatch[2].replace(/<loc_.*?>/g, '').trim();
  

  const parts = cleanOtsl.split(/(<[^>]+>)/g).filter(p => p.trim());
  const tokens: { tag: string; text: string }[] = [];
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (part.startsWith('<')) {
      const tag = part;
      const text = (i + 1 < parts.length && !parts[i + 1].startsWith('<')) ? parts[i + 1].trim() : '';
      tokens.push({ 
        tag, 
        text: format === 'html' ? escapeHtml(text) : text 
      });
      if (text) i++;
    } else {
      tokens.push({ 
        tag: '<fcel>', 
        text: format === 'html' ? escapeHtml(part.trim()) : part.trim() 
      });
    }
  }

  if (tokens.length === 0) {
    return format === 'html' ? 
      '<p>Could not parse any tokens from OTSL.</p>' : 
      'Could not parse any tokens from OTSL.';
  }
  
  if (format === 'markdown') {
    // build a 2D grid representation from tokens
    const rows: string[][] = [[]];
    let currentRow = 0;
    
    for (const token of tokens) {
      if (token.tag === '<nl>') {
        currentRow++;
        rows[currentRow] = [];
      } else if (token.tag !== '<xcel>' && token.tag !== '<lcel>' && token.tag !== '<ucel>') {
        if (!rows[currentRow]) rows[currentRow] = [];
        rows[currentRow].push(token.text);
      }
    }
    let markdown = '';
    
    // add header row
    if (rows.length > 0) {
      markdown += '| ' + rows[0].join(' | ') + ' |\n';
      // add separator row
      markdown += '| ' + rows[0].map(() => '---').join(' | ') + ' |\n';
      
      // add data rows
      for (let i = 1; i < rows.length; i++) {
        if (rows[i].length > 0) {
          markdown += '| ' + rows[i].join(' | ') + ' |\n';
        }
      }
    }
    
    return markdown;
  }
  
  // For HTML format, continue with the more complex table generation with rowspan/colspan support
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

  // Calculate row spans 
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

  // generate HTML 
  let html = '<table class="rendered-table">';
  
  for (let r = 0; r < processedGrid.length; r++) {
    const row = processedGrid[r];
    if (!row || row.length === 0) continue;

    html += '<tr>';
    for (let c = 0; c < row.length; c++) {
      const cell = row[c];
      
      if (cell.skip) continue;

      // header cell check
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


export function otslToHTML(otslString: string): string {
  return processOTSL(otslString, 'html');
}

export function otslToMarkdown(otslString: string): string {
  return processOTSL(otslString, 'markdown');
}

// doctags to markdown conversion 
export function docTagsToMarkdown(docTags: string): string {
  const cleanedTags = docTags
    .replace(/<end_of_utterance>|Assistant:|<pad>|User:|Convert this page to docling\./g, '')
    .trim();
  
  if (cleanedTags.includes('<doctag>')) {

    let markdown = cleanedTags
      .replace(/<section_header_level_1>.*?<loc_.*?>(.*?)<\/section_header_level_1>/g, '\n## $1\n')
      .replace(/<section_header_level_2>.*?<loc_.*?>(.*?)<\/section_header_level_2>/g, '\n### $1\n')
      .replace(/<section_header_level_3>.*?<loc_.*?>(.*?)<\/section_header_level_3>/g, '\n#### $1\n')
      
      // text elements
      .replace(/<text>.*?<loc_.*?>(.*?)<\/text>/g, '$1\n')
      
      // lists with proper formatting
      .replace(/<unordered_list>\s*/g, '\n')
      .replace(/\s*<\/unordered_list>/g, '\n')
      .replace(/<list_item>.*?<loc_.*?>(.*?)<\/list_item>/g, '- $1\n')
      
      // tables 
      .replace(/<table>.*?<loc_.*?>(.*?)<\/table>/g, '\n$1\n')
      .replace(/<table_row>.*?<loc_.*?>(.*?)<\/table_row>/g, '| $1 |\n')
      .replace(/<table_cell>.*?<loc_.*?>(.*?)<\/table_cell>/g, ' $1 |')
      

      .replace(/<[^>]+>/g, '')
      .replace(/\n{3,}/g, '\n\n');
      
    markdown = markdown.trim();
    
    return markdown;
  } else {

    let markdown = cleanedTags.replace(/\d+>\d+>\d+>\d+>\d+>/g, '');
    
    markdown = markdown.replace(/([a-zA-Z0-9._%+-]+)@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g, '$1@$2');
    markdown = markdown.replace(/\s{2,}/g, '\n\n');
    
    return markdown;
  }
}

// doctags to json conversion
export function docTagsToJSON(docTags: string): string {
  const cleanedTags = docTags
    .replace(/<end_of_utterance>|Assistant:|<pad>|User:|Convert this page to docling\./g, '')
    .trim();
  
  const document: {
    sections: Array<{
      type: string;
      level?: number;
      content: string;
      location?: string;
      position?: number; 
      items?: Array<{ content: string; location?: string }>;
      rows?: Array<{ cells: Array<{ content: string; location?: string }> }>;
    }>;
  } = {
    sections: []
  };
  
  const cleanLocationTags = (text: string): string => {
    return text.replace(/<loc_\d+>/g, '');
  };
  
  try {
    if (cleanedTags.includes('<doctag>')) {
      const allElements: Array<{
        type: string;
        level?: number;
        content: string;
        location?: string;
        position: number; 
        items?: Array<{ content: string; location?: string }>;
        rows?: Array<{ cells: Array<{ content: string; location?: string }> }>;
      }> = [];
      
      const extractElements = (regex: RegExp, type: string, level?: number) => {
        let match;
        while ((match = regex.exec(cleanedTags)) !== null) {
          allElements.push({
            type,
            level,
            content: cleanLocationTags(match[2]),
            location: match[1],
            position: match.index 
          });
        }
      };
      
      const sectionHeaderRegex1 = /<section_header_level_1>.*?<loc_(.*?)>(.*?)<\/section_header_level_1>/g;
      const sectionHeaderRegex2 = /<section_header_level_2>.*?<loc_(.*?)>(.*?)<\/section_header_level_2>/g;
      const sectionHeaderRegex3 = /<section_header_level_3>.*?<loc_(.*?)>(.*?)<\/section_header_level_3>/g;
      const textRegex = /<text>.*?<loc_(.*?)>(.*?)<\/text>/g;
      
      extractElements(sectionHeaderRegex1, 'header', 1);
      extractElements(sectionHeaderRegex2, 'header', 2);
      extractElements(sectionHeaderRegex3, 'header', 3);
      extractElements(textRegex, 'text');
      
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
        
        const tableContent = match[0];
        
        let rowMatch;
        const rowRegex = new RegExp(tableRowRegex.source, 'g');
        while ((rowMatch = rowRegex.exec(tableContent)) !== null) {
          const rowContent = rowMatch[0];
          const row = {
            cells: [] as Array<{ content: string; location?: string }>
          };
          
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
      
      allElements.sort((a, b) => a.position - b.position);
      
      document.sections = allElements.map(({ position, ...rest }) => rest);
      
    } else {
      const locationPattern = /(\d+)>(\d+)>(\d+)>(\d+)>(\d+)>/g;
      const locations: Array<{ index: number, text: string, position: number }> = [];
      
      let match;
      while ((match = locationPattern.exec(cleanedTags)) !== null) {
        locations.push({
          index: match.index,
          text: match[0],
          position: parseInt(match[2]) 
        });
      }
      
      const parts = cleanedTags.split(locationPattern);
      const sections: Array<{ content: string, position: number }> = [];
      
      for (let i = 1; i < parts.length; i += 1) {
        const part = parts[i];
        if (part && part.trim() && !part.match(/^\d+$/)) {
          const locationIndex = Math.floor((i - 1) / 5);
          const position = locationIndex < locations.length ? locations[locationIndex].position : i;
          
          sections.push({
            content: cleanLocationTags(part.trim()),
            position
          });
        }
      }
      
      sections.sort((a, b) => a.position - b.position);
      
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
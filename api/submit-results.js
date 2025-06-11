import { put } from '@vercel/blob';

export const config = {
  runtime: 'edge'
};

export default async function handler(req) {
  // Set CORS headers for all responses
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };

  // Handle preflight request
  if (req.method === 'OPTIONS') {
    return new Response(null, { 
      status: 200, 
      headers 
    });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ 
        success: false, 
        message: 'Method not allowed. Use POST.' 
      }), 
      { 
        status: 405, 
        headers: { ...headers, 'Content-Type': 'application/json' } 
      }
    );
  }

  try {
    const data = await req.json();
    
    // Validate required data
    if (!data.participant_id || !data.results || !Array.isArray(data.results)) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: 'Missing required data: participant_id and results array' 
        }), 
        { 
          status: 400, 
          headers: { ...headers, 'Content-Type': 'application/json' } 
        }
      );
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `cloze_results_${timestamp}_${data.participant_id}_${data.selected_list || 'unknown'}.csv`;
    
    // Convert to CSV format
    const csvContent = formatDataAsCSV(data);
    
    // Store in Vercel Blob Storage
    const blob = await put(filename, csvContent, {
      access: 'public', // Make it public for easier debugging
      contentType: 'text/csv'
    });

    // Return success response
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Results saved successfully',
        submission_id: filename.replace('.csv', ''),
        timestamp: new Date().toISOString(),
        url: blob.url
      }), 
      { 
        status: 200, 
        headers: { ...headers, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error saving results:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        message: 'Failed to save results to server',
        error: error.message
      }), 
      { 
        status: 500, 
        headers: { ...headers, 'Content-Type': 'application/json' } 
      }
    );
  }
}

function formatDataAsCSV(data) {
  let csv = '';
  
  // Add metadata header (similar to PCIbex format)
  csv += `# Cloze Norming Study Results\n`;
  csv += `# Generated on ${new Date().toUTCString()}\n`;
  csv += `# Participant ID: ${data.participant_id}\n`;
  csv += `# Selected List: ${data.selected_list || 'unknown'}\n`;
  csv += `# Session Start: ${data.session_start || 'unknown'}\n`;
  csv += `# Session End: ${data.session_end || new Date().toISOString()}\n`;
  csv += `# Total Trials: ${data.results.length}\n`;
  csv += `# Browser: ${data.browser_info?.user_agent || 'unknown'}\n`;
  csv += `# Screen: ${data.browser_info?.screen_width || 'unknown'}x${data.browser_info?.screen_height || 'unknown'}\n`;
  csv += `# Language: ${data.browser_info?.language || 'unknown'}\n`;
  csv += `#\n`;
  
  if (data.results && data.results.length > 0) {
    // Get headers from first result object
    const headers = Object.keys(data.results[0]);
    
    // Add CSV headers
    csv += headers.join(',') + '\n';
    
    // Add data rows
    data.results.forEach(result => {
      const row = headers.map(header => {
        let value = result[header];
        
        // Handle null/undefined values
        if (value === null || value === undefined) {
          value = '';
        }
        
        // Convert to string and handle special characters
        value = String(value);
        
        // Escape CSV special characters
        if (value.includes(',') || value.includes('"') || value.includes('\n') || value.includes('\r')) {
          value = `"${value.replace(/"/g, '""')}"`;
        }
        
        return value;
      });
      
      csv += row.join(',') + '\n';
    });
  }
  
  // Add summary statistics
  csv += '\n# SUMMARY STATISTICS\n';
  csv += `# Total Trials,${data.results.length}\n`;
  
  if (data.word_frequencies) {
    csv += `# Unique Words Used,${Object.keys(data.word_frequencies).length}\n`;
    
    // Calculate total word usage
    const totalWords = Object.values(data.word_frequencies).reduce((sum, count) => sum + count, 0);
    csv += `# Total Word Usage,${totalWords}\n`;
    
    // Find most frequent word
    let mostFrequentWord = '';
    let maxCount = 0;
    for (const [word, count] of Object.entries(data.word_frequencies)) {
      if (count > maxCount) {
        maxCount = count;
        mostFrequentWord = word;
      }
    }
    csv += `# Most Frequent Word,"${mostFrequentWord}",${maxCount}\n`;
  }
  
  // Add word frequency breakdown
  if (data.word_frequencies && Object.keys(data.word_frequencies).length > 0) {
    csv += '\n# WORD FREQUENCIES\n';
    csv += '# Word,Usage_Count\n';
    
    // Sort by frequency (descending)
    const sortedWords = Object.entries(data.word_frequencies)
      .sort(([,a], [,b]) => b - a);
    
    sortedWords.forEach(([word, count]) => {
      csv += `# "${word}",${count}\n`;
    });
  }
  
  return csv;
}

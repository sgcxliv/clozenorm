import { put } from '@vercel/blob';

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ 
      success: false, 
      message: 'Method not allowed. Use POST.' 
    });
  }

  try {
    const data = req.body;
    
    // Validate required data
    if (!data.participant_id || !data.results || !Array.isArray(data.results)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Missing required data: participant_id and results array' 
      });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `cloze_results_${timestamp}_${data.participant_id}_${data.selected_list || 'unknown'}.csv`;
    
    // Convert to CSV format
    const csvContent = formatDataAsCSV(data);
    
    // Store in Vercel Blob Storage
    const blob = await put(filename, csvContent, {
      access: 'private', // Private access - only you can see it
      contentType: 'text/csv'
    });

    // Log for debugging (visible in Vercel function logs)
    console.log(`Results saved for participant ${data.participant_id}:`, {
      filename,
      url: blob.url,
      trials: data.results.length,
      timestamp: new Date().toISOString()
    });

    // Return success response
    res.status(200).json({ 
      success: true, 
      message: 'Results saved successfully',
      submission_id: filename.replace('.csv', ''),
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error saving results:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to save results to server',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
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
  
  // Add response time statistics if available
  if (data.results.length > 0 && data.results[0].response_time_ms) {
    const responseTimes = data.results.map(r => r.response_time_ms).filter(rt => rt != null);
    if (responseTimes.length > 0) {
      const avgResponseTime = responseTimes.reduce((sum, rt) => sum + rt, 0) / responseTimes.length;
      const minResponseTime = Math.min(...responseTimes);
      const maxResponseTime = Math.max(...responseTimes);
      
      csv += `# Average Response Time (ms),${Math.round(avgResponseTime)}\n`;
      csv += `# Min Response Time (ms),${minResponseTime}\n`;
      csv += `# Max Response Time (ms),${maxResponseTime}\n`;
    }
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

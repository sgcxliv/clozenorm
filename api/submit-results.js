import { put } from '@vercel/blob';

// Change your function signature to use Node.js style request/response
export default async function handler(req, res) {
  console.time('total-execution');
  
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
    console.time('json-parse');
    // Use req.body instead of req.json()
    const data = req.body;
    console.timeEnd('json-parse');
    console.log(`Data size: ${JSON.stringify(data).length} characters, ${data.results.length} results`);
    
    // Validate required data
    if (!data.participant_id || !data.results || !Array.isArray(data.results)) {
      console.timeEnd('total-execution');
      return res.status(400).json({
        success: false,
        message: 'Missing required data: participant_id and results array'
      });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `cloze_results_${timestamp}_${data.participant_id}_${data.selected_list || 'unknown'}.csv`;
    
    // Convert to CSV format - only including the essential fields
    console.time('csv-format');
    const csvContent = formatDataAsCSV(data);
    console.timeEnd('csv-format');
    console.log(`CSV size: ${csvContent.length} characters`);
    
    // Store in Vercel Blob Storage
    console.time('blob-upload');
    const blob = await put(filename, csvContent, {
      access: 'public', // Public for easier debugging/access
      contentType: 'text/csv'
    });
    console.timeEnd('blob-upload');
    console.log(`Blob URL: ${blob.url}`);

    console.timeEnd('total-execution');
    // Return success response
    return res.status(200).json({
      success: true,
      message: 'Results saved successfully',
      submission_id: filename.replace('.csv', ''),
      timestamp: new Date().toISOString(),
      url: blob.url
    });

  } catch (error) {
    console.error('Error saving results:', error);
    console.timeEnd('total-execution');
    
    return res.status(500).json({
      success: false,
      message: 'Failed to save results to server',
      error: error.message,
      stack: error.stack
    });
  }
}

function formatDataAsCSV(data) {
  let csv = '';
  
  // Add minimal metadata header
  csv += `# Cloze Norming Study Results\n`;
  csv += `# Participant ID: ${data.participant_id}\n`;
  csv += `# Selected List: ${data.selected_list || 'unknown'}\n`;
  csv += `# Total Trials: ${data.results.length}\n`;
  csv += `#\n`;
  
  if (data.results && data.results.length > 0) {
    // Only include the essential fields
    const essentialFields = [
      'participant_id', 'word', 'sentence', 'Code', 
      'OriginalID', 'Item', 'Cloze', 'RegionPlacement', 
      'OriginalList', 'ListNumber', 'selected_list'
    ];
    
    // Filter headers to only include essential fields
    const headers = Object.keys(data.results[0])
      .filter(header => essentialFields.includes(header));
    
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
  
  return csv;
}

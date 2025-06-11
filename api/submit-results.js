import { put } from '@vercel/blob';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const data = req.body;
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `cloze_results_${timestamp}_${data.participant_id}.csv`;
    
    // Convert to CSV format
    const csvContent = formatDataAsCSV(data);
    
    // Store in Vercel Blob
    const blob = await put(filename, csvContent, {
      access: 'public', // or 'private' if you want it private
    });

    res.status(200).json({ 
      success: true, 
      url: blob.url,
      filename: filename 
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to save results' });
  }
}

function formatDataAsCSV(data) {
  // Convert your results to CSV format
  // Similar to the previous CSV generation code
}
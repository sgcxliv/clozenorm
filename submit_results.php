<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $data = json_decode(file_get_contents('php://input'), true);
    
    if ($data) {
        // Create filename with timestamp
        $filename = 'results/cloze_results_' . date('Y-m-d_H-i-s') . '_' . $data['participant_id'] . '.csv';
        
        // Create results directory if it doesn't exist
        if (!file_exists('results')) {
            mkdir('results', 0755, true);
        }
        
        // Convert JSON to CSV
        $file = fopen($filename, 'w');
        
        // Write header
        if (!empty($data['results'])) {
            fputcsv($file, array_keys($data['results'][0]));
            
            // Write data rows
            foreach ($data['results'] as $row) {
                fputcsv($file, $row);
            }
        }
        
        fclose($file);
        
        echo json_encode(['success' => true, 'message' => 'Results saved successfully']);
    } else {
        echo json_encode(['success' => false, 'message' => 'No data received']);
    }
} else {
    echo json_encode(['success' => false, 'message' => 'Only POST requests allowed']);
}
?>
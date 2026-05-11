<?php
require_once 'db_init.php';
checkAuth();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    sendResponse(['error' => 'Only POST allowed'], 405);
}

$data = json_decode(file_get_contents('php://input'), true);
if (!isset($data['id']) || !isset($data['status'])) {
    sendResponse(['error' => 'Missing id or status'], 400);
}

$id     = $data['id'];
$status = intval($data['status']);
$db     = readDB();

foreach ($db['photos'] as $key => $photo) {
    if ($photo['id'] === $id) {
        if ($status === 99) {
            // Delete from disk
            $filePath = $upload_dir . $photo['filename'];
            if (file_exists($filePath)) unlink($filePath);
            array_splice($db['photos'], $key, 1);
            writeDB($db);
            sendResponse(['success' => true, 'message' => 'Foto eliminata']);
        } else {
            $db['photos'][$key]['status'] = $status;
            writeDB($db);
            sendResponse(['success' => true]);
        }
    }
}

sendResponse(['error' => 'Photo not found'], 404);
?>

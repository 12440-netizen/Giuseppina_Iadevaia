<?php
require_once 'db_init.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    sendResponse(['error' => 'Only POST allowed'], 405);
}

if (!isset($_FILES['photo']) || !isset($_POST['lat']) || !isset($_POST['lng'])) {
    sendResponse(['error' => 'Missing data'], 400);
}

$file     = $_FILES['photo'];
$lat      = floatval($_POST['lat']);
$lng      = floatval($_POST['lng']);
$category = trim($_POST['category'] ?? 'Graffito');

$validCategories = ['Graffito', 'Stencil', 'Affissione', 'Sticker'];
if (!in_array($category, $validCategories)) $category = 'Graffito';

// MIME validation
$allowedMime = ['image/jpeg', 'image/png', 'image/webp'];
$finfo       = new finfo(FILEINFO_MIME_TYPE);
$mimeType    = $finfo->file($file['tmp_name']);
if (!in_array($mimeType, $allowedMime)) {
    sendResponse(['error' => 'Tipo file non supportato'], 400);
}

if (!is_dir($upload_dir))    sendResponse(['error' => 'Upload dir not found'], 500);
if (!is_writable($upload_dir)) sendResponse(['error' => 'Upload dir not writable'], 500);
if ($file['error'] !== UPLOAD_ERR_OK) sendResponse(['error' => 'Upload error: ' . $file['error']], 500);

$ext          = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
$new_filename = 'photo-' . time() . '-' . rand(1000, 9999) . '.' . $ext;
$target_path  = $upload_dir . $new_filename;

if (!move_uploaded_file($file['tmp_name'], $target_path)) {
    sendResponse(['error' => 'Impossibile salvare il file'], 500);
}

$photoId  = uniqid('p_', true);
$imageUrl = 'uploads/' . $new_filename;

$newPhoto = [
    'id'           => $photoId,
    'filename'     => $new_filename,
    'originalName' => $file['name'],
    'lat'          => $lat,
    'lng'          => $lng,
    'url'          => $imageUrl,
    'status'       => 0,
    'category'     => $category,
    'created_at'   => date('c')
];

$db = readDB();
$db['photos'][] = $newPhoto;
writeDB($db);

sendResponse(['message' => 'Foto caricata! In attesa di approvazione.', 'id' => $photoId], 201);
?>

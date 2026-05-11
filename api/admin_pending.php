<?php
require_once 'db_init.php';
checkAuth();

$db     = readDB();
$photos = $db['photos'];

if (isset($_GET['status']) && is_numeric($_GET['status'])) {
    $status = intval($_GET['status']);
    $photos = array_values(array_filter($photos, fn($p) => $p['status'] === $status));
} else {
    // Pending first, then by date desc
    usort($photos, function ($a, $b) {
        if ($a['status'] !== $b['status']) return $a['status'] - $b['status'];
        return strcmp($b['created_at'], $a['created_at']);
    });
}

sendResponse(array_values($photos));
?>

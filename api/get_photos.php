<?php
require_once 'db_init.php';

$db     = readDB();
$photos = array_values(array_filter($db['photos'], fn($p) => $p['status'] === 1));

usort($photos, fn($a, $b) => strcmp($b['created_at'], $a['created_at']));

sendResponse($photos);
?>

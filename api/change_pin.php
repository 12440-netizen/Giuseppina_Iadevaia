<?php
require_once 'db_init.php';
checkAuth();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    sendResponse(['error' => 'Only POST allowed'], 405);
}

$data = json_decode(file_get_contents('php://input'), true);
if (!isset($data['current_pin']) || !isset($data['new_pin'])) {
    sendResponse(['error' => 'Missing data'], 400);
}

if (hash('sha256', $data['current_pin']) !== getPinHash()) {
    sendResponse(['error' => 'PIN attuale non corretto'], 401);
}

if (strlen((string)$data['new_pin']) < 4) {
    sendResponse(['error' => 'Il nuovo PIN deve avere almeno 4 caratteri'], 400);
}

$db = readDB();
$db['config']['pin_hash']       = hash('sha256', $data['new_pin']);
$db['config']['pin_created_at'] = date('c');
writeDB($db);

sendResponse(['success' => true, 'message' => 'PIN aggiornato con successo']);
?>

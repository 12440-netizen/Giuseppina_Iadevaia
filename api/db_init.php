<?php
// db_init.php — Shared helpers: JSON DB read/write, auth, responses
session_start();

define('DEFAULT_PIN', '101516');
define('MAX_ATTEMPTS', 5);
define('LOCK_DURATION', 900);    // 15 minuti
define('SESSION_TIMEOUT', 7200); // 2 ore

$db_file    = __DIR__ . '/../db.json';
$upload_dir = __DIR__ . '/../uploads/';

if (!is_dir($upload_dir)) {
    mkdir($upload_dir, 0755, true);
}

function readDB() {
    global $db_file;
    if (!file_exists($db_file)) {
        $initial = [
            'photos'     => [],
            'config'     => ['pin_hash' => null, 'pin_created_at' => null],
            'rate_limit' => ['attempts' => 0, 'locked_until' => null]
        ];
        writeDB($initial);
        return $initial;
    }
    $data = json_decode(file_get_contents($db_file), true);
    return $data ?? ['photos' => [], 'config' => ['pin_hash' => null], 'rate_limit' => ['attempts' => 0, 'locked_until' => null]];
}

function writeDB($data) {
    global $db_file;
    $fp = fopen($db_file, 'c');
    if (flock($fp, LOCK_EX)) {
        ftruncate($fp, 0);
        rewind($fp);
        fwrite($fp, json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
        flock($fp, LOCK_UN);
    }
    fclose($fp);
}

function getPinHash() {
    $db = readDB();
    if (empty($db['config']['pin_hash'])) {
        $hash = hash('sha256', DEFAULT_PIN);
        $db['config']['pin_hash']      = $hash;
        $db['config']['pin_created_at'] = date('c');
        writeDB($db);
        return $hash;
    }
    return $db['config']['pin_hash'];
}

function sendResponse($data, $code = 200) {
    header('Content-Type: application/json');
    header('Cache-Control: no-store, no-cache, must-revalidate');
    http_response_code($code);
    echo json_encode($data);
    exit;
}

function checkAuth() {
    if (!isset($_SESSION['admin_logged_in']) || $_SESSION['admin_logged_in'] !== true) {
        sendResponse(['error' => 'Unauthorized access'], 401);
    }
    if (isset($_SESSION['last_activity']) && (time() - $_SESSION['last_activity'] > SESSION_TIMEOUT)) {
        session_unset();
        session_destroy();
        sendResponse(['error' => 'Session expired'], 401);
    }
    $_SESSION['last_activity'] = time();
}
?>

<?php
require_once 'db_init.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    sendResponse(['error' => 'Only POST allowed'], 405);
}

$data = json_decode(file_get_contents('php://input'), true);
if (!isset($data['pin'])) {
    sendResponse(['error' => 'Missing PIN'], 400);
}

$db        = readDB();
$rateLimit = $db['rate_limit'] ?? ['attempts' => 0, 'locked_until' => null];

// Check lock
if (!empty($rateLimit['locked_until'])) {
    $lockedUntil = strtotime($rateLimit['locked_until']);
    if (time() < $lockedUntil) {
        $remaining = $lockedUntil - time();
        sendResponse(['error' => "Troppi tentativi. Riprova tra {$remaining} secondi."], 429);
    } else {
        $rateLimit = ['attempts' => 0, 'locked_until' => null];
    }
}

$inputHash  = hash('sha256', $data['pin']);
$storedHash = getPinHash();

if ($inputHash === $storedHash) {
    $db['rate_limit'] = ['attempts' => 0, 'locked_until' => null];
    writeDB($db);

    session_regenerate_id(true);
    $_SESSION['admin_logged_in'] = true;
    $_SESSION['last_activity']   = time();
    $_SESSION['session_token']   = bin2hex(random_bytes(32));

    sendResponse(['success' => true]);
} else {
    $rateLimit['attempts']++;
    if ($rateLimit['attempts'] >= MAX_ATTEMPTS) {
        $rateLimit['locked_until'] = date('c', time() + LOCK_DURATION);
        $db['rate_limit'] = $rateLimit;
        writeDB($db);
        sendResponse(['error' => 'Account bloccato per 15 minuti dopo troppi tentativi falliti.'], 429);
    } else {
        $remaining = MAX_ATTEMPTS - $rateLimit['attempts'];
        $db['rate_limit'] = $rateLimit;
        writeDB($db);
        sendResponse(['error' => "PIN errato. {$remaining} tentativi rimasti."], 401);
    }
}
?>

<?php
// Copy this file to config/db.php and fill in YOUR values. config/db.php is git-ignored so passwords never reach GitHub.
$DB_HOST = 'localhost'; $DB_NAME = 'aquatrack_erp'; $DB_USER = 'root'; $DB_PASS = '';
const ERP_API_KEY = 'change-this-shared-key'; // other teams send this in the X-API-KEY header
try {
    $pdo = new PDO("mysql:host=$DB_HOST;dbname=$DB_NAME;charset=utf8mb4", $DB_USER, $DB_PASS,
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]);
} catch (PDOException $e) { die('Database connection failed: ' . htmlspecialchars($e->getMessage())); }

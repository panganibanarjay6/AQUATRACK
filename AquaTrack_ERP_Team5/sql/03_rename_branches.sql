-- Run this in phpMyAdmin (database aquatrack_erp > SQL tab) if you ALREADY imported the old seed.
-- It renames the existing 25 branches and keeps every employee's branch link.
USE aquatrack_erp;
UPDATE branches SET branch_name = 'Alaminos (San Pablo)' WHERE branch_id = 1;
UPDATE branches SET branch_name = 'Bagong Pook' WHERE branch_id = 2;
UPDATE branches SET branch_name = 'Barangay I-A' WHERE branch_id = 3;
UPDATE branches SET branch_name = 'Barangay I-B' WHERE branch_id = 4;
UPDATE branches SET branch_name = 'Barangay II-A' WHERE branch_id = 5;
UPDATE branches SET branch_name = 'Barangay II-B' WHERE branch_id = 6;
UPDATE branches SET branch_name = 'Barangay III-A' WHERE branch_id = 7;
UPDATE branches SET branch_name = 'Barangay III-B' WHERE branch_id = 8;
UPDATE branches SET branch_name = 'Barangay IV-A' WHERE branch_id = 9;
UPDATE branches SET branch_name = 'Barangay IV-B' WHERE branch_id = 10;
UPDATE branches SET branch_name = 'Barangay V-A' WHERE branch_id = 11;
UPDATE branches SET branch_name = 'Barangay V-B' WHERE branch_id = 12;
UPDATE branches SET branch_name = 'Barangay VI-A' WHERE branch_id = 13;
UPDATE branches SET branch_name = 'Barangay VI-B' WHERE branch_id = 14;
UPDATE branches SET branch_name = 'Barangay VII-A' WHERE branch_id = 15;
UPDATE branches SET branch_name = 'Barangay VII-B' WHERE branch_id = 16;
UPDATE branches SET branch_name = 'Bautista' WHERE branch_id = 17;
UPDATE branches SET branch_name = 'Concepcion' WHERE branch_id = 18;
UPDATE branches SET branch_name = 'Del Remedio' WHERE branch_id = 19;
UPDATE branches SET branch_name = 'Dolores' WHERE branch_id = 20;
UPDATE branches SET branch_name = 'San Antonio' WHERE branch_id = 21;
UPDATE branches SET branch_name = 'San Buenaventura' WHERE branch_id = 22;
UPDATE branches SET branch_name = 'San Crispin' WHERE branch_id = 23;
UPDATE branches SET branch_name = 'San Francisco' WHERE branch_id = 24;
UPDATE branches SET branch_name = 'San Gabriel' WHERE branch_id = 25;

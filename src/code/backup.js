const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '../data');
const backupDir = path.join(__dirname, '../backups');

function createBackup() {
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir);
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(backupDir, `backup-${timestamp}`);
  fs.mkdirSync(backupPath);

  const files = fs.readdirSync(dataDir);
  for (const file of files) {
    const src = path.join(dataDir, file);
    const dest = path.join(backupPath, file);
    fs.copyFileSync(src, dest);
  }

  console.log(`Backup created: ${backupPath}`);
}

function listBackups() {
  if (!fs.existsSync(backupDir)) {
    return [];
  }
  return fs.readdirSync(backupDir);
}

function restoreBackup(backupName) {
  const backupPath = path.join(backupDir, backupName);
  if (!fs.existsSync(backupPath)) {
    throw new Error(`Backup "${backupName}" not found.`);
  }

  const files = fs.readdirSync(backupPath);
  for (const file of files) {
    const src = path.join(backupPath, file);
    const dest = path.join(dataDir, file);
    fs.copyFileSync(src, dest);
  }

  console.log(`Backup "${backupName}" restored to data/`);
}

module.exports = { createBackup, listBackups, restoreBackup };

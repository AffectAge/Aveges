const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '../data');
const backupDir = path.join(__dirname, '../backups');

function copyRecursiveSync(src, dest) {
  const stats = fs.statSync(src);

  if (stats.isDirectory()) {
    if (!fs.existsSync(dest)) fs.mkdirSync(dest);
    const files = fs.readdirSync(src);
    for (const file of files) {
      copyRecursiveSync(path.join(src, file), path.join(dest, file));
    }
  } else {
    fs.copyFileSync(src, dest);
  }
}

function createBackup(name = null) {
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const finalName = name || `backup-${new Date().toISOString().replace(/[:.]/g, '-')}`;
  const backupPath = path.join(backupDir, finalName);
  fs.mkdirSync(backupPath);

  const files = fs.readdirSync(dataDir);
  for (const file of files) {
    const src = path.join(dataDir, file);
    const dest = path.join(backupPath, file);
    copyRecursiveSync(src, dest);
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
    copyRecursiveSync(src, dest);
  }

  console.log(`Backup "${backupName}" restored to data/`);
}


module.exports = { createBackup, listBackups, restoreBackup };

// ============================================================================
// DSS-I-O.js — Data Saving System I/O Engine
// Handles encrypted blob storage, metadata management, and reusable API calls
// ============================================================================

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const __dirname = path.resolve();
const DATA_ROOT = path.join(__dirname, 'Bcode', 'data');
const ALGORITHM = 'aes-256-gcm';
const KEY = crypto.createHash('sha256').update('super_secret_key').digest();
const IV_LENGTH = 16;

// --------------------------- Utility Functions -----------------------------
function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function encrypt(data) {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(data)), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString('base64');
}

function decrypt(data) {
  try {
    const raw = Buffer.from(data, 'base64');
    const iv = raw.subarray(0, IV_LENGTH);
    const tag = raw.subarray(IV_LENGTH, IV_LENGTH + 16);
    const text = raw.subarray(IV_LENGTH + 16);
    const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(text), decipher.final()]);
    return JSON.parse(decrypted.toString());
  } catch {
    return null;
  }
}

function defaultMetadata() {
  return {
    blobs: {},
    deleted: []
  };
}

// --------------------------- DSS-I-O Class ---------------------------------
class DSSIO {
  // Initialize folder + metadata
  static init(folder) {
    const folderPath = path.join(DATA_ROOT, folder);
    ensureDir(folderPath);
    const metadataPath = path.join(folderPath, 'metadata.json');
    if (!fs.existsSync(metadataPath)) {
      fs.writeFileSync(metadataPath, JSON.stringify(defaultMetadata(), null, 2));
    }
    return metadataPath;
  }

  // Read metadata
  static readMetadata(folder) {
    const metadataPath = this.init(folder);
    try {
      return JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));
    } catch {
      return defaultMetadata();
    }
  }

  // Write metadata
  static writeMetadata(folder, metadata) {
    const metadataPath = this.init(folder);
    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
  }

  // Save blob
  static saveBlob(folder, blobId, data) {
    const folderPath = path.join(DATA_ROOT, folder);
    ensureDir(folderPath);

    const blobPath = path.join(folderPath, `${blobId}.json`);
    const encrypted = encrypt(data);
    fs.writeFileSync(blobPath, encrypted, 'utf-8');

    const metadata = this.readMetadata(folder);
    metadata.blobs[blobId] = { path: blobPath, deleted: false };
    this.writeMetadata(folder, metadata);
  }

  // Load blob
  static loadBlob(folder, blobId) {
    const metadata = this.readMetadata(folder);
    const entry = metadata.blobs[blobId];

    if (!entry || entry.deleted) return null;
    if (!fs.existsSync(entry.path)) {
      metadata.blobs[blobId].deleted = true;
      this.writeMetadata(folder, metadata);
      return null;
    }

    const raw = fs.readFileSync(entry.path, 'utf-8');
    return decrypt(raw);
  }

  // Delete blob
  static deleteBlob(folder, blobId) {
    const metadata = this.readMetadata(folder);
    const entry = metadata.blobs[blobId];
    if (!entry) return;

    if (fs.existsSync(entry.path)) fs.unlinkSync(entry.path);
    metadata.blobs[blobId].deleted = true;
    metadata.deleted.push(blobId);
    this.writeMetadata(folder, metadata);
  }
}

// --------------------------- Public API ------------------------------------
const DSSIO_API = {
  save: (folder, blobId, data) => DSSIO.saveBlob(folder, blobId, data),
  load: (folder, blobId) => DSSIO.loadBlob(folder, blobId),
  delete: (folder, blobId) => DSSIO.deleteBlob(folder, blobId),
  metadata: (folder) => DSSIO.readMetadata(folder)
};

// --------------------------- Auto-Initialize --------------------------------
ensureDir(DATA_ROOT);
console.log('[DSS-I-O] 💾 I/O Engine ready ✅');

// Export
module.exports = {
  DSSIO,
  API: DSSIO_API
};

// ============================================================================
// Usage Example:
// DSSIO.API.save('embeds', '0x00001', { title: 'Hello' });
// const data = DSSIO.API.load('embeds', '0x00001');
// DSSIO.API.delete('embeds', '0x00001');
// ============================================================================

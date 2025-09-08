// ============================================================================
// DataSavingSystem.js — DSS Core API (CJS)
// ============================================================================
const fs = require('fs').promises;
const path = require('path');

const STORAGE_ROOT = path.join(process.cwd(), 'Bcode', 'data');
const METADATA_PATH = path.join(STORAGE_ROOT, 'metadata.json');

let _initialized = false;

// ---------------- Utility Helpers ----------------
async function fileExists(p) {
    try { await fs.access(p); return true; } 
    catch { return false; }
}
function incrementBlobID(id) { 
    const num = parseInt(id, 16) + 1;
    return '0x' + num.toString(16).padStart(6, '0');
}

// ---------------- Metadata ----------------
async function loadMetadata() {
    await ensureStorage();
    const raw = await fs.readFile(METADATA_PATH, 'utf8');
    return JSON.parse(raw);
}
async function saveMetadata(meta) {
    await fs.writeFile(METADATA_PATH, JSON.stringify(meta, null, 2), 'utf8');
}

// ---------------- Core Storage ----------------
async function ensureStorage() {
    await fs.mkdir(STORAGE_ROOT, { recursive: true });
    if (!(await fileExists(METADATA_PATH))) {
        await saveMetadata({ newest: '0x000000', blobs: {}, available: [] });
    }
    _initialized = true;
    console.log('[DSS] 💾 Data Storage System online ✅');
}

// ---------------- Blob Helpers ----------------
async function allocateBlobID() {
    const meta = await loadMetadata();
    if (meta.available?.length) {
        const reuseID = meta.available.shift();
        await saveMetadata(meta);
        return reuseID;
    }
    const nextID = incrementBlobID(meta.newest);
    meta.newest = nextID;
    await saveMetadata(meta);
    return nextID;
}
async function releaseBlobID(blobID) {
    const meta = await loadMetadata();
    if (!meta.available.includes(blobID)) meta.available.push(blobID);
    if (meta.blobs[blobID]) {
        meta.blobs[blobID].deleted = true;
        meta.blobs[blobID].deletedAt = Date.now();
    }
    await saveMetadata(meta);
}
// ---------------- Blob Management ----------------
async function createBlob(packet) {
    const blobID = packet.dataID || await allocateBlobID();
    const blobPath = path.join(STORAGE_ROOT, `${blobID}.json`);
    const blobData = {
        blobID,
        folder: packet.folder || 'default',
        serverID: packet.serverID || null,
        userID: packet.userID || null,
        time: packet.time || Date.now(),
        data: packet.data || {},
        from: packet.from || 'unknown',
        type: packet.type || 'write',
        markerdata: packet.markerdata || {}
    };
    await fs.writeFile(blobPath, JSON.stringify(blobData, null, 2), 'utf8');

    const meta = await loadMetadata();
    meta.blobs[blobID] = { path: blobPath, deleted: false };
    await saveMetadata(meta);

    return blobData;
}
async function readBlob(blobID) {
    const blobPath = path.join(STORAGE_ROOT, `${blobID}.json`);
    if (!(await fileExists(blobPath))) throw new Error(`Blob ${blobID} not found`);
    const raw = await fs.readFile(blobPath, 'utf8');
    return JSON.parse(raw);
}
async function deleteBlob(blobID, permanent = false) {
    const blobPath = path.join(STORAGE_ROOT, `${blobID}.json`);
    if (!(await fileExists(blobPath))) return false;

    if (permanent) {
        await fs.unlink(blobPath);
        const meta = await loadMetadata();
        delete meta.blobs[blobID];
        meta.available.push(blobID);
        await saveMetadata(meta);
    } else {
        await releaseBlobID(blobID);
    }
    return true;
}
// ---------------- DSS API ----------------
const DataSavingSystem = {ensureStorage,loadMetadata,saveMetadata,createBlob,readBlob,deleteBlob,allocateBlobID,releaseBlobID,get status() { return _initialized ? 'Loaded ✅' : 'Not Loaded ❌'; },get initialized() { return _initialized; },initialize: async function() {if (!_initialized) await ensureStorage();return _initialized;
},ready: async function() {if (!_initialized) await this.initialize();return true;
}
};
module.exports = { DataSavingSystem };
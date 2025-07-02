const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const EmbedFormatter = require('./utils/format');
const writeEmbedData = require('./FRMTTwrite');
const readEmbedData = require('./FRMTTread');
const DCB = require('./DCB');
class DataSavingSystem {
  constructor(client) {
    this.client = client;
    this.stagingPath = path.join(__dirname, '../Embed-stage1/stage1');
    this.dataPath = path.join(__dirname, '../Embedded-Data');
    this.encryptionKey = process.env.ENCRYPTION_KEY || 'your-secret-key';
    this.initialized = false;
  }

    async initialize() {
        try {
          console.log('[DataSavingSystem] Initialization started...');
          await fs.mkdir(this.stagingPath, { recursive: true });
          await fs.mkdir(this.dataPath, { recursive: true });

          // Simulate waiting for other systems or checks if needed
          await this.waitForDependencies();

          this.initialized = true;
          console.log('[DataSavingSystem] Initialization complete. Data system fully working.');
        } catch (error) {
          if (error.code === 'EEXIST') {
            console.error('[DataSavingSystem] Error: Staging or data path already exists.');
          } else if (error.code === 'EACCES') {
            console.error('[DataSavingSystem] Error: Permission denied to create staging or data path.');
          } else {
            console.error('[DataSavingSystem] Error: Unknown error during initialization:', error);
          }
          throw error;
        }
    }

    async waitForDependencies() {
        // Placeholder for waiting on other async processes or checks
        // For example, you can wait for other modules or services to be ready
        // Here we simulate a short delay to represent waiting
        return new Promise(resolve => setTimeout(resolve, 500));
    }

    async stageImage(attachment, userId) {
        try {
          console.log(`[DataSavingSystem] Staging image for user ${userId}...`);
          const ticketId = this.generateTicketId();
          const stagingFilePath = path.join(this.stagingPath, `${ticketId}-${userId}.tmp`);
          const metadataFilePath = path.join(this.stagingPath, `${ticketId}-${userId}.json`);

          await fs.mkdir(this.stagingPath, { recursive: true });
          await fs.writeFile(stagingFilePath, Buffer.from(await attachment.arrayBuffer()));

          const metadata = {
            ticket: ticketId,
            userId: userId,
            createdAt: new Date().toISOString(),
            expiresInSec: 45
          };

          await writeEmbedData(metadata);

          console.log(`[DataSavingSystem] Image staged with ticket ${ticketId} for user ${userId}.`);
          return ticketId;
        } catch (error) {
          if (error.code === 'EEXIST') {
            console.error(`[DataSavingSystem] Error: Staging file for ticket ${ticketId} already exists.`);
          } else if (error.code === 'EACCES') {
            console.error(`[DataSavingSystem] Error: Permission denied to write staging file for ticket ${ticketId}.`);
          } else {
            console.error(`[DataSavingSystem] Error: Unknown error during staging image for ticket ${ticketId}:`, error);
          }
          throw error;
        }
    }


    async confirmUpload(ticketId, userId, serverId, embedName, isGlobal) {
        try {
        console.log(`[DataSavingSystem] Confirming upload for ticket ${ticketId}, user ${userId}...`);
        const stagingFilePath = path.join(this.stagingPath, `${ticketId}-${userId}.tmp`);
        const metadataFilePath = path.join(this.stagingPath, `${ticketId}-${userId}.json`);

        const imageData = await fs.readFile(stagingFilePath);
        const encryptedData = this.encryptData(imageData);

        const savePath = isGlobal 
          ? path.join(this.dataPath, 'Global', userId)
          : path.join(this.dataPath, serverId, userId, 'Local');

        await fs.mkdir(savePath, { recursive: true });

        const fileName = `author-${userId}-${embedName}.enc`;
        await fs.writeFile(path.join(savePath, fileName), encryptedData);

        // Clean up staging files
        await fs.unlink(stagingFilePath);
        await fs.unlink(metadataFilePath);

        console.log(`[DataSavingSystem] Upload confirmed and saved for ticket ${ticketId}, user ${userId}.`);
    }     catch (error) {
        if (error.code === 'ENOENT') {
          console.error(`[DataSavingSystem] Error: Staging file for ticket ${ticketId} not found.`);
        } else if (error.code === 'EACCES') {
          console.error(`[DataSavingSystem] Error: Permission denied to write to save path for ticket ${ticketId}.`);
        } else {
          console.error(`[DataSavingSystem] Error: Unknown error during confirming upload for ticket ${ticketId}:`, error);
        }
        throw error;
    }
}

    async cancelUpload(ticketId, userId) {
  try {
    console.log(`[DataSavingSystem] Cancelling upload for ticket ${ticketId}, user ${userId}...`);
    const stagingFilePath = path.join(this.stagingPath, `${ticketId}-${userId}.tmp`);
    const metadataFilePath = path.join(this.stagingPath, `${ticketId}-${userId}.json`);

    await fs.unlink(stagingFilePath);
    await fs.unlink(metadataFilePath);

    console.log(`[DataSavingSystem] Upload cancelled for ticket ${ticketId}, user ${userId}.`);
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.error(`[DataSavingSystem] Error: Staging file for ticket ${ticketId} not found.`);
    } else if (error.code === 'EACCES') {
      console.error(`[DataSavingSystem] Error: Permission denied to delete staging file for ticket ${ticketId}.`);
    } else {
      console.error(`[DataSavingSystem] Error: Unknown error during cancelling upload for ticket ${ticketId}:`, error);
    }
    throw error;
  }
}

    async cleanupExpiredFiles() {
  try {
    console.log('[DataSavingSystem] Cleaning up expired staging files...');
    const files = await fs.readdir(this.stagingPath);
    const now = new Date();

    for (const file of files) {
      if (file.endsWith('.json')) {
        const metadataPath = path.join(this.stagingPath, file);
        const metadata = JSON.parse(await fs.readFile(metadataPath, 'utf-8'));

        const expirationTime = new Date(metadata.createdAt);
        expirationTime.setSeconds(expirationTime.getSeconds() + metadata.expiresInSec);

        if (now > expirationTime) {
          const tmpFile = file.replace('.json', '.tmp');
          await fs.unlink(path.join(this.stagingPath, tmpFile));
          await fs.unlink(metadataPath);
          console.log(`[DataSavingSystem] Removed expired files for ticket ${metadata.ticket}.`);
        }
      }
    }
    console.log('[DataSavingSystem] Cleanup complete.');
  } catch (error) {
    console.error('[DataSavingSystem] Error during cleanup:', error);
    throw error;
  }
}

    generateTicketId() {
        return String(Math.floor(Math.random() * 1000000)).padStart(6, '0');
    }

    encryptData(data) {
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(this.encryptionKey), iv);
        let encrypted = cipher.update(data);
        encrypted = Buffer.concat([encrypted, cipher.final()]);
        return Buffer.concat([iv, encrypted]);
    }
}

class DataSavingSystem {
    constructor(dataPath, encryptionKey) {
        this.dataPath = dataPath;
        this.encryptionKey = encryptionKey;
        this.stagingPath = path.join(dataPath, 'Staging');
    }
}

module.exports = DataSavingSystem;
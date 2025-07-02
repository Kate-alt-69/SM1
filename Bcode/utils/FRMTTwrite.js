const fs = require('fs').promises;
const path = require('path');
const dataSAVINGsystem = require('./dataSAVINGsystem');

const writeEmbedData = async (metadata) => {
  try {
    const metadataPath = path.join(__dirname, '../Embed-stage1/stage1', `${metadata.ticket}-${metadata.userId}.json`);
    await fs.mkdir(path.dirname(metadataPath), { recursive: true });
    await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));
    console.log(`[FRMTTwrite] Wrote metadata to ${metadataPath}`);
  } catch (error) {
    console.error(`[FRMTTwrite] Error writing metadata:`, error);
    throw error;
  }
};

const writeImageData = async (imageData, ticketId, userId) => {
  try {
    const imagePath = path.join(__dirname, '../Embed-stage1/stage1', `${ticketId}-${userId}.tmp`);
    await fs.mkdir(path.dirname(imagePath), { recursive: true });
    await fs.writeFile(imagePath, imageData);
    console.log(`[FRMTTwrite] Wrote image data to ${imagePath}`);
  } catch (error) {
    console.error(`[FRMTTwrite] Error writing image data:`, error);
    throw error;
  }
};

const saveImageToDiscord = async (ticketId, userId) => {
  try {
    const imageUrl = await dataSAVINGsystem.getImageUrl(ticketId, userId);
    if (!imageUrl) {
      console.log(`[FRMTTwrite] No image URL found for ticket ${ticketId} and user ${userId}`);
      return;
    }
    const confirmation = await dataSAVINGsystem.confirmImageUsage(ticketId, userId, imageUrl);
    if (!confirmation) {
      console.log(`[FRMTTwrite] Image usage not confirmed for ticket ${ticketId} and user ${userId}`);
      return;
    }
    const imageName = `image-${userId}-${ticketId}.png`;
    const imagePath = path.join(__dirname, '../Embedded-Data', imageName);
    await fs.writeFile(imagePath, imageUrl);
    console.log(`[FRMTTwrite] Saved image to ${imagePath}`);
  } catch (error) {
    console.error(`[FRMTTwrite] Error saving image to Discord:`, error);
    throw error;
  }
};

const writeEncryptedData = async (encryptedData, ticketId, userId, embedName, isGlobal) => {
  try {
    const savePath = isGlobal
      ? path.join(__dirname, '../Embedded-Data', 'Global', userId)
      : path.join(__dirname, '../Embedded-Data', ticketId, userId, 'Local');
    await fs.mkdir(savePath, { recursive: true });
    const fileName = `author-${userId}-${embedName}.enc`;
    await fs.writeFile(path.join(savePath, fileName), encryptedData);
    console.log(`[FRMTTwrite] Wrote encrypted data to ${savePath}/${fileName}`);
  } catch (error) {
    console.error(`[FRMTTwrite] Error writing encrypted data:`, error);
    throw error;
  }
};

module.exports = {
  writeEmbedData,
  writeImageData,
  saveImageToDiscord,
  writeEncryptedData
};
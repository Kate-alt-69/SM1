// Utility_Module/auth0.js
import fs from "fs";
import crypto from "crypto";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import bcrypt from "bcrypt";
import os from "os";
import Prompt from "./Prompt.js";

const USERS_FILE = "./config/users.json";
const KEY_FILE = "./config/key.bin";
const LOCK_DURATION = 1000 * 60 * 60 * 3; // 3 hours

// ===================== HELPERS ===================== //

function clearTerminal() {
  if (process.stdout.isTTY) {
    process.stdout.write('\x1Bc'); // Full reset
    console.log('[KERNEL] Try # help for information');
  }
}

function getKey() {
  if (!fs.existsSync(KEY_FILE)) {
    const key = crypto.randomBytes(32);
    fs.writeFileSync(KEY_FILE, key);
    console.log("[AUTH] 🔑 New encryption key generated (key.bin)");
    return key;
  }
  return fs.readFileSync(KEY_FILE);
}

function encryptData(data, key) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(data, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("base64");
}

function decryptData(data, key) {
  try {
    const buffer = Buffer.from(data, "base64");
    const iv = buffer.subarray(0, 16);
    const tag = buffer.subarray(16, 32);
    const encrypted = buffer.subarray(32);
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
  } catch (err) {
    throw new Error("❌ Decryption failed: corrupted or incompatible user data.");
  }
}

async function loadUsers(key) {
  if (!fs.existsSync(USERS_FILE)) return [];
  let raw;
  try {
    raw = JSON.parse(fs.readFileSync(USERS_FILE, "utf8"));
  } catch {
    console.error("[AUTH] ⚠️ users.json is empty or malformed. Resetting...");
    return [];
  }

  try {
    return raw.map((entry) => {
      const decryptedBase64 = decryptData(entry.data, key);
      const parsed = JSON.parse(Buffer.from(decryptedBase64, "base64").toString("utf8"));
      return {
        username: parsed.username,
        hash: parsed.hash,
        discordId: parsed.discordId || "",
        lockedUntil: parsed.lockedUntil || null,
        createdAt: parsed.createdAt || new Date().toISOString(),
        deviceName: parsed.deviceName || os.hostname(),
        deviceId: parsed.deviceId || crypto.randomUUID()
      };
    });
  } catch (err) {
    console.error("[AUTH] ⚠️ Failed to decrypt users.json. File may be corrupted.");
    return [];
  }
}

async function saveUsers(users, key) {
  const data = users.map((u) => {
    const payload = JSON.stringify({
      username: u.username,
      hash: u.hash,
      discordId: u.discordId,
      lockedUntil: u.lockedUntil,
      createdAt: u.createdAt,
      deviceName: u.deviceName,
      deviceId: u.deviceId
    });
    const base64Payload = Buffer.from(payload, "utf8").toString("base64");
    return { data: encryptData(base64Payload, key) };
  });
  fs.writeFileSync(USERS_FILE, JSON.stringify(data, null, 2));
}

// ===================== AUTH MANAGER ===================== //
export class AuthManager {
  constructor() {
    this.key = getKey();
    this.users = [];
  }

  // --- INIT LOGIN ---
  async initAuth() {
    this.users = await loadUsers(this.key);

    // FIRST STARTUP
    if (this.users.length === 0) {
      console.log("🚀 No administrator found. Let's create one.");
      await clearTerminal()
      await this.createAdmin();
    }

    // LOGIN FLOW
    const admin = this.users[0];
    if (admin.lockedUntil && Date.now() < admin.lockedUntil) {
      const remainingMin = Math.ceil((admin.lockedUntil - Date.now()) / 60000);
      console.log(`🚫 System is locked for another ${remainingMin} minute(s).`);
      process.exit(1);
    }

    console.log("🔒 Administrator Login (or type 'forgot-servermanager').");
    let attempts = 0;
    await clearTerminal()

    while (true) {
      const input = await Prompt.new({ promptID: "admin-login", title: "Administrator Login", description: "Enter administrator password (or type 'forgot-servermanager'):" });

      if (input === "forgot-servermanager") {
        if (admin.discordId) console.log(`📩 Recovery triggered! Message would be sent to Discord ID: ${admin.discordId}`);
        else console.log("⚠️ No backup Discord ID configured. Manual reset required.");
        process.exit(0);
      }

      if (await bcrypt.compare(input, admin.hash)) {
        console.log("✅ Login successful!");
        return { username: admin.username, discordId: admin.discordId };
      }

      attempts++;
      console.log("❌ Invalid password.");
      if (attempts >= 3) {
        admin.lockedUntil = Date.now() + LOCK_DURATION;
        await saveUsers(this.users, this.key);
        console.log("🚨 Too many failed attempts. System locked for 3 hours.");
        process.exit(1);
      }
    }
  }

  // --- CREATE ADMIN ---
  async createAdmin() {
    const username = await Prompt.new({ promptID: "admin-username", title: "Admin Setup", description: "Enter a new admin username:" });

    let password, confirm;
    while (true) {
      await clearTerminal()
      password = await Prompt.new({ promptID: "admin-password", title: "Admin Setup", description: "Enter a new admin password:" });
      confirm = await Prompt.new({ promptID: "admin-password-confirm", title: "Admin Setup", description: "Confirm your password:" });
      if (password === confirm) break;
      console.log("❌ Passwords do not match. Try again.");
    }
    await clearTerminal()
    const discordId = await Prompt.new({ promptID: "admin-discord", title: "Admin Setup", description: "Optional Discord ID (for recovery):", defaultValue: "" });

    const hash = await bcrypt.hash(password, 12);
    this.users.push({
      username,
      hash,
      discordId: discordId.trim() || "",
      lockedUntil: null,
      createdAt: new Date().toISOString(),
      deviceName: os.hostname(),
      deviceId: crypto.randomUUID()
    });

    await saveUsers(this.users, this.key);
    console.log(`✅ Administrator account created! ${discordId ? "Backup recovery enabled." : "No backup recovery set."}`);
  }

  // --- PASSWORD RESET ---
  async passwordReset() {
    const admin = this.users[0];
    if (!admin) return console.log("❌ No admin found.");

    const input = await Prompt.new({ promptID: "password-old", title: "Password Reset", description: "Enter old password (or type 'forgot-servermanager')" });

    if (input === "forgot-servermanager") {
      if (admin.discordId) console.log(`📩 Recovery triggered! Message sent to Discord ID: ${admin.discordId}`);
      else console.log("⚠️ No backup Discord ID configured. Manual reset required.");
      return;
    }

    if (!await bcrypt.compare(input, admin.hash)) return console.log("❌ Wrong password.");

    let newPass, confirm;
    while (true) {
      newPass = await Prompt.new({ promptID: "new-pass", title: "Password Reset", description: "Enter new password:" });
      confirm = await Prompt.new({ promptID: "confirm-pass", title: "Password Reset", description: "Confirm new password:" });
      if (newPass === confirm) break;
      console.log("❌ Passwords do not match.");
    }

    admin.hash = await bcrypt.hash(newPass, 12);
    await saveUsers(this.users, this.key);
    console.log("✅ Password successfully reset!");
  }

  // --- LOCK TERMINAL ---
  async lockTerminal() {
    console.log("🔒 Terminal locked. Press Ctrl+C to exit, or enter admin password to unlock.");
    while (true) {
      const pass = await Prompt.new({ promptID: "unlock-pass", title: "Unlock Terminal", description: "Enter admin password:" });
      const admin = this.users[0];
      if (await bcrypt.compare(pass, admin.hash)) {
        console.log("✅ Terminal unlocked!");
        break;
      } else {
        console.clear();
        console.log("❌ Wrong password. Terminal still locked.");
      }
    }
  }

  // --- ACCOUNT RESET ---
  async accountReset() {
    const admin = this.users[0];
    if (!admin) return console.log("❌ No admin found.");

    const oldPass = await Prompt.new({ promptID: "old-pass", title: "Account Reset", description: "Enter old password:" });
    if (!await bcrypt.compare(oldPass, admin.hash)) return console.log("❌ Wrong password.");

    console.log("⚠️ All account data will be erased. Restarting for new admin creation...");
    if (fs.existsSync(USERS_FILE)) fs.unlinkSync(USERS_FILE);
    process.exit(0);
  }

  // --- ACCOUNT DETAIL ---
  accountDetail() {
    const admin = this.users[0];
    if (!admin) return console.log("❌ No admin found.");

    console.log("=== Account Details ===");
    console.log(`Username: ${admin.username}`);
    console.log(`Discord ID: ${admin.discordId || "(none)"}`);
    console.log(`Locked Until: ${admin.lockedUntil ? new Date(admin.lockedUntil) : "(not locked)"}`);
    console.log(`Created At: ${admin.createdAt}`);
    console.log(`Device Name: ${admin.deviceName}`);
    console.log(`Device ID: ${admin.deviceId}`);
  }

  // --- SAVE BINARY ---
  saveUsersBinary(pathBinary) {
    const dataBuffer = Buffer.from(JSON.stringify(this.users), "utf8");
    const encrypted = encryptData(dataBuffer.toString("base64"), this.key);
    fs.writeFileSync(pathBinary, encrypted);
    console.log(`[AUTH] 🔐 Binary account saved → ${pathBinary}`);
  }
}
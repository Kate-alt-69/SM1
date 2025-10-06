// Utility_Module/auth0.js
import fs from "fs";
import crypto from "crypto";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import bcrypt from "bcrypt";
import os from "os";
import Prompt from "./Prompt.js";
import { terminalManager } from './TSM.js';
import { 
    toggleInput, 
    setLockState, 
    isLocked, 
    storeOutput, 
    storeInput, 
    getStoredContent, 
    clearBuffer,
    setRawMode 
} from './KNinput.manager.js';

const USERS_FILE = "./config/users.json";
const KEY_FILE = "./config/key.bin";
const LOCK_DURATION = 1000 * 60 * 60 * 3; // 3 hours
const UNLOCK_DURATION = 1000 * 60 * 2.5; // 2 minutes 30 seconds

// ===================== HELPERS ===================== //

function clearTerminal() {
  if (process.stdout.isTTY) {
    process.stdout.write('\x1Bc');
    console.log('\n===========================================');
    console.log('[KERNEL] Authentication System');
    console.log('===========================================\n');
  }
}

function getKey() {
  if (!fs.existsSync(KEY_FILE)) {
    const key = crypto.randomBytes(32);
    fs.writeFileSync(KEY_FILE, key);
    console.log("[AUTH] 🔑 New encryption key generated.");
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
    this.isLocked = false;
    this.lastActivity = Date.now();
    this.idleTimeout = 1000 * 60 * 3; // 3 minutes
    this.terminalManager = terminalManager;
  }

  updateActivity() {
    this.lastActivity = Date.now();
  }

  isIdle() {
    return Date.now() - this.lastActivity > this.idleTimeout;
  }

  async lockScreen() {
    if (this.isLocked) return;
    this.isLocked = true;

    // Hook stdout to capture output
    const oldWrite = process.stdout.write;
    process.stdout.write = (...args) => {
      storeOutput(args[0]);
      return oldWrite.apply(process.stdout, args);
    };

    // Update input manager state
    setLockState(true);
    if (global.toggleInput) {
      global.toggleInput(false);
    }

    // Clear screen and show lock message
    process.stdout.write('\x1Bc');
    console.log('\n🔒 TERMINAL LOCKED');
    console.log('Press any key to unlock...\n');

    try {
      const admin = this.users[0];
      if (!admin) return;

      // Create raw input handler for keypress
      const rawHandler = (chunk) => {
        process.stdin.removeListener('data', rawHandler);
        process.stdin.setRawMode(false);
        process.stdin.pause();
        return true;
      };

      // Wait for any keypress
      await new Promise(resolve => {
        process.stdin.setRawMode(true);
        process.stdin.resume();
        process.stdin.once('data', () => {
          process.stdin.setRawMode(false);
          process.stdin.pause();
          resolve();
        });
      });

      // Show unlock prompt
      const input = await Prompt.new({
        promptID: "unlock-screen",
        title: "Terminal Locked",
        description: "Enter password to unlock:",
        type: 'masked'
      });

      if (await bcrypt.compare(input, admin.hash)) {
        this.isLocked = false;
        
        // Restore original stdout
        process.stdout.write = oldWrite;

        // Clear and restore terminal
        process.stdout.write('\x1Bc');
        console.log('[KERNEL] Try # help for information');
        
        // Replay stored content
        const storedContent = getStoredContent();
        if (storedContent) {
          console.log(storedContent);
        }
        
        // Reset state
        setLockState(false);
        clearBuffer();
        
        if (global.toggleInput) {
          global.toggleInput(true);
        }
        
        process.stdout.write('<<-');
        return true;
      }

      console.log("\n❌ Invalid password. Shutting down for security.");
      process.exit(1);
    } catch (err) {
      // Reset stdin state
      process.stdin.setRawMode(false);
      process.stdin.pause();
      console.error('Lock screen error:', err);
      process.stdout.write = oldWrite;
      clearBuffer();
    }
  }

  // --- INIT LOGIN ---
  async initAuth() {
    this.users = await loadUsers(this.key);

    if (this.users.length === 0) {
      console.log("\n🚀 No administrator found. Let's create one.");
      await this.createAdmin();
      return;
    }

    const admin = this.users[0];
    if (admin.lockedUntil && Date.now() < admin.lockedUntil) {
      const remainingMin = Math.ceil((admin.lockedUntil - Date.now()) / 60000);
      const unlockTime = new Date(admin.lockedUntil).toLocaleString();
      await clearTerminal();
      console.log('\n===========================================');
      console.log('🔒 SYSTEM LOCKED');
      console.log('===========================================');
      console.log(`⏰ Lock expires in: ${remainingMin} minutes`);
      console.log(`📅 Unlock time: ${unlockTime}`);
      console.log(`👤 Last attempt by: ${admin.deviceName}`);
      console.log('===========================================');
      console.log('Try again after the lock expires.\n');
      
      // Signal launcher to shutdown
      if (process.send) {
        process.send('shutdown');
      }
      process.exit(1);
    }
    await clearTerminal();
    
    let attempts = 0;
    while (true) {
      const input = await Prompt.new({ 
        promptID: "admin-login", 
        title: "Administrator Login", 
        description: "Enter administrator password (or type 'forgot-servermanager'):",
        type: 'masked' // Use masked input type
      });

      if (input === "forgot-servermanager") {
        if (admin.discordId) {
          console.log(`\n📩 Recovery triggered! Message would be sent to Discord ID: ${admin.discordId}`);
        } else {
          console.log("\n⚠️ No backup Discord ID configured. Manual reset required.");
        }
        process.exit(0);
      }

      if (await bcrypt.compare(input, admin.hash)) {
        console.log("\n✅ Login successful!");
        return { username: admin.username, discordId: admin.discordId };
      }

      attempts++;
      console.log("\n❌ Invalid password.");
      if (attempts >= 3) {
        admin.lockedUntil = Date.now() + LOCK_DURATION;
        await saveUsers(this.users, this.key);
        console.log("\n🚨 Too many failed attempts. System locked for 3 hours.");
        process.exit(1);
      }
    }
  }

  // --- CREATE ADMIN ---
  async createAdmin() {
    console.log("\n=== Create Administrator ===\n");
    
    const username = await Prompt.new({
      promptID: "admin-username",
      title: "Admin Setup",
      description: "Enter a new admin username:"
    });

    let password, confirm;
    while (true) {
      await clearTerminal();
      password = await Prompt.new({
        promptID: "admin-password",
        title: "Admin Setup",
        description: "Enter a new admin password:",
        type: 'masked' // Use masked input type
      });
      
      if (!password || password.trim() === "" || password === "forgot-servermanager") {
        console.log("\n❌ Invalid password. Please try again.");
        continue;
      }
      
      confirm = await Prompt.new({
        promptID: "admin-password-confirm",
        title: "Admin Setup",
        description: "Confirm your password:",
        type: 'masked' // Use masked input type
      });

      if (password === confirm) break;
      console.log("\n❌ Passwords do not match. Try again.");
    }

    const discordId = await Prompt.new({
      promptID: "admin-discord",
      title: "Admin Setup",
      description: "Optional Discord ID for recovery (press Enter to skip):"
    });

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
    if (!await this.ensureUnlocked()) return;
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
      
      // Validate new password
      if (!newPass || newPass.trim() === "" || newPass === "forgot-servermanager") {
        console.log("❌ Invalid password. Password cannot be empty, only spaces, or the recovery keyword.");
        continue;
      }
      
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
    if (this.isLocked) return;
    this.isLocked = true;

    // 1. Signal KNinput to stop listening
    if (global.toggleInput) {
      global.toggleInput(false);
    }

    // 2. Stop terminal output but keep capturing
    terminalManager.suppressOutput();

    // 3. Clear terminal and show lock message
    process.stdout.write('\x1Bc');
    console.log('\n\n');
    console.log('🔒 TERMINAL LOCKED');
    console.log('Press any key to unlock...');

    try {
      // Wait for any key
      await new Promise(resolve => {
        const handler = () => {
          process.stdin.removeListener('data', handler);
          resolve();
        };
        process.stdin.on('data', handler);
      });

      // Show password prompt
      const input = await Prompt.new({
        promptID: "unlock-screen",
        title: "Terminal Locked",
        description: "Enter password to unlock:",
        type: 'masked'
      });

      const admin = this.users[0];
      if (await bcrypt.compare(input, admin.hash)) {
        // Unlock sequence
        process.stdout.write('\x1Bc');
        
        // Resume terminal output
        terminalManager.resumeOutput();
        
        // Replay captured buffer
        const buffer = terminalManager.getBufferContent();
        console.log(buffer);
        
        // Re-enable input
        if (global.toggleInput) {
          global.toggleInput(true);
        }
        
        this.isLocked = false;
        console.log('✅ Terminal unlocked!');
        process.stdout.write('<<-');
        return true;
      }

      console.log("\n❌ Invalid password. Shutting down for security.");
      process.exit(1);

    } catch (err) {
      console.error('Lock screen error:', err);
      terminalManager.resumeOutput();
      this.isLocked = false;
      if (global.toggleInput) {
        global.toggleInput(true);
      }
    }
  }
}
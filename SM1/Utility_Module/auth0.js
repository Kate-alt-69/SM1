import fs from "fs";
import crypto from "crypto";
import readline from "readline";
import bcrypt from "bcrypt";
import Prompt from "./Prompt.js";
// ================== PATHS ================== //
const USERS_FILE = "./config/users.json";
const KEY_FILE = "./config/key.bin";
const LOCK_DURATION = 1000 * 60 * 60 * 3; // 3 hours in ms

// ================== HELPERS ================== //
function getKey() {
  if (!fs.existsSync(KEY_FILE)) {
    const key = crypto.randomBytes(32); // AES-256 key
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
  const buffer = Buffer.from(data, "base64");
  const iv = buffer.subarray(0, 16);
  const tag = buffer.subarray(16, 32);
  const encrypted = buffer.subarray(32);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString("utf8");
}

async function loadUsers(key) {
  if (!fs.existsSync(USERS_FILE)) return [];
  const raw = JSON.parse(fs.readFileSync(USERS_FILE, "utf8"));
  return raw.map((entry) => {
    const decryptedBase64 = decryptData(entry.data, key);
    const parsed = JSON.parse(Buffer.from(decryptedBase64, "base64").toString("utf8"));
    return {
      username: parsed.username,
      hash: parsed.hash,
      discordId: parsed.discordId || null,
      lockedUntil: parsed.lockedUntil || null,
    };
  });
}

async function saveUsers(users, key) {
  const data = users.map((u) => {
    const payload = JSON.stringify({
      username: u.username,
      hash: u.hash,
      discordId: u.discordId || null,
      lockedUntil: u.lockedUntil || null,
    });
    const base64Payload = Buffer.from(payload, "utf8").toString("base64");
    return { data: encryptData(base64Payload, key) };
  });
  fs.writeFileSync(USERS_FILE, JSON.stringify(data, null, 2));
}

// ================== MAIN AUTH ================== //
export async function initAuth() {
  const key = getKey();
  let users = await loadUsers(key);

  // First startup: force account creation
  if (users.length === 0) {
    console.log("🚀 No administrator found. Please create one.");
    const username = await prompt("New admin username: ");
    const password = await prompt("New admin password: ");
    const discordId = await prompt("Optional Discord ID (for password recovery): ");

    const hash = await bcrypt.hash(password, 12);
    users.push({
      username,
      hash,
      discordId: discordId || null,
      lockedUntil: null,
    });

    await saveUsers(users, key);
    console.log(
      `✅ Administrator account created! ${
        discordId ? "Backup recovery enabled." : "No backup recovery set."
      }`
    );
    return { username };
  }

  // Only one admin supported
  let user = users[0];

  // Check if system is locked
  if (user.lockedUntil && Date.now() < user.lockedUntil) {
    const remaining = new Date(user.lockedUntil).toLocaleTimeString();
    console.log(`🚫 System is locked until ${remaining}. Try again later.`);
    process.exit(1);
  }

  // Login flow
  console.log("🔒 Please enter administrator password (or type 'forgot-servermanager').");
  let attempts = 0;

  while (true) {
  const input = await Prompt.new({
    promptID: "admin-login",
    title: "Administrator Login",
    description: "Enter administrator password (or type 'forgot-servermanager')"
  });

  if (input === "forgot-servermanager") {
    if (user.discordId) {
      console.log(`📩 Recovery triggered! A message would be sent to Discord ID: ${user.discordId}`);
    } else {
      console.log("⚠️ No backup Discord ID configured. Manual reset required.");
    }
    process.exit(0);
  }

  if (await bcrypt.compare(input, user.hash)) {
    console.log("✅ Login successful!");
    return { username: user.username, discordId: user.discordId };
  }

  attempts++;
  console.log("❌ Invalid password.");
  if (attempts >= 3) {
    user.lockedUntil = Date.now() + LOCK_DURATION;
    await saveUsers([user], key);
    console.log("🚨 Too many failed attempts. System locked for 6 hours.");
    process.exit(1);
  }}
}
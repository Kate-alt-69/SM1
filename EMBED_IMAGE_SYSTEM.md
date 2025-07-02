# 📄 Discord Embed Bot – Image Upload & Encryption System Design (Kate’s Spec)

## 🔧 Feature Overview

This system allows users to upload images through Discord, associate them with a custom embed, and securely store those images using encryption. Users are prompted to confirm before their image is permanently stored. Images are organized based on server (local) or global access, ensuring structured and secure file handling.

---

## 🧩 Workflow Summary

1. **Image Upload (Stage 1):**

   - A user sends an image in a Discord channel (as an attachment).
   - The bot detects the image and saves it temporarily in a staging folder.
   - Each staged image is given a unique **ticket ID** (e.g., `000001`) and saved as:

     ```
     Embed-stage1/stage1/000001-{USERID}.tmp
     ```

   - Alongside the image, a `.json` metadata file is created containing:

     ```json
     {
       "ticket": "000001",
       "userId": "123456789",
       "createdAt": "2025-06-26T14:00:00Z",
       "expiresInSec": 45
     }
     ```

2. **User Confirmation:**

   - The bot sends a confirmation message with buttons:
     - ✅ Confirm upload
     - ❌ Cancel upload
   - If the user confirms:
     - The image is encrypted using AES-256-CBC
     - It is saved to a structured folder path based on access type (Local or Global)
     - Example:

       ```
       Embedded-Data/
       ├── {SERVER_ID}/
       │   └── {USER_ID}/
       │       └── Local/
       │           └── welcome.enc
       └── Global/
           └── {USER_ID}/
               └── welcome.enc
       ```

   - If the user cancels or doesn’t respond within 45 seconds:
     - The temporary `.tmp` file and its `.json` metadata are deleted automatically by a scheduled cleanup function.

3. **File Naming:**

   - Encrypted files are named using a strict format for uniqueness and searchability:

     ```
     {type}-{USERID}-{EMBEDNAME}.enc
     ```

     - Example: `author-123456789-welcome.enc`

4. **Security:**

   - All images are encrypted before storage using the built-in Node.js `crypto` module.
   - The encryption key and IV (initialization vector) are securely stored.
   - Only the user who uploaded the image can confirm or cancel their own image ticket.

5. **Auto-Cleanup (Garbage Collection):**

   - Every 10 seconds, a background process checks the `.json` metadata of all staged files.
   - If any staged image has expired (based on `createdAt` + `expiresInSec`), both the `.tmp` file and its `.json` are deleted.

---

## ✅ Key Benefits of This System

| Feature                | Benefit                                                                |
| ---------------------- | ---------------------------------------------------------------------- |
| Temporary staging      | Prevents unnecessary storage of unconfirmed uploads                    |
| Unique ticket system   | Prevents file overwrites and ensures user isolation                    |
| Encryption before save | Secures user-uploaded images from being accessed by server/host admins |
| Structured storage     | Organized per server, per user, and by embed name and scope            |
| Auto-expiry            | Keeps storage clean and avoids clutter from abandoned uploads          |
| Permission control     | Only the uploader can confirm or cancel their staged image             |

---

## 🚀 Future Expansions (Optional)

- Add support for thumbnails or footer images (multiple image types per embed)
- Store embed metadata in `.json` or MongoDB
- Implement role-based upload limits or embed quotas
- Add image preview before encryption
- Build a web dashboard to manage uploaded embeds

---

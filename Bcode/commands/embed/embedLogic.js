const fs = require('fs').promises;
const path = require('path');

const embedDrafts = new Map(); // key = `${guildId}_${userId}`

// Generate file path
function getEmbedPath(guildId, userId, embedName) {
    const baseDir = path.join(__dirname, '..', '..', 'Embedded-Data', guildId, userId, 'Global');
    return {
        baseDir,
        fullPath: path.join(baseDir, `${embedName}.json`)
    };
}

// Max fields allowed
const MAX_FIELDS = 4;

module.exports = {
    // Draft Control
    setDraft(guildId, userId, data) {
        embedDrafts.set(`${guildId}_${userId}`, data);
    },

    getDraft(guildId, userId) {
        return embedDrafts.get(`${guildId}_${userId}`);
    },

    clearDraft(guildId, userId) {
        embedDrafts.delete(`${guildId}_${userId}`);
    },

    // Embed Value Setters
    setTitle(guildId, userId, title) {
        const draft = this.getDraft(guildId, userId);
        if (draft) draft.title = title;
    },

    setDescription(guildId, userId, desc) {
        const draft = this.getDraft(guildId, userId);
        if (draft) draft.description = desc;
    },

    setColor(guildId, userId, color) {
        const draft = this.getDraft(guildId, userId);
        if (draft) {
            draft.colorHistory = draft.colorHistory || [];
            draft.colorHistory.push(draft.color);
            draft.color = color;
        }
    },

    undoColor(guildId, userId) {
        const draft = this.getDraft(guildId, userId);
        if (draft && draft.colorHistory && draft.colorHistory.length > 0) {
            draft.color = draft.colorHistory.pop();
        }
    },

    setAuthor(guildId, userId, author) {
        const draft = this.getDraft(guildId, userId);
        if (draft) draft.author = author;
    },

    // Field Handling
    addField(guildId, userId, name, value, inline = false) {
        const draft = this.getDraft(guildId, userId);
        if (draft) {
            draft.fields = draft.fields || [];
            if (draft.fields.length >= MAX_FIELDS) {
                throw new Error(`Max of ${MAX_FIELDS} fields reached`);
            }
            draft.fields.push({ name, value, inline });
        }
    },

    editField(guildId, userId, nameToEdit, newValue) {
        const draft = this.getDraft(guildId, userId);
        if (draft && draft.fields) {
            const field = draft.fields.find(f => f.name === nameToEdit);
            if (field) {
                field.value = newValue;
            }
        }
    },

    deleteField(guildId, userId, nameToDelete) {
        const draft = this.getDraft(guildId, userId);
        if (draft && draft.fields) {
            draft.fields = draft.fields.filter(f => f.name !== nameToDelete);
        }
    },

    getFieldList(guildId, userId) {
        const draft = this.getDraft(guildId, userId);
        return draft?.fields || [];
    },

    // Save / Load
    async saveEmbed(guildId, userId, embedName) {
        const draft = this.getDraft(guildId, userId);
        if (!draft) throw new Error('No draft to save');

        const { baseDir, fullPath } = getEmbedPath(guildId, userId, embedName);
        await fs.mkdir(baseDir, { recursive: true });
        await fs.writeFile(fullPath, JSON.stringify(draft, null, 2));
        return fullPath;
    },

    async loadEmbed(guildId, userId, embedName) {
        const { fullPath } = getEmbedPath(guildId, userId, embedName);
        try {
            const raw = await fs.readFile(fullPath, 'utf8');
            const parsed = JSON.parse(raw);
            this.setDraft(guildId, userId, parsed);
            return parsed;
        } catch {
            return null;
        }
    },

    async searchEmbeds(guildId, userId, searchTerm) {
        const dir = path.join(__dirname, '..', '..', 'Embedded-Data', guildId, userId, 'Global');
        try {
            const files = await fs.readdir(dir);
            return files
                .filter(f => f.toLowerCase().includes(searchTerm.toLowerCase()))
                .map(f => f.replace('.json', ''));
        } catch {
            return [];
        }
    }
};

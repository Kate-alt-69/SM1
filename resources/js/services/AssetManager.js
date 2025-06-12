class AssetManager {
    constructor() {
        this.basePath = '';
        this.defaultIcons = {
            avatar: 'icons/default-bot.ico',
            loading: 'icons/loading.ico',
            error: 'icons/error.ico'
        };
    }

    async initialize() {
        try {
            this.basePath = await Neutralino.filesystem.getPath();
            console.log('Asset manager initialized at:', this.basePath);
            return true;
        } catch (error) {
            console.error('Asset manager init failed:', error);
            return false;
        }
    }

    getIconPath(name) {
        return this.defaultIcons[name] || null;
    }
}

window.AssetManager = new AssetManager();

class IconManager {
    constructor() {
        this.icons = {
            'server': 'server-manager.ico',
            'error': 'error-icon.ico',
            'settings': 'settings-icon.ico',
            'downArrow': 'down-arrow-icon.ico',
            'wrench': 'wrench-icon.ico'
        };
        this.iconsRoot = '/icons/';
    }

    async initialize() {
        try {
            const appPath = await Neutralino.filesystem.getPath('.');
            const iconsPath = `${appPath}/${this.iconsRoot}`;
            
            // Ensure icons directory exists
            await Neutralino.filesystem.createDirectory(iconsPath)
                .catch(() => {}); // Ignore if exists

            // Verify all icons exist
            for (const [key, filename] of Object.entries(this.icons)) {
                try {
                    await Neutralino.filesystem.getStats(`${iconsPath}${filename}`);
                    console.log(`✓ Found icon: ${filename}`);
                } catch (error) {
                    console.warn(`⚠️ Missing icon: ${filename}`);
                }
            }

            // Register icon paths
            this.registerIconPaths(appPath);
            return true;
        } catch (error) {
            console.error('Failed to initialize icons:', error);
            return false;
        }
    }

    registerIconPaths(appPath) {
        for (const [key, filename] of Object.entries(this.icons)) {
            this[key] = `${this.iconsRoot}${filename}`;
        }
    }

    getIconPath(iconName) {
        const iconFile = this.icons[iconName];
        return iconFile ? `${this.iconsRoot}${iconFile}` : null;
    }
}

window.IconManager = new IconManager();

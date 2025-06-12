class LocalServer {
    constructor() {
        this.port = 0;
        this.serverRoot = '';
        this.running = false;
    }

    async initialize() {
        try {
            // Get application path
            const appPath = await Neutralino.filesystem.getPath('.');
            this.serverRoot = appPath;
            this.running = true;

            // Setup file serving
            Neutralino.events.on('serverRequest', this.handleRequest.bind(this));
            
            console.log('✓ Resource server initialized');
            return true;
        } catch (error) {
            console.error('Failed to initialize resource server:', error);
            return false;
        }
    }

    async handleRequest(evt) {
        if (!this.running) return;

        try {
            const path = evt.detail.path;
            // Handle icon requests
            if (path.startsWith('/icons/')) {
                return this.serveIcon(path.replace('/icons/', ''));
            }
            // Handle other resources
            return this.serveFile(path);
        } catch (error) {
            console.error('Request handler error:', error);
            return { status: 500 };
        }
    }

    async serveIcon(iconName) {
        const iconPath = window.IconManager.getIconPath(iconName);
        if (!iconPath) return { status: 404 };
        
        try {
            const content = await Neutralino.filesystem.readBinaryFile(iconPath);
            return {
                status: 200,
                headers: { 'Content-Type': 'image/x-icon' },
                body: content
            };
        } catch (error) {
            console.error('Icon serve error:', error);
            return { status: 404 };
        }
    }

    async serveFile(path) {
        try {
            const fullPath = `${this.serverRoot}${path}`;
            const content = await Neutralino.filesystem.readBinaryFile(fullPath);
            const ext = path.split('.').pop().toLowerCase();
            
            return {
                status: 200,
                headers: { 'Content-Type': this.getMimeType(ext) },
                body: content
            };
        } catch (error) {
            return { status: 404 };
        }
    }

    getMimeType(ext) {
        const mimeTypes = {
            'html': 'text/html',
            'css': 'text/css',
            'js': 'text/javascript',
            'json': 'application/json',
            'png': 'image/png',
            'jpg': 'image/jpeg',
            'ico': 'image/x-icon',
            'svg': 'image/svg+xml'
        };
        return mimeTypes[ext] || 'application/octet-stream';
    }
}

window.LocalServer = new LocalServer();

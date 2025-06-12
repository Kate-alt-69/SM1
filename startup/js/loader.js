class LoadingManager {
    constructor() {
        this.loadWindow = document.getElementById('loadWindow');
        this.stages = [
            { message: 'Running system check...', progress: 0 },
            { message: 'Verifying files...', progress: 20 },
            { message: 'Loading resources...', progress: 40 },
            { message: 'Checking Discord integration...', progress: 60 },
            { message: 'Setting up interface...', progress: 80 },
            { message: 'Ready!', progress: 100 }
        ];
    }

    async start() {
        try {
            await Neutralino.init();
            
            // Run through loading stages
            for (const stage of this.stages) {
                await this.updateStatus(stage.message, stage.progress);
                await new Promise(resolve => setTimeout(resolve, 500));
            }

            // Launch main window
            await this.launchMainWindow();

        } catch (error) {
            console.error('Loading error:', error);
            this.showError('Failed to initialize application');
        }
    }

    async updateStatus(message, progress) {
        const fillEl = this.loadWindow.querySelector('.progress-fill');
        const textEl = this.loadWindow.querySelector('.progress-text');
        const statusEl = this.loadWindow.querySelector('.loading-status');
        const details = this.loadWindow.querySelector('.loading-details');

        fillEl.style.width = `${progress}%`;
        textEl.textContent = `${Math.round(progress)}%`;
        statusEl.textContent = message;

        const item = document.createElement('div');
        item.className = 'detail-item';
        item.textContent = `✓ ${message}`;
        details.appendChild(item);
        details.scrollTop = details.scrollHeight;
    }

    async launchMainWindow() {
        await Neutralino.window.create('../resources/index.html', {
            title: 'Server Manager',
            width: 1200,
            height: 800,
            center: true
        });
        await Neutralino.window.hide(); // Hide loader window
    }
}

// Initialize loading screen
window.onload = () => {
    const loader = new LoadingManager();
    loader.start();
};

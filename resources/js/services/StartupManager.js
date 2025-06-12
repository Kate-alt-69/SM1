class StartupManager {
    constructor() {
        this.loadWindow = document.getElementById('loadWindow');
        this.mainWindow = document.getElementById('mainWindow');
        this.progress = 0;
        this.tasks = [
            { name: 'Creating directories...', weight: 15 },
            { name: 'Verifying resources...', weight: 20 },
            { name: 'Loading configuration...', weight: 15 },
            { name: 'Initializing services...', weight: 20 },
            { name: 'Preparing interface...', weight: 30 }
        ];
        this.currentTask = 0;
    }

    async start() {
        for (const task of this.tasks) {
            await this.runTask(task);
        }
        await this.finish();
    }

    async runTask(task) {
        this.updateStatus(task.name);
        this.progress += task.weight;
        await this.updateProgress(this.progress);
        await this.addDetail(task.name);
        
        // Simulate task execution (replace with actual tasks)
        await new Promise(resolve => setTimeout(resolve, 500));
    }

    updateStatus(status) {
        const statusEl = this.loadWindow.querySelector('.loading-status');
        if (statusEl) statusEl.textContent = status;
    }

    async updateProgress(value) {
        const fill = this.loadWindow.querySelector('.progress-fill');
        const text = this.loadWindow.querySelector('.progress-text');
        
        fill.style.width = `${value}%`;
        text.textContent = `${Math.round(value)}%`;
        
        await new Promise(resolve => setTimeout(resolve, 100));
    }

    addDetail(detail) {
        const details = this.loadWindow.querySelector('.loading-details');
        const item = document.createElement('div');
        item.className = 'detail-item';
        item.textContent = `✓ ${detail}`;
        details.appendChild(item);
        details.scrollTop = details.scrollHeight;
    }

    async finish() {
        await this.updateProgress(100);
        this.updateStatus('Ready!');
        
        // Fade out loading window
        this.loadWindow.style.transition = 'opacity 0.5s';
        this.loadWindow.style.opacity = '0';
        
        // Show main window
        this.mainWindow.classList.remove('hidden');
        
        // Remove loading window
        await new Promise(resolve => setTimeout(resolve, 500));
        this.loadWindow.remove();
    }
}

window.StartupManager = new StartupManager();

class LoadingScreen {
    constructor() {
        this.loadingIcon = 'icons/server-manager.ico';  // Use main icon for loading
    }

    initialize() {
        const loadingLogo = document.querySelector('.loading-logo');
        if (loadingLogo) {
            loadingLogo.src = this.loadingIcon;
        }
    }

    updateProgress(stage) {
        const statusEl = document.querySelector('.loading-status');
        const progressFill = document.querySelector('.progress-fill');
        const progressText = document.querySelector('.progress-text');
        
        if (statusEl) statusEl.textContent = stage.message;
        if (progressFill) progressFill.style.width = `${stage.progress}%`;
        if (progressText) progressText.textContent = `${stage.progress}%`;
    }

    addDetail(message) {
        const details = document.querySelector('.loading-details');
        if (details) {
            const item = document.createElement('div');
            item.className = 'detail-item';
            item.textContent = message;
            details.appendChild(item);
            details.scrollTop = details.scrollHeight;
        }
    }
}

window.LoadingScreen = new LoadingScreen();

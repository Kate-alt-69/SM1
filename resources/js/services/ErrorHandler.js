class ErrorHandler {
    static showErrorWindow(title, message, fatal = false) {
        const errorWindow = document.createElement('div');
        errorWindow.className = 'error-window';
        errorWindow.innerHTML = `
            <div class="error-content">
                <div class="error-header">
                    <img src="icons/error.ico" alt="Error" class="error-icon">
                    <h2>${title}</h2>
                </div>
                <div class="error-body">
                    <p>${message}</p>
                    ${fatal ? '<p class="error-fatal">The application needs to restart to recover.</p>' : ''}
                </div>
                <div class="error-actions">
                    ${fatal ? 
                        `<button onclick="window.ErrorHandler.restartApp()" class="restart-button">Restart App</button>` :
                        `<button onclick="window.ErrorHandler.closeError(this)" class="close-button">Close</button>`
                    }
                </div>
            </div>
        `;
        document.body.appendChild(errorWindow);
    }

    static closeError(button) {
        const errorWindow = button.closest('.error-window');
        if (errorWindow) {
            errorWindow.classList.add('fade-out');
            setTimeout(() => errorWindow.remove(), 300);
        }
    }

    static async restartApp() {
        try {
            await Neutralino.app.restartProcess();
        } catch (error) {
            this.showErrorWindow(
                'Restart Failed',
                'Could not restart the application. Please close and reopen manually.',
                false
            );
        }
    }

    static handleInitError(error) {
        const isFatal = error.message.includes('Failed to load resources') || 
                       error.message.includes('Directory creation failed');
        
        this.showErrorWindow(
            'Initialization Error',
            error.message,
            isFatal
        );
    }
}

window.ErrorHandler = ErrorHandler;

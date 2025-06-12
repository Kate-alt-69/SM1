class StartupStages {
    constructor() {
        this.stages = [
            {
                name: 'System Check',
                tasks: [
                    { name: 'Verifying application paths', action: this.verifyPaths },
                    { name: 'Checking permissions', action: this.checkPermissions },
                    { name: 'Validating environment', action: this.validateEnvironment }
                ]
            },
            {
                name: 'Resource Verification',
                tasks: [
                    { name: 'Verifying assets', action: this.verifyAssets },
                    { name: 'Checking required files', action: this.checkRequiredFiles },
                    { name: 'Loading default resources', action: this.loadDefaultResources }
                ]
            },
            {
                name: 'Application Setup',
                tasks: [
                    { name: 'Creating directories', action: this.createDirectories },
                    { name: 'Setting up configuration', action: this.setupConfig },
                    { name: 'Initializing services', action: this.initServices }
                ]
            },
            {
                name: 'Discord Integration',
                tasks: [
                    { name: 'Validating token', action: this.validateToken },
                    { name: 'Testing bot connection', action: this.testBotConnection },
                    { name: 'Checking bot permissions', action: this.checkBotPermissions }
                ]
            },
            {
                name: 'Final Checks',
                tasks: [
                    { name: 'Checking internet connection', action: this.checkInternet },
                    { name: 'Verifying app integrity', action: this.verifyIntegrity },
                    { name: 'Preparing interface', action: this.prepareInterface }
                ]
            }
        ];
    }

    async start(updateCallback) {
        let totalSteps = this.stages.reduce((sum, stage) => sum + stage.tasks.length, 0);
        let currentStep = 0;
        let errors = [];

        for (const stage of this.stages) {
            updateCallback(`Starting ${stage.name}...`, (currentStep / totalSteps) * 100);

            for (const task of stage.tasks) {
                try {
                    await task.action();
                    currentStep++;
                    updateCallback(
                        `${stage.name}: ${task.name}`, 
                        (currentStep / totalSteps) * 100
                    );
                } catch (error) {
                    errors.push({ stage: stage.name, task: task.name, error: error.message });
                    if (this.isCriticalError(error)) {
                        throw new Error(`Critical error in ${stage.name}: ${error.message}`);
                    }
                }
            }
        }

        return { success: errors.length === 0, errors };
    }

    isCriticalError(error) {
        const criticalKeywords = ['EACCES', 'token', 'permission denied', 'critical'];
        return criticalKeywords.some(keyword => 
            error.message.toLowerCase().includes(keyword)
        );
    }

    // Stage implementation methods
    async verifyPaths() {
        const paths = ['resources', 'Bcode', 'assets'];
        for (const path of paths) {
            await Neutralino.filesystem.getStats(path).catch(() => {
                throw new Error(`Required path ${path} not found`);
            });
        }
    }

    async checkPermissions() {
        try {
            await Neutralino.filesystem.writeFile('.test', 'test');
            await Neutralino.filesystem.removeFile('.test');
        } catch {
            throw new Error('Application lacks required file permissions');
        }
    }

    async validateEnvironment() {
        if (!window.Neutralino) {
            throw new Error('Neutralino environment not initialized');
        }
    }

    // ... implement other stage methods similarly ...
}

window.StartupStages = new StartupStages();

class FileRecoveryService {
    constructor() {
        this.requiredFiles = {
            config: [
                { path: 'Bcode/config/token.json', template: '{"token": ""}' },
                { path: 'Bcode/config/commands.json', template: '[]' }
            ],
            assets: [
                { path: 'resources/assets/default-avatar.png', isAsset: true },
                { path: 'resources/assets/wrench.png', isAsset: true },
                { path: 'resources/assets/settings.png', isAsset: true }
            ],
            core: [
                { path: 'Bcode/DCB.js', critical: true },
                { path: 'Bcode/commands/embed.js', template: 'module.exports = {};' },
                { path: '.env', template: 'MODE=DEV\nTOKEN_PATH=./Bcode/config/token.json' }
            ]
        };

        this.status = {
            missingFiles: [],
            recoveredFiles: [],
            criticalErrors: []
        };
    }

    async checkFiles() {
        console.log('🔍 Starting file system check...');
        this.status = { missingFiles: [], recoveredFiles: [], criticalErrors: [] };

        for (const category in this.requiredFiles) {
            console.log(`\n📁 Checking ${category} files...`);
            
            for (const file of this.requiredFiles[category]) {
                try {
                    await this.verifyFile(file);
                } catch (error) {
                    if (file.critical) {
                        this.status.criticalErrors.push({
                            file: file.path,
                            error: error.message
                        });
                    }
                }
            }
        }

        return this.generateReport();
    }

    async verifyFile(file) {
        try {
            await Neutralino.filesystem.getStats(file.path);
            console.log(`   ✅ Found: ${file.path}`);
        } catch (error) {
            console.log(`   ❌ Missing: ${file.path}`);
            this.status.missingFiles.push(file.path);
            
            if (file.critical) {
                throw new Error(`Critical file missing: ${file.path}`);
            }

            await this.recoverFile(file);
        }
    }

    async recoverFile(file) {
        try {
            // Create parent directories if needed
            const dirs = file.path.split('/').slice(0, -1);
            let currentPath = '';
            for (const dir of dirs) {
                currentPath += (currentPath ? '/' : '') + dir;
                await Neutralino.filesystem.createDirectory(currentPath).catch(() => {});
            }

            if (file.isAsset) {
                await this.recoverAsset(file.path);
            } else if (file.template) {
                await Neutralino.filesystem.writeFile(file.path, file.template);
            }

            console.log(`   🔄 Recovered: ${file.path}`);
            this.status.recoveredFiles.push(file.path);
        } catch (error) {
            console.error(`   ⚠️ Recovery failed for ${file.path}:`, error);
        }
    }

    async recoverAsset(path) {
        const assetName = path.split('/').pop().replace('.png', '');
        const svgData = window.ResourceManager.getDefaultAsset(assetName);
        if (svgData) {
            // Convert SVG to PNG and save
            const img = await window.ResourceManager.loadImage(assetName);
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            
            const blob = await new Promise(resolve => canvas.toBlob(resolve));
            const arrayBuffer = await blob.arrayBuffer();
            await Neutralino.filesystem.writeBinaryFile(path, arrayBuffer);
        }
    }

    generateReport() {
        const report = {
            timestamp: new Date().toISOString(),
            status: this.status.criticalErrors.length === 0 ? 'OK' : 'CRITICAL',
            missing: this.status.missingFiles.length,
            recovered: this.status.recoveredFiles.length,
            critical: this.status.criticalErrors.length,
            details: {
                missingFiles: this.status.missingFiles,
                recoveredFiles: this.status.recoveredFiles,
                criticalErrors: this.status.criticalErrors
            }
        };

        console.log('\n📊 File System Check Report:');
        console.log('=====================================');
        console.log(`Status: ${report.status}`);
        console.log(`Missing Files: ${report.missing}`);
        console.log(`Recovered Files: ${report.recovered}`);
        console.log(`Critical Errors: ${report.critical}`);
        console.log('=====================================\n');

        return report;
    }
}

window.FileRecovery = new FileRecoveryService();

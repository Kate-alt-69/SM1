class InitializationService {
    constructor() {
        this.requiredDirectories = [
            'Bcode',
            'Bcode/config',
            'Bcode/commands',
            'Bcode/utils',
            'Bcode/data'
        ];
        
        this.requiredFiles = [
            {
                path: 'Bcode/config/token.json',
                defaultContent: '{"token": ""}'
            },
            {
                path: 'Bcode/config/commands.json',
                defaultContent: '[]'
            }
        ];
    }

    async initialize() {
        console.log('🚀 Starting initialization...');

        try {
            // Create required directories
            await this.createDirectories();

            // Create required files
            await this.createFiles();

            // Verify directory structure
            await this.verifyStructure();

            console.log('✅ Initialization complete');
            return true;

        } catch (error) {
            console.error('❌ Initialization failed:', error);
            throw error;
        }
    }

    async createDirectories() {
        console.log('📁 Verifying required directories...');
        
        for (const dir of this.requiredDirectories) {
            try {
                const fullPath = await Neutralino.filesystem.getPath(dir);
                await Neutralino.filesystem.getStats(fullPath);
                console.log(`   Found directory: ${dir}`);
            } catch (err) {
                console.log(`   Directory not found: ${dir}, attempting to create...`);
                try {
                    const parentDir = dir.split('/').slice(0, -1).join('/');
                    if (parentDir) {
                        await Neutralino.filesystem.createDirectory(parentDir);
                    }
                    await Neutralino.filesystem.createDirectory(dir);
                    console.log(`   Created directory: ${dir}`);
                } catch (createErr) {
                    // Ignore if directory already exists
                    if (!createErr.message.includes('already exists')) {
                        throw createErr;
                    }
                }
            }
        }
    }

    async createFiles() {
        console.log('📄 Creating required files...');

        for (const file of this.requiredFiles) {
            try {
                await Neutralino.filesystem.getStats(file.path);
                console.log(`   Verified file exists: ${file.path}`);
            } catch {
                await Neutralino.filesystem.writeFile(
                    file.path, 
                    file.defaultContent
                );
                console.log(`   Created file: ${file.path}`);
            }
        }
    }

    async verifyStructure() {
        console.log('🔍 Verifying directory structure...');
        
        // Verify directories
        for (const dir of this.requiredDirectories) {
            const stats = await Neutralino.filesystem.getStats(dir);
            if (!stats.isDirectory) {
                throw new Error(`${dir} is not a directory`);
            }
        }

        // Verify files
        for (const file of this.requiredFiles) {
            const stats = await Neutralino.filesystem.getStats(file.path);
            if (!stats.isFile) {
                throw new Error(`${file.path} is not a file`);
            }
        }
    }
}

const InitSystem = new InitializationService();
window.InitSystem = InitSystem;

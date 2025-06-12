async function ensureDirectories() {
    // First ensure the basic structure
    const baseStructure = [
        'resources',
        'resources/assets',
        'Bcode',
        'Bcode/config',
        'Bcode/commands',
        'Bcode/utils',
        'Bcode/data'
    ];

    for (const dir of baseStructure) {
        try {
            const stats = await Neutralino.filesystem.getStats(dir);
            console.log(`Found directory: ${dir}`);
        } catch {
            try {
                await Neutralino.filesystem.createDirectory(dir);
                console.log(`Created directory: ${dir}`);
            } catch (error) {
                if (!error.message.includes('already exists')) {
                    console.error(`Failed to create ${dir}:`, error);
                }
            }
        }
    }

    // Set up the working directory correctly
    try {
        const currentPath = await Neutralino.filesystem.getPath('.');
        console.log('Working directory:', currentPath);
    } catch (error) {
        console.error('Failed to get working directory:', error);
    }
}

window.DirectoryManager = { ensureDirectories };

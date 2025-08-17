const ErrorCodes = {
    MODAL_FAILED: 'ERR_MODAL_001',
    BUTTON_FAILED: 'ERR_BTN_001',
    INTERACTION_FAILED: 'ERR_INTER_ACTION_001',

    EMBED_CREATE_FAILED: 'ERR_EMB_CREATION_FAIL_001',
    EMBED_EDIT_FAILED: 'ERR_EMB_EDIT_FAIL_002',
    EMBED_SEND_FAILED: 'ERR_EMB_SEND_FAIL_003',

    PERMISSION_DENIED: 'ERR_PERM_DENIED_001',

    COMMAND_DISABLED: 'ERR_C_DISABLE_001',
    COMMAND_FOLDER_DISABLED: 'ERR_C_FOLDER_DISABLE_002',   // <- new
    COMMAND_COOLDOWN: 'ERR_C_COLD_003',

    INVALID_CHANNEL: 'ERR_CHANNEL_001',
    INVALID_PERMISSIONS: 'ERR_PERM_002',
    BOT_MISSING_PERMISSIONS: 'ERR_NO_PERM_003',

    CONSOLE_COMMAND_FAILED: 'ERR_CONSOLE_COMMAND_001',
    CONSOLE_RECEIVED_FAILED: 'ERR_CONSOLE_RECEIVED_FAILED_002',
    CONSOLE_SEND_FAILED: 'ERR_CONSOLE_SEND_FAILED_003',
};

const ErrorMessages = {
    [ErrorCodes.MODAL_FAILED]: 'Failed to show input form. Please try again.',
    [ErrorCodes.BUTTON_FAILED]: 'Button interaction failed. Please try again.',
    [ErrorCodes.INTERACTION_FAILED]: 'Command interaction failed. Please try again.',

    [ErrorCodes.EMBED_CREATE_FAILED]: 'Failed to create embed. Please check your inputs.',
    [ErrorCodes.EMBED_EDIT_FAILED]: 'Failed to edit embed. Please try again.',
    [ErrorCodes.EMBED_SEND_FAILED]: 'Failed to send embed. Please check channel permissions.',

    [ErrorCodes.PERMISSION_DENIED]: 'You don\'t have permission to use this command.',

    [ErrorCodes.COMMAND_DISABLED]: 'This command is currently disabled.\nPlease contact the host to enable it.',
    [ErrorCodes.COMMAND_FOLDER_DISABLED]: 'This category of commands is disabled.\nPlease contact the host to enable it.', // <- new
    [ErrorCodes.COMMAND_COOLDOWN]: 'Please wait before using this command again.',

    [ErrorCodes.INVALID_CHANNEL]: 'This command cannot be used in this channel.',
    [ErrorCodes.INVALID_PERMISSIONS]: 'You need additional permissions to use this command.',
    [ErrorCodes.BOT_MISSING_PERMISSIONS]: 'I need additional permissions to execute this command.',

    [ErrorCodes.CONSOLE_COMMAND_FAILED]: 'Failed to execute console command. Please try again or contact the host.',
    [ErrorCodes.CONSOLE_RECEIVED_FAILED]: 'Failed to receive console message. Please try again.',
    [ErrorCodes.CONSOLE_SEND_FAILED]: 'Failed to send console command. Please try again later.'
};

// Add helper function for detailed error responses
function getErrorMessage(code, details = null) {
    const baseMessage = ErrorMessages[code] || 'An unknown error occurred';
    return details ? `${baseMessage}\nDetails: ${details}` : baseMessage;
}

module.exports = { ErrorCodes, ErrorMessages, getErrorMessage };
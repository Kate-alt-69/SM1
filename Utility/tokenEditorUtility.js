const { TokenManager } = require('../Bcode/utils/TokenManager');

class TokenEditorUtility {
  constructor() {
    this.tokenManager = new TokenManager();
  }

  /**
   * Validate the token format
   * @param {string} token - The token to validate
   * @returns {boolean} - Whether the token format is valid
   */
  isValidTokenFormat(token) {
    return this.tokenManager.isValidTokenFormat(token);
  }

  /**
   * Check if the token is a Discord token
   * @param {string} token - The token to check
   * @returns {boolean} - Whether the token is a Discord token
   */
  isDiscordToken(token) {
    // For now, we can use a simple regex to check if the token matches the Discord token format
    const discordTokenRegex = /^[A-Za-z0-9_-]{24,}\.[A-Za-z0-9_-]{6}\.[A-Za-z0-9_-]{27}$/;
    return discordTokenRegex.test(token);
  }

  /**
   * Save the token to the token.json file
   * @param {string} token - The token to save
   * @returns {boolean} - Whether the token was saved successfully
   */
  saveToken(token) {
    return this.tokenManager.saveToken(token);
  }

  /**
   * Validate the token and return an error message if invalid
   * @param {string} token - The token to validate
   * @returns {string|null} - An error message if the token is invalid, or null if valid
   */
    editToken(newToken) {
    const errorMessage = this.validateToken(newToken);
    if (errorMessage) {
      console.log(errorMessage);
      return false;
    }

    return this.tokenManager.editToken(newToken);
  }
    /**
   * Edit the token in the token.json file
   * @param {string} newToken - The new token to save
   * @returns {boolean} - Whether the token was edited successfully
   */
  validateToken(token) {
    if (!this.isValidTokenFormat(token)) {
      return 'Error: ⛔️ Invalid token format. Please use a valid token format.';
    }

    if (!this.isDiscordToken(token)) {
      return 'Error: ⛔️ Token is not a Discord token. Please use a valid Discord token.';
    }

    return null;
  }
    /**
   * Delete the token from the token.json file
   * @returns {boolean} - Whether the token was deleted successfully
   */
  deleteToken() {
    const tokenJsonPath = path.join(bcodePath, 'config', 'token.json');
    const tokenJson = JSON.parse(fs.readFileSync(tokenJsonPath, 'utf8'));
    tokenJson.token = '';
    fs.writeFileSync(tokenJsonPath, JSON.stringify(tokenJson, null, 2));
    return true;
  }
}

module.exports = TokenEditorUtility;
// This utility class can be used to manage token editing and validation in the application.
// It provides methods to validate the token format, check if it's a Discord token, save the token, and validate the token with appropriate error messages.
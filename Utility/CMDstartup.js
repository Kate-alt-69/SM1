const createCommandsJson = require('./CMDtoggle');

module.exports = (CMDtoggle) => {
  async function startup() {
    await CMDtoggle();
      console.log('Commands.json file generated successfully!');
  }
};

module.exports = startup;
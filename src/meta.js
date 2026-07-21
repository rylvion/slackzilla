const packageJson = require('../package.json')

module.exports = {
  name: packageJson.name,
  displayName: 'slackzilla',
  shortDesc: packageJson.description,
  longDesc: 'a fun slack bot that can do loads of things, from useful tools to random commands. type /help and see what slackzilla can do, with more commands and upgrades being added over time',
  author: packageJson.author,
  themeColor: '#101f4d',
  version: packageJson.version,

  socketMode: true,

  botUser: {
    displayName: 'Slackzilla',
    alwaysOnline: true
  },

  oauthScopes: [
    'app_mentions:read',
    'channels:history',
    'chat:write',
    'commands'
  ],

  settings: {
    orgDeployEnabled: false,
    isHosted: false,
    tokenRotationEnabled: false
  }
}

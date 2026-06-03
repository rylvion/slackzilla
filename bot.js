require("dotenv").config()
const { App } = require('@slack/bolt')

const app = new App({
    token: process.env.SLACK_BOT_TOKEN, // make sure to set these env vars in your .env file
    appToken: process.env.SLACK_APP_TOKEN,
    signingSecret: process.env.SLACK_SIGNING_SECRET,
    socketMode: true
})

const pre = "/sz-"; // signature

const cmds = {
    ping: `${pre}ping`
}

// 'hello'...
app.message("hello", async ({ message, say }) => {
  await say(`RAWAWWW Slackzilla awakens... oh its just you, <@${message.user}>`);
    console.log(`received message event from user ${message.user}`);
})


// listenr, which responds to mentions
app.event('app_mention', async ({ event, say }) => {
    await say(`FOR THOUSANDS OF EONS, I WAS IN SLUMBER BELOW THE EARTH, WAITING FOR THE DAY I COULD RISE AGAIN AND DEVOUR THE WORLD! oh my god stop pinjing me <@${event.user}>`);
    console.log(`received app_mention event from user ${event.user}`);
})

// /sz-ping cmd - pongs  
app.command(cmds.ping, async ({ command, ack, respond }) => {
    await ack();
    await respond(`err wth am i doing here... who SUMMONED ME here, alright.... im a pinger. BING BONG - <@${command.user_id}>`);
    console.log(`received ${pre}ping command from user ${command.user_id}`); // hehe im tracking youuuu 👻
})

// start app
(async () => {
    await app.start(process.env.PORT || 3000);
    console.log('⚡️ bolt app is running!');
})()


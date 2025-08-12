const { WebClient } = require("@slack/web-api");

const SLACK_BOT_TOKEN = process.env.EDWARDS_SLACKBOT_DEV_SLACK_BOT_TOKEN;

const slack = new WebClient(SLACK_BOT_TOKEN);


exports.handler = async function(event) {
  // console.log('event', event)

  const params = new URLSearchParams(event.body);
  const command = params.get("command");
  console.log("Slash command:", command);

  await slack.chat.postMessage({
    channel: "co-working-room",
    text: `Hello from Netlify! You ran ${command}`
  });

  return {
    statusCode: 200,
    body: JSON.stringify({ received: command}),
  };
};

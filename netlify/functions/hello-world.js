const { WebClient } = require("@slack/web-api");

const SLACK_BOT_TOKEN = process.env.EDWARDS_SLACKBOT_DEV_SLACK_BOT_TOKEN;

const ZOOM_JOIN_URL = process.env.ZOOM_JOIN_URL;

const ZOOM_DESKTOP_APP_JOIN_URL = process.env.ZOOM_DESKTOP_APP_JOIN_URL;

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

  // Create a Slack call and post a call block
  const created = await slack.calls.add({
    title: "co-working-room",
    external_unique_id: "0xDEADBEEF",
    join_url: ZOOM_JOIN_URL,
    desktop_app_join_url: ZOOM_DESKTOP_APP_JOIN_URL,
  });

  const call_id = created?.call?.id;
  await slack.chat.postMessage({
    channel: 'co-working-room',
    blocks: [{ type: "call", call_id }],
  });

  return {
    statusCode: 200,
    body: JSON.stringify({ received: call_id}),
  };
};

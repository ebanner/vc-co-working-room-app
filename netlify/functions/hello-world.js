const { WebClient } = require("@slack/web-api");

const SLACK_BOT_TOKEN = process.env.EDWARDS_SLACKBOT_DEV_SLACK_BOT_TOKEN;

const ZOOM_JOIN_URL = process.env.ZOOM_JOIN_URL;

const ZOOM_DESKTOP_APP_JOIN_URL = process.env.ZOOM_DESKTOP_APP_JOIN_URL;

const CHANNEL_ID = process.env.CHANNEL_ID;

const CHANNEL_NAME = process.env.CHANNEL_NAME;

const slack = new WebClient(SLACK_BOT_TOKEN);


function parseBody(event) {
  let body = event.body || "";
  if (event.isBase64Encoded) body = Buffer.from(body, "base64").toString("utf8");
  const ct = (event.headers?.["content-type"] || event.headers?.["Content-Type"] || "").toLowerCase();

  if (ct.includes("application/json")) return body ? JSON.parse(body) : {};
  if (ct.includes("application/x-www-form-urlencoded")) {
    return Object.fromEntries(new URLSearchParams(body));
  }
  // try JSON, else return raw string
  try { return body ? JSON.parse(body) : {}; } catch { return { raw: body }; }
}


function handleValidation(zoomEvent) {
  const plainToken = zoomEvent?.payload?.plainToken || "";
  const encryptedToken = crypto
    .createHmac("sha256", ZOOM_WEBHOOK_SECRET_TOKEN)
    .update(plainToken)
    .digest("hex");
  return { plainToken, encryptedToken };
}


async function getCallIdFromChannel() {
  const resp = await slack.conversations.history({ channel: CHANNEL_ID, limit: 1 });
  const msg = resp?.messages?.[0];
  const block0 = msg?.blocks?.[0];
  // Slack “call” block may expose call_id directly or inside the block payload
  if (block0?.call_id) return block0.call_id;
  if (block0?.call?.v1?.id) return block0.call.v1.id;
  throw new Error("Could not determine current call_id from channel history.");
}


async function addParticipant(user) {
  const call_id = await getCallIdFromChannel();
  await slack.calls.participants.add({ id: call_id, users: [user] });
}


async function removeParticipant(user) {
  const call_id = await getCallIdFromChannel();
  await slack.calls.participants.remove({ id: call_id, users: [user] });
}


const ZOOM_USER_NAME_TO_SLACK_ID = {
  "Eddie B": "U04CYG7MEKB",
  "Edward Banner": "U05DEUP5P62",
};


function toSlackUser(zoomEvent) {
  const zoomName = zoomEvent?.payload?.object?.participant?.user_name;
  if (zoomName && ZOOM_USER_NAME_TO_SLACK_ID[zoomName]) {
    return { slack_id: ZOOM_USER_NAME_TO_SLACK_ID[zoomName] };
  }
  return {
    external_id: "zoom_user_id",
    display_name: zoomName || "Unknown Zoom User",
  };
}


exports.handler = async function(event) {
  // console.log('event', event)

  // Zoom webhooks
  const zoomEvent = parseBody(event);
  const zoomEventName = zoomEvent?.event;
  if (zoomEventName === "endpoint.url_validation") {
    return json(200, handleValidation(zoomEvent));
  }

  else if (zoomEventName === "meeting.participant_joined") {
    await addParticipant(toSlackUser(zoomEvent));
    return { statusCode: 204 };
  }

  else if (zoomEventName === "meeting.participant_left") {
    await removeParticipant(toSlackUser(zoomEvent));
    return { statusCode: 204 };
  }

  const params = new URLSearchParams(event.body);
  const command = params.get("command");
  console.log("Slash command:", command);

  await slack.chat.postMessage({
    channel: CHANNEL_NAME,
    text: `Hello from Netlify! You ran ${command}`
  });

  // Create a Slack call and post a call block
  const created = await slack.calls.add({
    title: CHANNEL_NAME,
    external_unique_id: "0xDEADBEEF",
    join_url: ZOOM_JOIN_URL,
    desktop_app_join_url: ZOOM_DESKTOP_APP_JOIN_URL,
  });

  const call_id = created?.call?.id;
  await slack.chat.postMessage({
    channel: CHANNEL_NAME,
    blocks: [{ type: "call", call_id }],
  });

  return {
    statusCode: 200,
    body: JSON.stringify({ received: call_id}),
  };
};

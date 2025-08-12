exports.handler = async function(event) {
  // console.log('event', event)

  const params = new URLSearchParams(event.body);
  const command = params.get("command");
  console.log("Slash command:", command);

  return {
    statusCode: 200,
    body: JSON.stringify({ received: command}),
  };
};

# vc-co-working-room-app

Virtual coffee #co-working-room zoom integration slackbot

## Request Bearer token

```
curl --request POST \
  --url "https://zoom.us/oauth/token?grant_type=account_credentials&account_id=YOUR_ACCOUNT_ID" \
  --header "Authorization: Basic $(echo -n 'YOUR_CLIENT_ID:YOUR_CLIENT_SECRET' | base64)" \
  --header "Content-Type: application/x-www-form-urlencoded"
```

https://developers.zoom.us/docs/integrations/oauth/

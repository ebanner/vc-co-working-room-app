import base64
import hashlib
import hmac
import json
import os
import urllib.parse

import boto3
from slack_sdk import WebClient

CHANNEL_ID = 'co-working-room'

s3 = boto3.client('s3')

BUCKET = 'storage9'

SLACK_BOT_TOKEN = os.environ['EDWARDS_SLACKBOT_DEV_SLACK_BOT_TOKEN']

slack_client = WebClient(SLACK_BOT_TOKEN)

ZOOM_WEBHOOK_SECRET_TOKEN = os.environ["ZOOM_WEBHOOK_SECRET_TOKEN"]

ZOOM_JOIN_URL = os.environ["ZOOM_JOIN_URL"]

ZOOM_DESKTOP_APP_JOIN_URL = os.environ["ZOOM_DESKTOP_APP_JOIN_URL"]


def put(key, value):
    s3.put_object(Bucket=BUCKET, Key=key, Body=value)


def get(key):
    """If there is no key entry then return None"""

    object = s3.get_object(Bucket=BUCKET, Key=key)

    value = object['Body'].read().decode('utf-8')
    return value


def is_slash_command(event):
    def get_body_dict(event):
        body_base64_encoded = event['body']
        body_bytes = base64.b64decode(body_base64_encoded)
        body_decoded = body_bytes.decode('utf-8')
        body_dict = dict(urllib.parse.parse_qsl(body_decoded))
        return body_dict

    if 'isBase64Encoded' not in event or not event['isBase64Encoded']:
        return False

    body_dict = get_body_dict(event)
    return body_dict['command'].startswith('/')


def handle_start_call():
    response = slack_client.calls_add(
        title='co-working-room',
        external_unique_id='0xDEADBEEF',
        join_url=ZOOM_JOIN_URL,
        desktop_app_join_url=ZOOM_DESKTOP_APP_JOIN_URL,
    )

    call_id = response.data['call']['id']

    put('co-working-room-call-id', call_id)

    response = slack_client.chat_postMessage(
        channel=CHANNEL_ID,
        blocks=[
            {
                'type': 'call',
                'call_id': call_id
            }
        ]
    )

    return call_id


def handle_validation(zoom_event):
    plain_token = zoom_event["payload"]["plainToken"]
    hash_for_validate = hmac.new(
        ZOOM_WEBHOOK_SECRET_TOKEN.encode('utf-8'),
        plain_token.encode('utf-8'),
        hashlib.sha256
    ).hexdigest()

    result = {
        "plainToken": plain_token,
        "encryptedToken": hash_for_validate
    }

    return result


def add_participant_to_call(user):
    call_id = get('co-working-room-call-id')
    response = slack_client.calls_participants_add(
        id=call_id,
        users=[user]
    )

    return response.data


def get_user(zoom_event):
    ZOOM_USER_NAME_TO_SLACK_ID = {
        "Eddie B": "U04CYG7MEKB",
        "Edward Banner": "U05DEUP5P62"
    }

    zoom_user_name = zoom_event["payload"]["object"]["participant"]["user_name"]

    if zoom_user_name in ZOOM_USER_NAME_TO_SLACK_ID:
        return {
            "slack_id": ZOOM_USER_NAME_TO_SLACK_ID[zoom_user_name],
        }
    else:
        return {
            "external_id": "zoom_user_id",
            "display_name": zoom_user_name,
        }


def handle_paticipantpant_joined(zoom_event):
    user = get_user(zoom_event)
    add_participant_to_call(user)


def remove_participant_from_call(user):
    call_id = get('co-working-room-call-id')
    response = slack_client.calls_participants_remove(
        id=call_id,
        users=[user]
    )

    return response.data


def handle_paticipantpant_left(event):
    user = get_user(event)
    remove_participant_from_call(user)


def lambda_handler(event, context):
    print("Called")

    if is_slash_command(event):
        call_id = handle_start_call()
        return call_id 

    zoom_event = json.loads(event["body"])
    print(json.dumps(zoom_event))
    zoom_event_name = zoom_event.get('event')
    if zoom_event_name == 'endpoint.url_validation':
        validated = handle_validation(zoom_event)
        return {
            "statusCode": 200,
            "body": json.dumps(validated)
        }

    elif zoom_event_name == 'meeting.participant_joined':
        handle_paticipantpant_joined(zoom_event)

    elif zoom_event_name == 'meeting.participant_left':
        handle_paticipantpant_left(zoom_event)

    return {
        'statusCode': 204
    }


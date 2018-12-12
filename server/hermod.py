#!/usr/bin/python3

import binascii
import json
import pysodium
from websocket_server import *

client_info = dict()

def verify_client(clientid, message):
    try:
        data = json.loads(message)

        idkey_base64 = data["idkey"]
        idkey = binascii.a2b_base64(idkey_base64)
        payload_str = data["payload"]
        payload_bytes = payload_str.encode("utf-8")
        sig_base64 = data["signature"]
        sig = binascii.a2b_base64(sig_base64)

        try:
          pysodium.crypto_sign_verify_detached(sig, payload_bytes, idkey)
        except ValueError:
          print("client", clientid, "bad signature")
          return False

        client_info.setdefault(clientid, set()).add(idkey_base64)
        return True
    except:
        print("client", clientid, "malformed message")
        return False

def advise_client_left(clientid, server):
    idkeys_base64 = client_info.get(clientid)
    if idkeys_base64 is not None:
        for idkey_base64 in idkeys_base64:
            messageobj = dict(advise_disconnect=idkey_base64)
            message = json.dumps(messageobj)
            try:
              server.send_message_to_all(message)
            except:
              print("ERROR")
            print("server said", message)

def new_client(client, server):
    clientid = client["id"]
    print("new client", clientid)

def client_left(client, server):
    clientid = client["id"]
    advise_client_left(clientid, server)
    try:
        del client_info[clientid]
    except KeyError:
        pass
    print("client", clientid, "left")

def message_received(client, server, message):
    clientid = client["id"]
    print("client", clientid, "said", message)
    ok = verify_client(clientid, message)
    if ok:
        try:
          server.send_message_to_all(message)
        except:
          print("ERROR")
    else:
        print("client", clientid, "message rejected");

s = WebsocketServer(port=8192, host="0.0.0.0")
s.set_fn_new_client(new_client)
s.set_fn_client_left(client_left)
s.set_fn_message_received(message_received)

try:
    s.run_forever()
except KeyboardInterrupt:
    messageobj = dict(advise_server_quit=True)
    message = json.dumps(messageobj)
    s.send_message_to_all(message)
    print("server said", message)

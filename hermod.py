#!/usr/bin/python3

from pubsub import pub
from websocket_server import *

class Client:
  pass

client_info = dict()

def new_client(client, server):
    clientid = client["id"]
    client_info[clientid] = Client()
    print("new client", clientid)

def client_left(client, server):
    clientid = client["id"]
    del client_info[clientid]
    print("client", clientid, "left")

def message_received(client, server, message):
    print("client", client["id"], "said", message)
    server.send_message_to_all(message)

s = WebsocketServer(port=8192, host="0.0.0.0")
s.set_fn_new_client(new_client)
s.set_fn_client_left(client_left)
s.set_fn_message_received(message_received)
s.run_forever()

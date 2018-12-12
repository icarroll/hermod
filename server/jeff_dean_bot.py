#!/usr/bin/python3

import binascii
import bs4
import datetime
import json
import pysodium
import random
import requests
import _thread
import time
import websocket

nickname = "Jeff Dean Facts Robot"
idkey,privkey = pysodium.crypto_sign_seed_keypair(pysodium.crypto_generichash(nickname.encode(), outlen=32))
idkey_base64 = binascii.b2a_base64(idkey).strip()

def create_message():
    text = random.choice(open("jeff_dean_facts.txt").readlines()).strip()
    return text

def doopen(ws):
    def GOGOGO(*args):
        while True:
            now = datetime.datetime.utcnow().replace(tzinfo=datetime.timezone.utc).isoformat()
            message = create_message()
            payloadobj = dict(timestamp=now, nickname=nickname, listen=["Robotville"], say={"Robotville":message})
            payload = json.dumps(payloadobj)
            payload_bytes = payload.encode("utf-8")
            sig = pysodium.crypto_sign_detached(payload_bytes, privkey)
            sig_base64 = binascii.b2a_base64(sig).strip()
            cmdobj = dict(idkey=idkey_base64.decode("utf-8"), payload=payload, signature=sig_base64.decode("utf-8"))
            cmd = json.dumps(cmdobj)
            cmd_bytes = cmd.encode("utf-8")
            ws.send(cmd_bytes)
            #print("sent", cmd_bytes)

            time.sleep(10 + random.expovariate(1/10))

    _thread.start_new_thread(GOGOGO, ())

def domsg(ws, msg):
    receive = json.loads(msg)
    if "who" in json.loads(receive["payload"]):
        now = datetime.datetime.utcnow().replace(tzinfo=datetime.timezone.utc).isoformat()
        payloadobj = dict(timestamp=now, nickname=nickname, listen=["Robotville"])
        payload = json.dumps(payloadobj)
        payload_bytes = payload.encode("utf-8")
        sig = pysodium.crypto_sign_detached(payload_bytes, privkey)
        sig_base64 = binascii.b2a_base64(sig).strip()
        cmdobj = dict(idkey=idkey_base64.decode("utf-8"), payload=payload, signature=sig_base64.decode("utf-8"))
        cmd = json.dumps(cmdobj)
        cmd_bytes = cmd.encode("utf-8")
        ws.send(cmd_bytes)

def doerr(ws, err):
    pass

def docls(ws):
    pass

ws = websocket.WebSocketApp("ws://ada.cs.pdx.edu:8192",
                            on_message=domsg,
                            on_error=doerr,
                            on_close=docls)
ws.on_open = doopen
ws.run_forever()

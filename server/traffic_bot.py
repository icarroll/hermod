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

CHANNEL = ""

nickname = "ROBOT " + random.choice(open("/usr/share/dict/words").read().split())
idkey,privkey = pysodium.crypto_sign_seed_keypair(pysodium.crypto_generichash(nickname.encode(), outlen=32))
idkey_base64 = binascii.b2a_base64(idkey).strip()
#print(idkey_base64, nickname)

'''
def try_to_verify(msg_bytes):
    msg = msg_bytes.decode("utf-8")
    msgobj = json.loads(msg)

    idkey_base64 = msgobj["idkey"]
    payload_str = msgobj["payload"]
    sig_base64 = msgobj["signature"]

    idkey = binascii.a2b_base64(idkey_base64)
    payload_bytes = payload_str.encode("utf-8")
    sig = binascii.a2b_base64(sig_base64)

    print("verify is", end=" ")
    print(pysodium.crypto_sign_verify_detached(sig, payload_bytes, idkey))
'''

def create_message():
    text = ""
    while not text:
      doc = requests.get("https://en.wikipedia.org/wiki/Special:Random")
      soup = bs4.BeautifulSoup(doc.content, features="html.parser")
      try:
          text = soup.find("p").get_text().strip()
      except:
          continue
    return text

def doopen(ws):
    def GOGOGO(*args):
        while True:
            now = datetime.datetime.utcnow().replace(tzinfo=datetime.timezone.utc).isoformat()
            message = create_message()
            payloadobj = dict(timestamp=now, nickname=nickname, listen=[CHANNEL], say={CHANNEL:message})
            payload = json.dumps(payloadobj)
            payload_bytes = payload.encode("utf-8")
            sig = pysodium.crypto_sign_detached(payload_bytes, privkey)
            sig_base64 = binascii.b2a_base64(sig).strip()
            cmdobj = dict(idkey=idkey_base64.decode("utf-8"), payload=payload, signature=sig_base64.decode("utf-8"))
            cmd = json.dumps(cmdobj)
            cmd_bytes = cmd.encode("utf-8")
            ws.send(cmd_bytes)
            #print("sent", cmd_bytes)

            time.sleep(15 + random.expovariate(1/10))

    _thread.start_new_thread(GOGOGO, ())

def domsg(ws, msg):
    receive = json.loads(msg)
    if "who" in json.loads(receive["payload"]):
        now = datetime.datetime.utcnow().replace(tzinfo=datetime.timezone.utc).isoformat()
        payloadobj = dict(timestamp=now, nickname=nickname, listen=[CHANNEL])
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
    #print("oops", err)

def docls(ws):
    pass
    #print("closed")

ws = websocket.WebSocketApp("ws://ada.cs.pdx.edu:8192",
                            on_message=domsg,
                            on_error=doerr,
                            on_close=docls)
ws.on_open = doopen
ws.run_forever()

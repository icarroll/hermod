function calculate() {
  app.idkey_state = "show";

  app.self_user.nickname = app.self_user.id_salt;

  seed = sodium.crypto_pwhash(32, app.self_user.password, sodium.crypto_generichash(16, app.self_user.id_salt), 12, 10000000, sodium.crypto_pwhash_ALG_ARGON2ID13)
  keypair = sodium.crypto_sign_seed_keypair(seed);
  app.self_user.privkey = keypair.privateKey;
  app.self_user.idkey = keypair.publicKey;

  update_icons();
  Vue.nextTick(function () {
    app.$refs.nickname.focus();
  });
}

function process_message(e) {
  var receive = JSON.parse(e.data);

  if ("advise_disconnect" in receive) {
    delete app.users[receive.advise_disconnect];
    app.checkusers(); //TODO only update the one client
    return;
  }

  if (! ("idkey" in receive)) {console.log("no idkey"); return;}
  var encidkey = receive.idkey;
  var decidkey = decode_base64(encidkey);

  if (! ("payload" in receive)) {console.log("no payload"); return;}
  var signature = decode_base64(receive.signature);
  if (! sodium.crypto_sign_verify_detached(signature, receive.payload, decidkey)) {console.log("didn't match") ; return;}
  var payload = JSON.parse(receive.payload);

  if (! ("timestamp" in payload)) {console.log("no timestamp"); return;}
  //TODO verify timestamp
  /*
  var then_t = moment(payload.timestamp);
  var now_t = moment().utc();
  console.log(then_t.format(), now_t.format(), now_t - then_t)
  */

  if (! (encidkey in app.users)) {
    //TODO recognize own idkey (?)
    app.users[encidkey] = {nickname: "", listening: [], idle: false};
    app.$forceUpdate();
    update_icons();
  }

  app.users[encidkey].lastseen = moment();

  if ("who" in payload) {
    // yes, reply to my own who
    app.lastwho = moment();
    Vue.nextTick(function () {
      console.log("got who, sending listen");
      app.send_listen();
    });
  }

  if ("listen" in payload) {
    //TODO sanity check payload.listen
    //TODO update channel member lists
    app.users[encidkey].listening = payload.listen;
    app.checkusers(); //TODO only update the one client
  }

  if ("nickname" in payload) {
    app.users[encidkey].nickname = payload.nickname;
  }

  if ("idle" in payload) {
    app.users[encidkey].idle = payload.idle;
  }

  if ("say" in payload) {
    app.users[encidkey].idle = false;
    for (var channel in payload.say) {
      item = {idkey: encidkey,
              nickname: app.users[encidkey].nickname,
              message: safelink(payload.say[channel]),
              timestamp: payload.timestamp};
      post_message(channel, item)
    }
  }
}

function connect(firsttime) {
  // app.websocket = new WebSocket("ws://" + window.location.host + ":8192" + window.location.pathname.substring(0, window.location.pathname.lastIndexOf("/")) + "/chatsock");
  // app.websocket = new WebSocket("ws://" + window.location.host + ":8192" + "/chatsock");
  app.sockstate = "connecting";

  app.websocket = new WebSocket("ws://ada.cs.pdx.edu:8192/")

  app.websocket.onmessage = process_message;

  app.websocket.onopen = function (e) {
    app.sockstate = "connected";
    app.state="chat";

    window.onbeforeunload = function() {return true;};
    if (firsttime) {app.join("");}
    app.send_who();

    app.checkusers();
  }

  app.websocket.onclose = function (e) {
    app.sockstate = "notconnected";

    setTimeout(() => connect(false), 5000);
  }
}

function encode_base64(text) {
  var code = btoa(String.fromCharCode(...text));
  return code;
}

function decode_base64(code) {
  var temp = atob(code);
  var text = new Uint8Array(temp.length);
  for (i=0; i<temp.length; i+=1) {text[i] = temp.charCodeAt(i);}
  return text
}

function join_channel(channel) {
  if (typeof channel != "string") {channel = "";}

  ix = app.mychannelnames.indexOf(channel);
  if (ix == -1) {
    if (channel === "") {
      app.mychannelnames.unshift(channel);
      app.chatlogs.unshift([]);
    }
    else {
      app.mychannelnames.push(channel);
      app.chatlogs.push([]);
    }

    console.log("joined channel, sending listen");
    app.send_listen();
  }

  app.focuschannel = channel;
  app.checkusers(); //TODO only update the one client
  inputfocus();
}

function leave_channel(channel) {
  ix = app.mychannelnames.indexOf(channel);
  if (ix != -1) {
    app.chatlogs.splice(ix, 1);
    app.mychannelnames.splice(ix, 1);

    console.log("left channel, sending listen");
    app.send_listen();
  }
  if (app.focuschannel === channel) {
    app.changechannel(0);
  }
  app.checkusers(); //TODO only update the one client
  inputfocus();
}

function post_message(channel, item) {
  ix = app.mychannelnames.indexOf(channel);
  if (ix != -1) {
    app.chatlogs[ix].push(item);

    update_icons();
    scrolldown();
  }
}

function safelink(text) {
  urlpat = /(https?:\/\/\S+)/;
  var parts = text.split(urlpat);

  var plaintext = parts.shift();
  var temp = document.createElement("span");
  temp.textContent = plaintext;
  safetext = temp.innerHTML;

  while (parts.length > 0) {
    var linktext = parts.shift();
    var temp = document.createElement("a");
    temp.href = linktext;
    temp.innerText = linktext;
    temp.target = "_blank";
    safetext += temp.outerHTML;

    var plaintext = parts.shift();
    var temp = document.createElement("span");
    temp.textContent = plaintext;
    safetext += temp.innerHTML;
  }

  return safetext;
}

function update_icons() {
  Vue.nextTick(function () {
    jdenticon.update("svg");
  });
}

function scrolldown() {
  Vue.nextTick(function () {
    logdivs = document.getElementsByClassName("chatlog");
    for (var i=0 ; i<logdivs.length ; i+=1) {
      logdivs[i].scrollTop = logdivs[i].scrollHeight;
    }
  });
}

function inputfocus() {
  //TODO allow copy-paste
  Vue.nextTick(function () {
    document.getElementById("input_text").focus();
  });
}

var app = new Vue({
  data: {
    idletimeout: 300000,   // 5 minutes in milliseconds
    timestampinterval: null,
    checkuserinterval: null,
    lastwho: moment(),
    lastsay: moment(),
    state: "login",
    sockstate: "notconnected",
    idkey_state: "hide",
    newdiv_state: "hide",
    websocket: null,
    self_user: {
      id_salt: "",
      password: "",
      privkey: "",
      idkey: "",
      nickname: "",
    },
    users: {},
    channelusers: {},
    mychannelnames: [],
    focuschannel: "",
    chatlogs: [],
    newchannelname: "",
    input: "",
    signsend: function (payloadobj) {
      var encidkey = encode_base64(this.self_user.idkey);
      var payload = JSON.stringify(payloadobj);
      var signatureobj = sodium.crypto_sign_detached(payload, this.self_user.privkey);
      var signature = encode_base64(signatureobj);
      var obj = {idkey: encidkey, payload: payload, signature: signature};
      this.websocket.send(JSON.stringify(obj));
    },
    send_say: function (e) {
      e.preventDefault();
      this.input = this.input.trim();
      if (this.input === "") {return;}

      this.lastsay = moment();
      var sayobj = {} ; sayobj[this.focuschannel] = this.input;
      var payloadobj = {timestamp: moment().utc().format(),
                        nickname: this.self_user.nickname,
                        idle: false,
                        say: sayobj};

      this.signsend(payloadobj);

      // TODO don't erase input box unless/until message sent
      this.input = "";
    },
    send_listen: function () {
      var payloadobj = {timestamp: moment().utc().format(),
                        nickname: this.self_user.nickname,
                        idle: moment() - this.lastsay > this.idletimeout,
                        listen: this.mychannelnames};
      this.signsend(payloadobj);
    },
    send_who: function () {
      var payloadobj = {timestamp: moment().utc().format(),
                        who: "*"};
      this.signsend(payloadobj);
    },
    changechannel: function (ix) {
      if (document.getSelection().toString() != "") {return;}

      this.checkusers();
      app.focuschannel = app.mychannelnames[ix];
      inputfocus();
    },
    join: function (channel) {
      join_channel(channel);
    },
    leave: function (channel, e) {
      e.stopPropagation();
      leave_channel(channel);
    },
    shownewdiv: function() {
      this.newdiv_state = "show";
      Vue.nextTick(function () {
        app.$refs.newname.focus();
      });
    },
    hidenewdiv: function() {
      this.newchannelname = "";
      this.newdiv_state = "hide";
      inputfocus();
    },
    newchannel: function() {
      this.join(this.newchannelname);
      this.newchannelname = "";
      this.newdiv_state = "hide";
    },
    checkusers: function() {
      var now = moment();
      this.channelusers = {};

      // record my own channels
      var listening = this.self_user.mychannelnames;
      for (var ix in listening) {
        if (! (listening[ix] in this.channelusers)) {
          Vue.set(this.channelusers, listening[ix], {});
        }
        Vue.set(this.channelusers[listening[ix]], this.idkey_base64, true);
      }

      for (var youridkey in this.users) {
        var user = this.users[youridkey];
        if (youridkey != this.idkey_base64) {
          // checking someone else, not me
          if (now - user.lastseen > 120000) {
            // no word for 2 minutes, they're gone
            delete this.users[youridkey];
            continue;
          }
        }

        // if user is still around, record channel membership
        var listening = this.users[youridkey].listening;
        for (var ix in listening) {
          if (! (listening[ix] in this.channelusers)) {
            Vue.set(this.channelusers, listening[ix], {});
          }
          Vue.set(this.channelusers[listening[ix]], youridkey, true);
        }
      }

      this.$forceUpdate();
      update_icons();

      if (moment() - this.lastwho > 60000) {
        Vue.nextTick(function () {
          app.send_who();
        });
        this.lastwho = moment();
      }
    },
  },
  created: function () {
    this.timestampinterval = setInterval(() => this.$forceUpdate(), 60000);
    this.checkuserinterval = setInterval(() => this.checkusers(), 10000);
  },
  mounted: function () {
    this.$refs.id_salt.focus();
  },
  beforeDestroy() {
    clearInterval(this.timestampinterval);
    clearInterval(this.checkuserinterval);
  },
  computed: {
    sockstatecolor: function () {
      switch (this.sockstate) {
        case "notconnected":
          return "red";
          break;
        case "connecting":
          return "blue";
          break;
        case "connected":
          return "green";
          break;
        default:
          return "red";
          break;
      }
    },
    sockstatetext: function () {
      switch (this.sockstate) {
        case "notconnected":
          return "Not Connected";
          break;
        case "connecting":
          return "Connecting...";
          break;
        case "connected":
          return "Connected";
          break;
        default:
          return "ERROR";
          break;
      }
    },
    idkey_base64: function () {
      return encode_base64(this.self_user.idkey);
    },
    crack_time: function () {
      return zxcvbn(this.self_user.password).crack_times_display.offline_slow_hashing_1e4_per_second;
    },
    sorted_channel_users: function () {
      if (! (this.focuschannel in this.channelusers)) {return new Array();}

      var temp = Object.keys(this.channelusers[this.focuschannel]);
      temp.sort();
      return temp;
    },
    sorted_channels: function () {
      var temp = Object.keys(this.channelusers);
      temp.sort();
      return temp;
    },
  },
  filters: {
    fromNow(date) {
      return moment(date).fromNow();
    },
  },
});

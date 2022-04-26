import utils from "./utils.js";

window.addEventListener("load", () => {
  const room = utils.getQString(location.href, "room");
  const username = sessionStorage.getItem("username");

  if (!room) {
    document.querySelector("#room-create").attributes.removeNamedItem("hidden");
  } else if (!username) {
    document
      .querySelector("#username-set")
      .attributes.removeNamedItem("hidden");
  } else {
    let commElem = document.getElementsByClassName("room-comm");

    for (let i = 0; i < commElem.length; i++) {
      commElem[i].attributes.removeNamedItem("hidden");
    }

    var pc = [];

    let socket = io("/stream");

    var socketId = "";
    var randomNumber = `__${utils.generateRandomString()}__${utils.generateRandomString()}__`;
    var myStream = "";
    var screen = "";

    //Get user video by default
    getAndSetUserStream();

    socket.on("connect", () => {
      //set socketId
      socketId = socket.io.engine.id;
      document.getElementById("randomNumber").innerText = randomNumber;

      socket.emit("subscribe", {
        room: room,
        socketId: socketId,
      });

      socket.on("new user", (data) => {
        socket.emit("newUserStart", { to: data.socketId, sender: socketId });
        pc.push(data.socketId);
        init(true, data.socketId);
      });

      socket.on("newUserStart", (data) => {
        pc.push(data.sender);
        init(false, data.sender);
      });

      socket.on("ice candidates", async (data) => {
        data.candidate
          ? await pc[data.sender].addIceCandidate(
              new RTCIceCandidate(data.candidate)
            )
          : "";
      });

      socket.on("sdp", async (data) => {
        if (data.description.type === "offer") {
          data.description
            ? await pc[data.sender].setRemoteDescription(
                new RTCSessionDescription(data.description)
              )
            : "";

          utils
            .getUserFullMedia()
            .then(async (stream) => {
              if (!document.getElementById("local").srcObject) {
                utils.setLocalStream(stream);
              }

              //save my stream
              myStream = stream;

              stream.getTracks().forEach((track) => {
                pc[data.sender].addTrack(track, stream);
              });

              let answer = await pc[data.sender].createAnswer();

              await pc[data.sender].setLocalDescription(answer);

              socket.emit("sdp", {
                description: pc[data.sender].localDescription,
                to: data.sender,
                sender: socketId,
              });
            })
            .catch((e) => {
              console.error(e);
            });
        } else if (data.description.type === "answer") {
          await pc[data.sender].setRemoteDescription(
            new RTCSessionDescription(data.description)
          );
        }
      });

      socket.on("chat", (data) => {
        utils.addChat(data, "remote");
      });
    });

    function getAndSetUserStream() {
      utils
        .getUserFullMedia()
        .then((stream) => {
          //save my stream
          myStream = stream;

          utils.setLocalStream(stream);
        })
        .catch((e) => {
          console.error(`stream error: ${e}`);
        });
    }

    function sendMsg(msg) {
      let data = {
        room: room,
        msg: msg,
        sender: `${username} (${randomNumber})`,
      };

      //emit chat message
      socket.emit("chat", data);

      //add localchat
      utils.addChat(data, "local");
    }

    function init(createOffer, partnerName) {
      pc[partnerName] = new RTCPeerConnection(utils.getIceServer());

      if (screen && screen.getTracks().length) {
        screen.getTracks().forEach((track) => {
          pc[partnerName].addTrack(track, screen); //should trigger negotiationneeded event
        });
      } else if (myStream) {
        myStream.getTracks().forEach((track) => {
          pc[partnerName].addTrack(track, myStream); //should trigger negotiationneeded event
        });
      } else {
        utils
          .getUserFullMedia()
          .then((stream) => {
            //save my stream
            myStream = stream;

            stream.getTracks().forEach((track) => {
              pc[partnerName].addTrack(track, stream); //should trigger negotiationneeded event
            });

            utils.setLocalStream(stream);
          })
          .catch((e) => {
            console.error(`stream error: ${e}`);
          });
      }

      //create offer
      if (createOffer) {
        pc[partnerName].onnegotiationneeded = async () => {
          let offer = await pc[partnerName].createOffer();

          await pc[partnerName].setLocalDescription(offer);

          socket.emit("sdp", {
            description: pc[partnerName].localDescription,
            to: partnerName,
            sender: socketId,
          });
        };
      }

      //send ice candidate to partnerNames
      pc[partnerName].onicecandidate = ({ candidate }) => {
        socket.emit("ice candidates", {
          candidate: candidate,
          to: partnerName,
          sender: socketId,
        });
      };

      //add
      pc[partnerName].ontrack = (e) => {
        let str = e.streams[0];
        if (document.getElementById(`${partnerName}-video`)) {
          document.getElementById(`${partnerName}-video`).srcObject = str;
        } else {
          //video elem
          let newVid = document.createElement("video");
          newVid.id = `${partnerName}-video`;
          newVid.srcObject = str;
          newVid.autoplay = true;
          newVid.className = "remote-video";

          //video controls elements
          let controlDiv = document.createElement("div");
          controlDiv.className = "remote-video-controls";
          controlDiv.innerHTML = `<i class="fa fa-microphone text-white pr-3 mute-remote-mic" title="Mute"></i>
                        <i class="fa fa-expand text-white expand-remote-video" title="Expand"></i>`;

          //create a new div for card
          let cardDiv = document.createElement("div");
          cardDiv.className = "card card-sm";
          cardDiv.id = partnerName;
          cardDiv.appendChild(newVid);
          cardDiv.appendChild(controlDiv);

          //put div in main-section elem
          document.getElementById("videos").appendChild(cardDiv);

          utils.adjustVideoElemSize();
        }
      };

      pc[partnerName].onconnectionstatechange = (d) => {
        switch (pc[partnerName].iceConnectionState) {
          case "disconnected":
          case "failed":
            utils.closeVideo(partnerName);
            break;

          case "closed":
            utils.closeVideo(partnerName);
            break;
        }
      };

      pc[partnerName].onsignalingstatechange = (d) => {
        switch (pc[partnerName].signalingState) {
          case "closed":
            console.log("Signalling state is 'closed'");
            utils.closeVideo(partnerName);
            break;
        }
      };
    }

    function shareScreen() {
      utils
        .shareScreen()
        .then((stream) => {
          utils.toggleShareIcons(true);

          //disable the video toggle btns while sharing screen. This is to ensure clicking on the btn does not interfere with the screen sharing
          //It will be enabled was user stopped sharing screen
          utils.toggleVideoBtnDisabled(true);

          //save my screen stream
          screen = stream;

          //share the new stream with all partners
          broadcastNewTracks(stream, "video", false);

          //When the stop sharing button shown by the browser is clicked
          screen.getVideoTracks()[0].addEventListener("ended", () => {
            stopSharingScreen();
          });
        })
        .catch((e) => {
          console.error(e);
        });
    }

    function stopSharingScreen() {
      //enable video toggle btn
      utils.toggleVideoBtnDisabled(false);

      return new Promise((res, rej) => {
        screen.getTracks().length
          ? screen.getTracks().forEach((track) => track.stop())
          : "";

        res();
      })
        .then(() => {
          utils.toggleShareIcons(false);
          broadcastNewTracks(myStream, "video");
        })
        .catch((e) => {
          console.error(e);
        });
    }

    function broadcastNewTracks(stream, type, mirrorMode = true) {
      utils.setLocalStream(stream, mirrorMode);

      let track =
        type == "audio"
          ? stream.getAudioTracks()[0]
          : stream.getVideoTracks()[0];

      for (let p in pc) {
        let pName = pc[p];

        if (typeof pc[pName] == "object") {
          utils.replaceTrack(track, pc[pName]);
        }
      }
    }

    document.getElementById("chat-input-btn").addEventListener("click", (e) => {
      console.log("here: ", document.getElementById("chat-input").value);
      if (document.getElementById("chat-input").value.trim()) {
        sendMsg(document.getElementById("chat-input").value);

        setTimeout(() => {
          document.getElementById("chat-input").value = "";
        }, 50);
      }
    });

    //Chat textarea
    document.getElementById("chat-input").addEventListener("keypress", (e) => {
      if (e.which === 13 && e.target.value.trim()) {
        e.preventDefault();

        sendMsg(e.target.value);

        setTimeout(() => {
          e.target.value = "";
        }, 50);
      }
    });

    // Camera icon
    document.getElementById("toggle-video").addEventListener("click", (e) => {
      e.preventDefault();

      let elem = document.getElementById("toggle-video");

      if (myStream.getVideoTracks()[0].enabled) {
        e.target.classList.remove("fa-video");
        e.target.classList.add("fa-video-slash");
        elem.setAttribute("title", "Share Video");

        myStream.getVideoTracks()[0].enabled = false;
      } else {
        e.target.classList.remove("fa-video-slash");
        e.target.classList.add("fa-video");
        elem.setAttribute("title", "Hide Video");

        myStream.getVideoTracks()[0].enabled = true;
      }

      broadcastNewTracks(myStream, "video");
    });

    // mute icon
    document.getElementById("toggle-mute").addEventListener("click", (e) => {
      e.preventDefault();

      let elem = document.getElementById("toggle-mute");

      if (myStream.getAudioTracks()[0].enabled) {
        e.target.classList.remove("fa-microphone-alt");
        e.target.classList.add("fa-microphone-alt-slash");
        elem.setAttribute("title", "Unmute");

        myStream.getAudioTracks()[0].enabled = false;
      } else {
        e.target.classList.remove("fa-microphone-alt-slash");
        e.target.classList.add("fa-microphone-alt");
        elem.setAttribute("title", "Mute");

        myStream.getAudioTracks()[0].enabled = true;
      }

      broadcastNewTracks(myStream, "audio");
    });

    //When user clicks the 'Share screen' button
    document.getElementById("share-screen").addEventListener("click", (e) => {
      e.preventDefault();

      if (
        screen &&
        screen.getVideoTracks().length &&
        screen.getVideoTracks()[0].readyState != "ended"
      ) {
        stopSharingScreen();
      } else {
        shareScreen();
      }
    });
  }
});

import utils from "./utils.js";

window.addEventListener("load", () => {
  // open chatbox by clicking the chat icon
  document.querySelector("#toggle-chat-pane").addEventListener("click", (e) => {
    let chatElem = document.querySelector("#chat-pane");
    let mainSecElem = document.querySelector("#main-section");

    if (chatElem.classList.contains("chat-opened")) {
      chatElem.setAttribute("hidden", true);
      mainSecElem.classList.remove("col-md-9");
      mainSecElem.classList.add("col-md-12");
      chatElem.classList.remove("chat-opened");
    } else {
      chatElem.attributes.removeNamedItem("hidden");
      mainSecElem.classList.remove("col-md-12");
      mainSecElem.classList.add("col-md-9");
      chatElem.classList.add("chat-opened");
    }

    // Remove the notification in chatbox icon when it is clicked
    setTimeout(() => {
      if (
        document.querySelector("#chat-pane").classList.contains("chat-opened")
      ) {
        utils.toggleChatNotificationBadge();
      }
    }, 300);
  });

  //Enable picture-in-picture when clicking in the video frame
  document.getElementById("local").addEventListener("click", () => {
    if (!document.pictureInPictureElement) {
      document
        .getElementById("local")
        .requestPictureInPicture()
        .catch((error) => {
          // Video failed to enter Picture-in-Picture mode.
          console.error(error);
        });
    } else {
      document.exitPictureInPicture().catch((error) => {
        // Video failed to leave Picture-in-Picture mode.
        console.error(error);
      });
    }
  });

  //Main page -- create room button
  document.getElementById("create-room").addEventListener("click", (e) => {
    e.preventDefault();

    let roomName = document.querySelector("#room-name").value;
    let yourName = document.querySelector("#your-name").value;

    if (roomName && yourName) {
      //remove error message, if any
      document.querySelector("#err-msg").innerText = "";

      //save the user's name in sessionStorage
      sessionStorage.setItem("username", yourName);

      //create room link
      let roomLink = `${location.origin}?room=${roomName
        .trim()
        .replace(" ", "_")}_${utils.generateRandomString()}`;

      //Showing message after creating a room
      document.querySelector(
        "#room-created"
      ).innerHTML = `Congratulation. Room successfully created. <a href='${roomLink}'>Here</a> is the link to your room.
          <br>
          Don't forget to invite your friend to join in by this link. `;

      //Set the field emtpy after creating room sucessfully
      document.querySelector("#room-name").value = "";
      document.querySelector("#your-name").value = "";
    } else {
      document.querySelector("#err-msg").innerText = "All fields are required";
    }
  });

  //other join with the link --> Enter Room button
  document.getElementById("enter-room").addEventListener("click", (e) => {
    e.preventDefault();

    let name = document.querySelector("#username").value;

    if (name) {
      //remove error message, if any
      document.querySelector("#err-msg-username").innerText = "";

      //save the user's name in sessionStorage
      sessionStorage.setItem("username", name);

      //reload room
      location.reload();
    } else {
      document.querySelector("#err-msg-username").innerText =
        "Please enter your name";
    }
  });

  document.addEventListener("click", (e) => {
    if (e.target && e.target.classList.contains("expand-remote-video")) {
      utils.maximiseStream(e);
    } else if (e.target && e.target.classList.contains("mute-remote-mic")) {
      utils.singleStreamToggleMute(e);
    }
  });
});

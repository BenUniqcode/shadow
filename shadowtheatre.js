/*
 * Shadow Theatre Joystick Controller
 * Written in 2023 by Ben Wheeler <ben@uniqcode.com>
 * based on
 * Gamepad API Test
 * Written in 2013 by Ted Mielczarek <ted@mielczarek.org>
 *
 * To the extent possible under law, the author(s) have dedicated all copyright and related and neighboring rights to this software to the public domain worldwide. This software is distributed without any warranty.
 *
 * You should have received a copy of the CC0 Public Domain Dedication along with this software. If not, see <http://creativecommons.org/publicdomain/zero/1.0/>.
 */
// Meaning of button input numbers (i.e. which thing is plugged into which input on the controller PCB)
const RED = 0;
const GREEN = 1;
const LEFT = 2;
const RIGHT = 3;
const UP = 4;
const DOWN = 5;
const SCROLLSPEED_MIN = 1;
const SCROLLSPEED_MAX = 100;

var isOn = {}; // Map of button input number to true/false
var autoScroll = 0;
var scrollSpeed = 5;
var sliderPos = 0;

var haveEvents = 'GamepadEvent' in window;
var haveWebkitEvents = 'WebKitGamepadEvent' in window;
var controller;

var elDbg = document.getElementById("debug");

var dbg = function(str) {
	elDbg.innerHTML = str;
};

var rAF = /*window.mozRequestAnimationFrame ||
  window.webkitRequestAnimationFrame || */
  window.requestAnimationFrame;

function connecthandler(e) {
  console.log("Connected");
  console.log(e.gamepad);
  controller = e.gamepad;
  document.getElementById("startmsg").classList.add("hide");
  rAF(updateStatus);
}

function disconnecthandler(e) {
  console.log("Disconnected");
  controller = null;
  document.getElementById("startmsg").classList.remove("hide");
}

function updateStatus() {
  console.log("updateStatus");
  const gamepads = navigator.getGamepads();
  controller = gamepads[0];

  if (! controller) {
    dbg("No controller");
    rAF(updateStatus);
    return;
  }
  // Due to inconsistencies in the way different browsers report axes, 
  // plus the fact they are analogue numbers when our joystick is a simple on/off microswitch for each direction
  // we use button inputs for the joystick instead of axes.
  // The first two buttons (0 and 1) are the actual buttons. The next four are the L, R, U, D.
  var dbgbutt = "";
  var anyButtonOn = false; // Are either of the actual buttons being pressed?
  for (var i = 0; i < controller.buttons.length; i++) {
    var isPressed = false, isTouched = false; // Is this button pressed/touched
    var val = controller.buttons[i];
    if (typeof(val) == "object") {
      isPressed = val.pressed;
      if ('touched' in val) {
        isTouched |= val.touched;
      }
    } else {
      isPressed = val == 1.0;
    }
    dbgbutt += i + ": " + (isPressed ? "pressed " : "") + (isTouched ? "touched" : "") + "<br>";
    isOn[i] = isPressed | isTouched;
    // If it's an actual button, update whether anyButton
    if (i == RED || i == GREEN) {
      anyButtonOn |= isOn[i];
    }
  }
  if (anyButtonOn) {
    document.getElementById("buttonPressed").classList.remove("hide");
  } else {
    document.getElementById("buttonPressed").classList.add("hide");
  }

  // Handle autoscroll buttons
  if (isOn[GREEN]) {
    if (isOn[LEFT]) {
      autoScroll = LEFT;
    } else if (isOn[RIGHT]) {
      autoScroll = RIGHT;
    }
  }
  if (isOn[RED]) {
    autoScroll = 0;
  }
  dbgbutt += "ScrollSpeed: " + scrollSpeed;
  dbgbutt += "<br>AutoScroll: " + autoScroll;

  // Output the debug messages
  dbg(dbgbutt);

  // Handle up/down to change scroll speed
  if (isOn[UP]) {
    scrollSpeed++;
    if (scrollSpeed > SCROLLSPEED_MAX) {
      scrollSpeed = SCROLLSPEED_MAX;
    }
  } else if (isOn[DOWN]) {
    scrollSpeed--;
    if (scrollSpeed < SCROLLSPEED_MIN) {
      scrollSpeed = SCROLLSPEED_MIN;
    }
  }

  // Handle left/right movement
  if (isOn[LEFT] || autoScroll == LEFT) {
    // Left
    sliderPos -= scrollSpeed;
    if (sliderPos < 0) {
      sliderPos = 0; // Don't go past the left edge
      autoScroll = 0; // Switch off autoscroll at the edge
    }
    window.scroll(sliderPos,0);
  } else if (isOn[RIGHT] || autoScroll == RIGHT) {
    // Right
    sliderPos += scrollSpeed;
    var maxScroll = document.body.scrollWidth - document.body.clientWidth;
    if (sliderPos > maxScroll) {
      sliderPos = maxScroll; // Don't go past the right edge
      autoScroll = 0; // Switch off autoscroll at the edge
    }
    window.scroll(sliderPos,0);
  }
  rAF(updateStatus);
}

function scangamepads() {
  var gamepads = navigator.getGamepads ? navigator.getGamepads() : (navigator.webkitGetGamepads ? navigator.webkitGetGamepads() : []);
  if (gamepads.length) {
    controller = gamepads[0];
  }
}

if (haveEvents) {
  console.log("Adding events");
  window.addEventListener("gamepadconnected", connecthandler);
  window.addEventListener("gamepaddisconnected", disconnecthandler);
} else if (haveWebkitEvents) {
  console.log("Adding WebKit events");
  window.addEventListener("webkitgamepadconnected", connecthandler);
  window.addEventListener("webkitgamepaddisconnected", disconnecthandler);
} else {
  console.log("Scanning for gamepads");
  setInterval(scangamepads, 500);
}

dbg("Loaded");


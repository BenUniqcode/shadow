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
var haveEvents = 'GamepadEvent' in window;
var haveWebkitEvents = 'WebKitGamepadEvent' in window;
var controller;
var sliderPos = 0;
var scrollSpeed = 5;

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
  const gamepads = navigator.getGamepads();
  controller = gamepads[0];

  if (! controller) {
    dbg("No controller");
    rAF(updateStatus);
    return;
  }
  var dbgbutt = "";
  var anyPressed = false, anyTouched = false; // Is any button pressed/touched
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
    dbgbutt += "<br>" + i + ": " + val + " " + (isPressed ? "pressed " : "") + (isTouched ? "touched" : "");
    anyPressed |= isPressed;
    anyTouched |= isTouched;
  }
  if (anyPressed || anyTouched) {
    document.getElementById("buttonPressed").classList.remove("hide");
  } else {
    document.getElementById("buttonPressed").classList.add("hide");
  }

  // console.log('Axis 1: ' + controller.axes[1] + ' / Axis 2: ' + controller.axes[2]);
  // We are using a simple microswitch joystick - there's no intermediate analogue values, each switch is either on or off.
  // Axis 1 is horizontal. Left is -1, Right is +1
  // Axis 2 is vertical. Up is -1, Down is +1
  // When the joystick returns to centre on an axis, the reading is close to, but not equal to, zero. In fact it's always -0.0039215686274509665
  // I don't know why. But clearly we need to trim the precision.
  var axis1 = controller.axes[1].toFixed(1);
  var axis2 = controller.axes[2].toFixed(1);
  var dbgaxes = "";
  for (var i = 0; i < controller.axes.length; i++) {
    dbgaxes += "<br>" + i + ": " + controller.axes[i];
  }
  dbg('Axes: ' + dbgaxes + '<br>Buttons: ' + dbgbutt + '<br>Timestamp: ' + Date.now());
  // Handle left/right movement
  if (axis1 < -0.5) {
    // Left
    console.log("Left");
    sliderPos -= scrollSpeed; 
    if (sliderPos < 0) {
      sliderPos = 0; // Don't go past the left edge
    }
    window.scroll(sliderPos,0);
  } else if (axis1 > 0.5) {
    // Right
    console.log("Right");
    sliderPos += scrollSpeed; 
    var maxScroll = document.body.scrollWidth - document.body.clientWidth;
    if (sliderPos > maxScroll) {
      sliderPos = maxScroll; // Don't go past the right edge
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


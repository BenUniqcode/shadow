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

var rAF = window.mozRequestAnimationFrame ||
  window.webkitRequestAnimationFrame ||
  window.requestAnimationFrame;

function connecthandler(e) {
  controller = e.gamepad;
  document.getElementById("startmsg").classList.add("hide");
  rAF(updateStatus);
}

function disconnecthandler(e) {
  controller = null;
  document.getElementById("startmsg").classList.remove("hide");
}

function updateStatus() {
  if (controller) {
    console.log("updateStatus");
    // There are 2 buttons. For our purposes pressing either (or both of them) does the same thing.
    var pressed = false, touched = false;
    for (var i=0; i<2; i++) {
      var val = controller.buttons[i];
      pressed |= val == 1.0;
      if (typeof(val) == "object") {
        pressed |= val.pressed;
        if ('touched' in val) {
          touched |= val.touched;
        }
      }
    }
    if (pressed || touched) {
      console.log('Button Press');
      document.getElementById("buttonPressed").classList.remove("hide");
    } else {
      console.log('Button Release');
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
    console.log('Axis 1: ' + axis1 + ' / Axis 2: ' + axis2);
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
  window.addEventListener("gamepadconnected", connecthandler);
  window.addEventListener("gamepaddisconnected", disconnecthandler);
} else if (haveWebkitEvents) {
  window.addEventListener("webkitgamepadconnected", connecthandler);
  window.addEventListener("webkitgamepaddisconnected", disconnecthandler);
} else {
  setInterval(scangamepads, 500);
}

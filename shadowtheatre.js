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
const KEYMAP = { // Keyboard control mapping to joystick equivalents
  ArrowUp: UP,
  ArrowDown: DOWN,
  ArrowLeft: LEFT,
  ArrowRight: RIGHT,
  Digit1: RED,
  Digit2: GREEN,
};

var isOn = {}; // Map of button input number to true/false
var autoScroll = 0;
var scrollSpeed = 4;
var sliderPos = 0;
var scrollSpeedLimiter = false; // Is set to true when the scroll speed changes, which blocks further changes for a while, to reduce the speed at which it was changing
var raftimer;
var fader;

var haveEvents = 'GamepadEvent' in window;
var haveWebkitEvents = 'WebKitGamepadEvent' in window;
var controller;

var dbgout = "";
var elDbg = document.getElementById("debug");

var dbg = function(str) {
	// elDbg.innerHTML = str;
};

var rAF = window.requestAnimationFrame;

function connecthandler(e) {
  console.log("Connected");
  console.log(e.gamepad);
  controller = e.gamepad;
  rAF(readGamepad);
}

function disconnecthandler(e) {
  console.log("Disconnected");
  controller = null;
}

function readGamepad() {
  dbgout = "";
  console.log("readGamepad");
  const gamepads = navigator.getGamepads();
  controller = gamepads[0];

  if (! controller || ! controller.buttons.length) {
    dbg("No controller");
    return;
  }
  console.log("Found gamepad with ${controller.buttons.length} buttons");

  // Due to inconsistencies in the way different browsers report axes, 
  // plus the fact they are analogue numbers when our joystick is a simple on/off microswitch for each direction
  // we use button inputs for the joystick instead of axes.
  // The first two buttons (0 and 1) are the actual buttons. The next four are the L, R, U, D.
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
    dbgout += i + ": " + (isPressed ? "pressed " : "") + (isTouched ? "touched" : "") + "<br>";
    isOn[i] = isPressed | isTouched;
    // If it's an actual button, update whether anyButton
    if (i == RED || i == GREEN) {
      anyButtonOn |= isOn[i];
    }
  }

  processActions(false);
  rAF(readGamepad);
}

function keydown(e) {
  if (e.code in KEYMAP) {
    e.preventDefault();
    if (e.repeat) {
      return;
    }
    isOn[KEYMAP[e.code]] = true;
    rAF(processActions);
  }
}

function keyup(e) {
  if (e.repeat) {
    return;
  }
  if (e.code in KEYMAP) {
    e.preventDefault();
    if (e.repeat) {
      return;
    }
    isOn[KEYMAP[e.code]] = false;
    rAF(processActions);
  }
}

function processActions(raf=true) {  

  // Handle up/down to change scroll speed
  var scrollSpeedChanged = false;
  if (isOn[UP] && !scrollSpeedLimiter) {
    scrollSpeedChanged = true;
    scrollSpeed++;
    if (scrollSpeed > SCROLLSPEED_MAX) {
      scrollSpeed = SCROLLSPEED_MAX;
    }
  } else if (isOn[DOWN] && !scrollSpeedLimiter) {
    scrollSpeedChanged = true;
    scrollSpeed--;
    if (scrollSpeed < SCROLLSPEED_MIN) {
      scrollSpeed = SCROLLSPEED_MIN;
    }
    // Limit how fast the scroll speed changes
    scrollSpeedLimiter = true;
    setTimeout(function() {
      scrollSpeedLimiter = false;
    }, 100);
  }
  if (scrollSpeedChanged) {
    // Limit how fast the scroll speed changes
    scrollSpeedLimiter = true;
    setTimeout(function() {
      scrollSpeedLimiter = false;
    }, 100);
    // Show the hud (if it's not already showing)
    var hud = document.getElementById("hud");
    hud.innerHTML = "Scroll Speed: " + scrollSpeed;
    hud.classList.add("visible");
    // Start fading the hud after a bit, first resetting the timer if already running
    clearTimeout(fader);
    fader = setTimeout(function() {
  	hud.classList.remove("visible");
    }, 700);
  }

  dbgout = "";
  dbgout += "<br>ScrollSpeed: " + scrollSpeed;
  dbgout += "<br>AutoScroll: " + autoScroll;

  // Output the debug messages
  dbg(dbgout);

  // Handle left/right movement
  if (isOn[LEFT] || isOn[RED] || autoScroll == LEFT) {
    // Left
    sliderPos -= scrollSpeed;
    if (sliderPos < 0) {
      sliderPos = 0; // Don't go past the left edge
      autoScroll = 0; // Switch off autoscroll at the edge
    }
    window.scroll(sliderPos,0);
  } else if (isOn[RIGHT] || isOn[GREEN] || autoScroll == RIGHT) {
    // Right
    sliderPos += scrollSpeed;
    var maxScroll = document.body.scrollWidth - document.body.clientWidth;
    if (sliderPos > maxScroll) {
      sliderPos = maxScroll; // Don't go past the right edge
      autoScroll = 0; // Switch off autoscroll at the edge
    }
    window.scroll(sliderPos,0);
  }
  // If using only keyboard control, we need to loop this function, but 
  // not immediately or it's much faster than joystick control
  if (raf) {
    clearTimeout(raftimer);
    raftimer = setTimeout(function() {
      rAF(processActions);
    }, 50); // It loops too fast otherwise
  }
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

// Also allow keyboard control. Left and right cursors would work anyway but
// at a completely different speed than the joystick, and we also want up
// and down, and the two buttons (assigned to 1 and 2). Key events are only
// generated by form input and textarea fields, so we need a hidden one and
// it must have focus.
window.addEventListener("keydown", keydown);
window.addEventListener("keyup", keyup);
document.getElementById("keyinput").focus();

dbg("Loaded");


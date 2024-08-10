/*
 * Shadow Theatre Joystick Controller
 * Written 2023-2024 by Ben Wheeler <ben@uniqcode.com>
 * with some hints from
 * Gamepad API Test
 * Written in 2013 by Ted Mielczarek <ted@mielczarek.org>
 */
// Meaning of button input numbers (i.e. which thing is plugged into which input on the controller PCB)
const NUM_INPUTS = 6;
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
const KONAMI_CODE = [UP, UP, DOWN, DOWN, LEFT, RIGHT, LEFT, RIGHT, GREEN, RED];

const SCROLL_ANIMATION_OPTIONS = {
	    duration: 200,
	    fill: 'forwards', // Stay in the final position instead of springing back
};

// These are the horizontal positions on the base level from where we can go up (1) or down (-1) a level, or both (0).
// If our position is within a certain distance of such a place, the arrow will appear and going up/down is allowed.
const TRANSITION_POINTS = [
	[1300, -1],
	[6325, 0],
	[12800, 1],
	[15600, -1],
	[17200, 1],
];
// scrollPos must be within +/- this amount of the specific point to allow transitioning
const TRANSITION_POINT_RANGE = 500;

var isOn = {}; // Map of button input number to true/false
var autoScroll = 0;
var scrollSpeed = 4;
var sliderPos = 0;
var scrollSpeedLimiter = false; // Is set to true when the scroll speed changes, which blocks further changes for a while, to reduce the speed at which it was changing
var raftimer;
var hudFader;
var konamiPos = 0; // Current position in the Konami code
var wasIdle = true; // Whether no inputs were read on the last run through - for Konami discretisation

var anyInputOn = false; // Is anything being pressed or the joystick being moved?
var anyButtonOn = false; // Is an actual button being pressed?

var haveEvents = 'GamepadEvent' in window;
var haveWebkitEvents = 'WebKitGamepadEvent' in window;
var controller;

var dbgout = "";
var elDbg = document.getElementById("debug");
var elArrowDn = document.getElementById("arrowDn");
var elArrowUp = document.getElementById("arrowUp");
var elSlider = document.getElementById("slider");
var elPartyOverlay = document.getElementById("partyOverlay");

var dbg = function(str) {
	elDbg.innerHTML = str;
};

var rAF = window.requestAnimationFrame;

// Matrix init
// from https://dev.to/gnsp/making-the-matrix-effect-in-javascript-din
const canvas = document.getElementById('canv');
const ctx = canvas.getContext('2d');
const cw = canvas.width = document.body.offsetWidth;
const ch = canvas.height = document.body.offsetHeight;
const cols = Math.floor(cw / 20) + 1;
const ypos = Array(cols).fill(0);
ctx.fillStyle = '#000';
ctx.fillRect(0, 0, cw, ch);


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

  for (var i = 0; i < controller.axes.length; i++) {
    dbgout += "<br>Axis " + i + " value " + controller.axes[i];
  }
  if (controller.axes[0] > 0.5) {
    isOn[DOWN] = 1;
    isOn[UP] = 0;
  } else if (controller.axes[0] < -0.5) {
    isOn[UP] = 1;
    isOn[DOWN] = 0;
  } else {
    isOn[UP] = isOn[DOWN] = 0;
  }
  if (controller.axes[1] > 0.5) {
    isOn[LEFT] = 1;
    isOn[RIGHT] = 0;
  } else if (controller.axes[1] < -0.5) {
    isOn[RIGHT] = 1;
    isOn[LEFT] = 0;
  } else {
    isOn[LEFT] = isOn[RIGHT] = 0;
  }
  // Due to inconsistencies in the way different browsers report axes, 
  // plus the fact they are analogue numbers when our joystick is a simple on/off microswitch for each direction
  // we use button inputs for the joystick instead of axes.
  // The first two buttons (0 and 1) are the actual buttons. The next four are the L, R, U, D.
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
    // Button pressed are OR'd with joystick movements
    isOn[i] |= isPressed | isTouched;
    anyInputOn |= isOn[i];
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
    let i = KEYMAP[e.code];
    isOn[i] = true;
    anyInputOn |= isOn[i];
    if (i == RED || i == GREEN) {
      anyButtonOn |= isOn[i];
    }
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
    // If nothing else is on, update the global any* variables
    // Do it with local variables so we don't set them false if they shouldn't be false
    let anyInputOnNow = false;
    let anyButtonOnNow = false;
    for (let i = 0; i < NUM_INPUTS; i++)
    {
      anyInputOnNow |= isOn[i];
      if (i == RED || i == GREEN) {
        anyButtonOnNow |= isOn[i];
      }
    }
    anyInputOn = anyInputOnNow;
    anyButtonOn = anyButtonOnNow;

    rAF(processActions);
  }
}

// Show the hud (if it's not already showing) with the given text, for the given number of milliseconds
function showHud(text, fadeTime) {
    var hud = document.getElementById("hud");
    hud.innerHTML = text;
    hud.classList.add("visible");
    // Start fading the hud after a bit, first resetting the timer if already running
    clearTimeout(hudFader);
    hudFader = setTimeout(function() {
  	hud.classList.remove("visible");
    }, fadeTime);
}

// The Konami Code victory dance
function matrixLoop () {
  ctx.fillStyle = '#0001';
  ctx.fillRect(0, 0, cw, ch);
  
  ctx.fillStyle = '#0f0';
  ctx.font = '15pt monospace';
  
  ypos.forEach((y, ind) => {
    const text = String.fromCharCode(Math.random() * 128);
    const x = ind * 20;
    ctx.fillText(text, x, y);
    if (y > 100 + Math.random() * 10000) ypos[ind] = 0;
    else ypos[ind] = y + 20;
  });
}


function party() {
	let partyTime = 12000;
	let colorAnims = [];
	for (let i = 0; i < 50; i++) {
		let randomColor = Math.floor(Math.random()*16777215).toString(16);
		colorAnims.push({backgroundColor: '#' + randomColor});
	}
	colorAnims.push({backgroundColor: "black"});
	let imageAnims = [];
	for (let i = 0; i < 50; i++) {
		let randomSize = Math.random() * 0.02 + 0.99; // From 0.99 to 1.01
		let randomOpacity = Math.random() * 0.25 + 0.25; // From 0.25 to 0.5
		imageAnims.push({opacity: randomOpacity, transform: "scale(" + randomSize + ")"});
	}
	imageAnims.push({transform: "scale(1)", opacity: 0.5}, {opacity: 0.75}, {opacity: 1});
	// No forwards fill on these as we want them to return to the starting condition. Which we ensure anyway because we want to animate to the end
	// instead of suddenly snapping back.
	document.body.animate(colorAnims, {duration: partyTime});
	elSlider.animate(imageAnims, {duration: partyTime});
}


// Respond to inputs. The arg is whether to call requestAnimationFrame - true for keyboard control, false for joystick because it's called from readGamePad
function processActions(raf=true) {  
  // Keep track of progress through Konami. To ensure that only discrete movements advance the pattern,
  // we only step to the next one when entering the correct state from a "nothing pressed" state
  if (wasIdle) { 
	  if (isOn[KONAMI_CODE[konamiPos]]) {
	  	console.log("Konami Pos is " + konamiPos);
	  	if (konamiPos == 9) {
		  	// Got the code!
			let matrixTime = 15000;
			let matrixFadeTime = 3000;
			elPartyOverlay.animate([{backgroundColor: "black",opacity: 0}, {backgroundColor: "black", opacity: 1.0}, {opacity: 0.5}, {backgroundColor: "white"}], {duration: matrixTime, fill: 'forwards'});
			canvas.animate([{opacity: 0}, {opacity: 1}], {duration: matrixFadeTime, fill: 'forwards'});
			let matrixHandle = setInterval(matrixLoop, 50);
			setTimeout(function() {
				canvas.animate([{opacity: 1}, {opacity: 0}], {duration: matrixFadeTime, fill: 'forwards'});
			}, matrixTime);
			setTimeout(function() {
				clearInterval(matrixHandle);
			}, matrixTime + matrixFadeTime);
			setTimeout(function() {
				party();
			}, 10000);
			console.log("Resetting Konami Pos after success");
		  	konamiPos = 0;
	  	} else {
		  	konamiPos++;
	  	}
	} else if (konamiPos && anyInputOn) {
		console.log("Resetting Konami Pos due to incorrect entry");
		konamiPos = 0;
	}
  }
  if (!anyInputOn) {
	wasIdle = true;
  } else {
	wasIdle = false;
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
  	}
  	if (scrollSpeedChanged) {
    		// Limit how fast the scroll speed changes
    		scrollSpeedLimiter = true;
    		setTimeout(function() {
      			scrollSpeedLimiter = false;
    		}, 100);
    		showHud("Scroll Speed: " + scrollSpeed, 700);
  	}

  	dbgout += "ScrollSpeed: " + scrollSpeed;
  	dbgout += "<br>AutoScroll: " + autoScroll;
	
  	// Handle left/right movement
  	if (isOn[LEFT] || isOn[RED] || autoScroll == LEFT) {
    		// Left
    		sliderPos -= scrollSpeed;
    		if (sliderPos < 0) {
      			sliderPos = 0; // Don't go past the left edge
      			autoScroll = 0; // Switch off autoscroll at the edge
    		}
    		window.scroll(sliderPos,0);
    		//let keyframes = [ { "marginLeft": -sliderPos + "px" } ];
    		//elSlider.animate(keyframes, SCROLL_ANIMATION_OPTIONS);
  	} else if (isOn[RIGHT] || isOn[GREEN] || autoScroll == RIGHT) {
    		// Right
    		sliderPos += scrollSpeed;
    		var maxScroll = document.body.scrollWidth - document.body.clientWidth;
    		if (sliderPos > maxScroll) {
      			sliderPos = maxScroll; // Don't go past the right edge
      			autoScroll = 0; // Switch off autoscroll at the edge
    		}
    		window.scroll({left: sliderPos, behaviour: "smooth"});
    		// let keyframes = [ { "marginLeft": -sliderPos + "px"} ];
    		// elSlider.animate(keyframes, SCROLL_ANIMATION_OPTIONS);
  	}
  	dbgout += "<br>sliderPos: " + sliderPos;
	
	// Find out if we are near an transition point
	let gotOne = false;
	for (let i = 0; i < TRANSITION_POINTS.length; i++) {
		if (Math.abs(sliderPos - TRANSITION_POINTS[i][0]) < TRANSITION_POINT_RANGE) {
			let direction = TRANSITION_POINTS[i][1];
			let directionStr = "";
			if (direction <= 0) {
				directionStr += "down";
				//elArrowDn.style.left = window.innerWidth / 2 + TRANSITION_POINTS[i][0] + "px";
				elArrowDn.style.left = "50vw";
			}
			if (direction == 0) {
				directionStr += " and "
			}
			if (direction >= 0) {
				directionStr += "up";
				//elArrowUp.style.left = window.innerWidth / 2 + TRANSITION_POINTS[i][0] + "px";
				elArrowUp.style.left = "50vw";
			}
			dbgout += "<br>Transition Point " + i + " in range - can go " + directionStr;
			gotOne = true;
			break;
		}
	}
	if (!gotOne) {
		// Hide the arrows off screen if they don't apply
		elArrowUp.style.left = elArrowDn.style.left = "-500px";
	}
	
  	// Output the debug messages
  	dbg(dbgout);
  }
	
  // If using only keyboard control, we need to loop this function so that holding a key down has the right effect
  // but with a delay or it moves much faster than joystick control
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



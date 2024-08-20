/*
 * Shadow Theatre Joystick Controller
 * Written 2023-2024 by Ben Wheeler <ben@uniqcode.com>
 * with some hints from
 * Gamepad API Test
 * Written in 2013 by Ted Mielczarek <ted@mielczarek.org>
 */
// Meaning of button input numbers (i.e. which thing is plugged into which input on the controller PCB)
const NUM_INPUTS = 12;
const LEFT = 0; 
const RIGHT = 1; 
const UP = 2;
const DOWN = 3;
const BTN_L1 = 4;
const BTN_R1 = 5;
const BTN_A = 6;
const BTN_B = 7;
const BTN_L2 = 8;
const BTN_R2 = 9;
const BTN_X = 10;
const BTN_Y = 11;
const SCROLLSPEED_MIN = 1;
const SCROLLSPEED_MAX = 100;
const KEYMAP = { // Keyboard control mapping to joystick equivalents
	ArrowUp: UP,
	ArrowDown: DOWN,
	ArrowLeft: LEFT,
	ArrowRight: RIGHT,
	Digit1: BTN_A,
	Digit2: BTN_B,
};
const KONAMI_CODE = [UP, UP, DOWN, DOWN, LEFT, RIGHT, LEFT, RIGHT, BTN_B, BTN_A];

const SCROLL_ANIMATION_OPTIONS = {
	duration: 200,
	fill: 'forwards', // Stay in the final position instead of springing back
};

// These are the horizontal positions in each Area from where we can go up (1) or down (-1) to a different Area (or both)
// If our position is within a certain distance of such a place, the arrow will appear and going up/down is allowed.
// Format: {fromArea: [exitPosition, direction, leadsToArea, entryPosition], ...}
// Each level's images are joined in a strip, but the relative entry and exit positions don't necessarily line up.
// Although most transitions are reversible - you can go back from whence you came - that isn't always the case. 
// For example, the Mario Tube is "down" in both directions. In any case, I found it problematic to only 
// specify an exit in one direction and then try to dynamically create the reverse direction, as it could be "dragged" 
// by going up and down while moving left or right, ending up with an exit in the wrong place, or to the wrong place. 
// Better to explicitly state all transitions in all directions.
const TRANSITIONS = {
	"main": [
		[2500, -1, "pirate", 3400],
		[7420, -1, "pirate", 6000],
		[7420, 1, "disco", 675],
		[11000, 1, "hug", 1200],
		[12240, -1, "skyworld", 1240], // NB Mario tube, goes DOWN but to a world that is UP from elsewhere in the map
		[13850, 1, "giant", 2000],
		[16680, -1, "dragon", 2040],
		[18200, 1, "skyworld", 7250],
	],
	"disco": [
		[675, -1, "main", 7420],
	],
	"dragon": [
		[2040, 1, "main", 16680],
		[3000, -1, "hell", 675],
	],
	"giant": [
		[2000, -1, "main", 13850],
	],
	"hell": [
		[675, 1, "dragon", 3000],
	],
	"hug": [
		[1200, -1, "main", 11000],
	],
	"pirate": [
		[3400, 1, "main", 2500],
		[6000, 1, "main", 7420],
	],
	"skyworld": [
		[1240, -1, "main", 12240], // Goes back DOWN to main even though we came DOWN from there
		[7250, -1, "main", 18200],
	],

};
// scrollPos must be within +/- this amount of the specific point to allow transitioning
const TRANSITION_RANGE = 500;
const TRANSITION_TIME = 1000;

var isOn = []; // Map of button input number to true/false
var scrollSpeed = 40;
var centerX = Math.floor(window.innerWidth / 2);
var scrollSpeedLimiter = false; // Is set to true when the scroll speed changes, which blocks further changes for a while, to reduce the speed at which it was changing
var raftimer;
var hudFader;
var konamiPos = 0; // Current position in the Konami code
var wasIdle = true; // Whether no inputs were read on the last run through - for Konami discretisation

// Whether to reverse left and right inputs. Press "X" on keyboard to toggle. Useful if the image 
// is horizontally flipped for back-projection (didn't have to do that in 2023 because there was no text)
var reverseLeftRight = true; 
var inputsBlocked = false; // Further inputs are ignored during a transition from one area to another
var anyInputOn = false; // Is anything being pressed or the joystick being moved?
var curArea = "main"; // Which area (contiguous left-right set of images) are we in?
var permittedVertical = []; // Whether we can go up or down (or both) from the current location

var haveEvents = 'GamepadEvent' in window;
var haveWebkitEvents = 'WebKitGamepadEvent' in window;
var controller;

var dbgout = "";
var elDbg = document.getElementById("debug");
var elArrowDn = document.getElementById("arrowDn");
var elArrowUp = document.getElementById("arrowUp");
var elPartyOverlay = document.getElementById("partyOverlay");

var partyHandle, arrowMoverHandle;

var dbg;
if (elDbg.style.display == "none") {
	dbg = () => {};
} else {
	dbg = (str) => {
		if (elDbg.innerHTML != str) {
			elDbg.innerHTML = str;
		}
	}
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
// Motivational messages
var nextMotivationalMessage = 0;
const motivationalMessages = [
	"REMAIN CALM",
	["PLEASE RELAX WHILE WE PROBE YOUR BRAIN...", "ERROR: BRAIN NOT FOUND"],
	"DON'T PANIC!!!",
	["NORMALITY WILL RESUME SHORTLY...", "...MAYBE"],
	"EVERYTHING IS FINE.",
	["IT'S SUPPOSED TO DO THAT...", "...I THINK..."],
	"OH NO, WHAT HAVE YOU DONE?!?!",
	"I FEEL STRANGE...",
	"FNORD",
];

// Disco Gradient initialisation
// Based on ideas from https://www.joshwcomeau.com/react/rainbow-button/
const discoGradientColorNames = [
	'--disco-gradient-color-0',
	'--disco-gradient-color-1',
];
// Register properties
discoGradientColorNames.forEach((name, index) => {
	CSS.registerProperty({
		name,
		syntax: '<color>',
		inherits: false,
		initialValue: 'hsl(180deg, 100%, 50%)',
	});
});
var evolveIndex = 0;

var lastMessage = -1; // Avoid repeating the last Easter Egg message

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
	//dbgout = "";
	const gamepads = navigator.getGamepads();
	controller = gamepads[0];

	if (!controller || !controller.buttons.length) {
		dbg("No controller");
		return;
	}

	anyInputOn = false;

	for (var i = 0; i < controller.axes.length; i++) {
		//dbgout += "Axis " + i + " value " + controller.axes[i] + "<br>";
	}
	if (controller.axes[0] > 0.5) {
		isOn[DOWN] = 1;
		isOn[UP] = 0;
		anyInputOn = true;
	} else if (controller.axes[0] < -0.5) {
		isOn[UP] = 1;
		isOn[DOWN] = 0;
		anyInputOn = true;
	} else {
		isOn[UP] = isOn[DOWN] = 0;
	}
	if (controller.axes[1] > 0.5) {
		if (reverseLeftRight) {
			isOn[LEFT] = 0;
			isOn[RIGHT] = 1;
		} else {
			isOn[LEFT] = 1;
			isOn[RIGHT] = 0;
		}
		anyInputOn = true;
	} else if (controller.axes[1] < -0.5) {
		if (reverseLeftRight) {
			isOn[RIGHT] = 0;
			isOn[LEFT] = 1;
		} else {
			isOn[RIGHT] = 1;
			isOn[LEFT] = 0;
		}	
		anyInputOn = true;
	} else {
		isOn[LEFT] = isOn[RIGHT] = 0;
	}
	// Button inputs are numbered 0 ..
	// For our internal numbering, add 4 because 0..3 are for left/right/up/down joystick
	for (var i = 0; i < controller.buttons.length; i++) {
		var isPressed = false, isTouched = false; // Is this button pressed/touched
		var val = controller.buttons[i];
		if (typeof (val) == "object") {
			isPressed = val.pressed;
			if ('touched' in val) {
				isTouched |= val.touched;
			}
		} else {
			isPressed = val == 1.0;
		}
		//dbgout += i + ": " + (isPressed ? "pressed " : "") + (isTouched ? "touched" : "") + "<br>";
		// Store the button state in its own slot first
		isOn[i + 4] = isPressed | isTouched;
		anyInputOn |= isOn[i + 4];
		// But the meaning of all the buttons is just direction movements, so OR them with joystick movements
		// They've been wired up such that the order of each block of 4 matches the order of the joystick directions
		// ... except if L/R reversed!
		if (reverseLeftRight && i % 4 == LEFT) {
			isOn[RIGHT] |= isOn[i + 4];
		} else if (reverseLeftRight && i % 4 == RIGHT) {
			isOn[LEFT] |= isOn[i + 4];
		} else {
			isOn[i % 4] |= isOn[i + 4];
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
		if (reverseLeftRight && i == LEFT) {
			isOn[RIGHT] = 1;
			anyInputOn |= isOn[RIGHT];
		} else if (reverseLeftRight && i == RIGHT) {
			isOn[LEFT] = 1;
			anyInputOn |= isOn[LEFT];
		} else {
			isOn[i] = 1;
			anyInputOn |= isOn[i];
		}
		rAF(processActions);
	} else if (e.key == 'X' || e.key == 'x') {
		e.preventDefault();
		console.log("Reversing the polarity");
		reverseLeftRight = !reverseLeftRight;
		console.log(reverseLeftRight);
	}
}

function keyup(e) {
	if (e.code in KEYMAP) {
		e.preventDefault();
		if (e.repeat) {
			return;
		}
		let i = KEYMAP[e.code];
		if (reverseLeftRight && i == LEFT) {
			isOn[RIGHT] = 0;
		} else if (reverseLeftRight && i == RIGHT) {
			isOn[LEFT] = 0;
		} else {
			isOn[i] = 0;
		}
		// If nothing else is on, update the global any* variables
		// Do it with local variables so we don't set them false if they shouldn't be false
		let anyInputOnNow = false;
		for (let i = 0; i < NUM_INPUTS; i++) {
			anyInputOnNow |= isOn[i];
		}
		anyInputOn = anyInputOnNow;

		rAF(processActions);
	}

}

// Show the hud (if it's not already showing) with the given text, for the given number of milliseconds
function showHud(text, fadeTime, flashing = false) {
	var hud = document.getElementById("hud");
	hud.innerHTML = text;
	if (flashing) {
		var flashOns, flashOffs;
		flashOns = setInterval(function () {
			hud.classList.add("visible");
		}, 900);
		setTimeout(function () {
			flashOffs = setInterval(function () {
				hud.classList.remove("visible");
			}, 900);
		}, 450);
		setTimeout(function () {
			clearInterval(flashOns);
			clearInterval(flashOffs);
			hud.classList.remove("visible");
		}, fadeTime);
		return;
	}
	hud.classList.add("visible");
	// Start fading the hud after a bit, first resetting the timer if already running
	clearTimeout(hudFader);
	hudFader = setTimeout(function () {
		hud.classList.remove("visible");
	}, fadeTime);
}

// The Konami Code victory dance
function matrixLoop() {
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

// In disco mode, the down arrow is kinda annoying stuck in one place, so let's move it around
function arrowMover() {
	elArrowDn.style.bottom = (10 + Math.floor(Math.random() * 80)) + "vh";
	elArrowDn.style.left = (10 + Math.floor(Math.random() * 80)) + "vw";
}

// Alternate evolving one or the other colour of the gradient
function discoColorsEvolve() {
	let randomH = Math.floor(Math.random() * 360);
	let randomS = Math.floor(Math.random() * 20) + 80; // 80-100% saturation
	let randomL = Math.floor(Math.random() * 50) + 50; // 50-100%

	let nextColor = 'hsl(' + randomH + 'deg, ' + randomS + '%, ' + randomL + '%)';
	// Apply the new color, update the DOM.
	document.getElementById("area-disco").style.setProperty(discoGradientColorNames[evolveIndex], nextColor);
	evolveIndex = (evolveIndex + 1) % discoGradientColorNames.length;
}

function partyColors(partyTime) {
	console.log("partyColors");
	let colorAnims = [];
	for (let i = 0; i < 50; i++) {
		let randomH = Math.floor(Math.random() * 360);
		let randomS = Math.floor(Math.random() * 20) + 80; // 80-100% saturation
		let randomL = Math.floor(Math.random() * 50) + 50; // 50-100%
		colorAnims.push({ backgroundColor: "hsl(" + randomH + "deg," + randomS + "%," + randomL + "%)" });
	}
	document.body.animate(colorAnims, { duration: partyTime });
}

function discoColors(partyTime, partyPlace) {
	console.log("discoColors");
	let colorAnims = [];
	for (let i = 0; i < 50; i++) {
		let randomX = Math.floor(Math.random() * 100); // in %
		let randomY = Math.floor(Math.random() * 100); // in %
		if (partyPlace == document.body) {
			let randomH = Math.floor(Math.random() * 360);
			let randomS = Math.floor(Math.random() * 20) + 80; // 80-100% saturation
			let randomL = Math.floor(Math.random() * 50) + 50; // 50-100%
			colorAnims.push({ backgroundColor: "hsl(" + randomH + "," + randomS + "," + randomL + ")" });
		} else {
			colorAnims.push({ backgroundPosition: randomX + "% " + randomY + "%" });
		}
	}
	partyPlace.animate(colorAnims, { duration: partyTime });
}

function party() {
	let partyTime = 12000;
	inputsBlocked = true;
	setTimeout(function () {
		inputsBlocked = false;
	}, partyTime);
	partyColors(partyTime);
	let imageAnims = [];
	for (let i = 0; i < 50; i++) {
		let theseanims = {};
		let randomOpacity = Math.random() * 0.25 + 0.25; // From 0.25 to 0.5
		theseanims["opacity"] = randomOpacity;
		theseanims["transform"] = "";
		// Transforms become progressively more likely, and potentially larger, as we proceed
		if (Math.random() * i > 5) {
			let randomMoveX = Math.random() * i - i / 2; // From -i/2 to +i/2
			let randomMoveY = Math.random() * i - i / 2;
			theseanims["transform"] += " translate(" + randomMoveX + "px, " + randomMoveY + "px)";
		}
		if (Math.random() * i > 10) {
			let randomSizeX = Math.random() * i / 4 - i / 8 + 100; // From 100-i/4 to 100+i/4
			// Preserve aspect ratio at first, then allow it to squish later
			let randomSizeY = randomSizeX;
			if (i > 30) {
				randomSizeY = Math.random() * i / 4 - i / 8 + 100; // From 100-i/4 to 100+i/4
			}
			theseanims["transform"] += " scale(" + randomSizeX + "%, " + randomSizeY + "%)";
		}
		if (Math.random() * i > 20) {
			let randomSkewX = Math.random() * i / 5 - i / 10; // From -i/10 to +i/10
			let randomSkewY = Math.random() * i / 5 - i / 10;
			theseanims["transform"] += " skew(" + randomSkewX + "deg, " + randomSkewY + "deg)";
		}
		theseanims["filter"] = "";
		if (Math.random() * i > 30) {
			let randomInvert = Math.random() * 100;
			theseanims["filter"] += " invert(" + randomInvert + "%)";
		}
		if (Math.random() * i > 20) {
			let randomDS1 = Math.floor(Math.random() * 50);
			let randomDS2 = Math.floor(Math.random() * 50);
			let randomDS3 = Math.floor(Math.random() * 70);
			let randomDSR = Math.floor(Math.random() * 256);
			let randomDSG = Math.floor(Math.random() * 256);
			let randomDSB = Math.floor(Math.random() * 256);
			theseanims["filter"] += " drop-shadow(" + randomDS1 + "px " + randomDS2 + "px " + randomDS3 + "px rgb(" + randomDSR + ", " + randomDSG + ", " + randomDSB + "))";
		}
		if (Math.random() * i > 20) {
			let randomRot = Math.floor(Math.random() * 360);
			theseanims["filter"] += " hue-rotate(" + randomRot + "deg)";
		}
		if (Math.random() * i > 30) {
			let randomBlur = Math.floor(Math.random() * 30);
			theseanims["filter"] += " blur(" + randomBlur + "px)";
		}
		imageAnims.push(theseanims);

	}
	imageAnims.push({ transform: "scale(1.0) translate(0px,0px)", opacity: 0.5 }, { opacity: 0.75 }, { opacity: 1 });
	console.log(imageAnims);
	let images = document.querySelectorAll("#area-" + curArea + " .slider .flexbox img");
	// If there is only one image, do it
	// Otherwise, try to only animate the main image that's on the screen, and its neighbours
	if (images.length == 1) {
		console.log("Only one image in this area");
		images[0].animate(imageAnims, { duration: partyTime });
	} else {
		// When there are multiple images in a slider, assume they are all the same size (1351 wide)
		// The index of the image at the centre of the screen will therefore be floor(centerX / 1351)
		let centerImage = Math.floor(centerX / 1351);
		console.log("centerImage: " + centerImage);
		let imagesToAnimate = [centerImage];
		// But do the left neighbour too because they might be on the screen, or creep
		// onto the screen during the animations
		if (centerImage > 0) {
			imagesToAnimate.push(centerImage - 1);
			console.log("Also animating the one to the left: " + (centerImage - 1));
		}
		// Doing the two to the right (if there are that many) should always be sufficient to cover 
		// the whole screen. 
		if (centerImage < images.length - 1) {
			imagesToAnimate.push(centerImage + 1);
			console.log("Also animating the one to the right: " + (centerImage + 1));
		}
		for (let i = 0; i < imagesToAnimate.length; i++) {
			console.log("Animating: " + imagesToAnimate[i]);
			images[imagesToAnimate[i]].animate(imageAnims, { duration: partyTime });
		}
	}
	let selectedMessage = motivationalMessages[nextMotivationalMessage];
	// It's about 900ms per flash of the message
	if (Array.isArray(selectedMessage)) {
		// 2-part message
		setTimeout(function () {
			showHud(selectedMessage[0], 5000, true);
		}, 500);
		setTimeout(function () {
			showHud(selectedMessage[1], 4000, true);
		}, 6500);
	} else {
		setTimeout(function () {
			showHud(selectedMessage, 6000, true);
		}, 3000);
	}
	nextMotivationalMessage = (nextMotivationalMessage + 1) % motivationalMessages.length;
}

function calculatePermittedVertical() {
	let canMove = false;
	let trans = TRANSITIONS[curArea];
	permittedVertical[DOWN] = permittedVertical[UP] = 0;
	for (let i = 0; i < trans.length; i++) {
		if (Math.abs(centerX - trans[i][0]) < TRANSITION_RANGE) {
			let direction = trans[i][1];
			let destArea = trans[i][2];
			let destX = trans[i][3];
			canMove = true;
			if (direction < 0) {
				dbgout += "Transition Point " + i + " in range - can go DOWN to " + destArea + ":" + destX + "<br>";
				elArrowDn.classList.remove("hidden");
				permittedVertical[DOWN] = [destArea, destX];
			} else if (direction > 0) {
				dbgout += "Transition Point " + i + " in range - can go UP to " + destArea + ":" + destX + "<br>";
				elArrowUp.classList.remove("hidden");
				permittedVertical[UP] = [destArea, destX];
			} else {
				console.log("Invalid direction value");
			}
		}
	}
	// Hide the arrows that do not apply
	if (!permittedVertical[DOWN]) {
		elArrowDn.classList.add("hidden");
	}
	if (!permittedVertical[UP]) {
		elArrowUp.classList.add("hidden");
	}
}

function showBlackBars() {
	let bars = document.getElementsByClassName("blackBar");
	for (let i = 0; i < bars.length; i++) {
		bars[i].classList.remove("hidden");
	}
}

function hideBlackBars() {
	let bars = document.getElementsByClassName("blackBar");
	for (let i = 0; i < bars.length; i++) {
		bars[i].classList.add("hidden");
	}
}

function moveTo(destArea, destX) {
	inputsBlocked = true;
	let elCurArea = document.getElementById("area-" + curArea);
	let elNewArea = document.getElementById("area-" + destArea);
	// Set location to the new area and pos
	dbgout += "Moving from " + curArea + ":" + centerX;
	dbgout += "to " + destArea + ":" + destX + "<br>";
	// I tried to do something fancier with the images overlaid, but it's problematic because they don't line up - you can
	// see the jump when we scroll to the right place on the new image. So it's easier to just fade everything to black 
	// (including the arrows because they change too) while the changeover happens.
	// The exception is going from the lighthouse into the disco, which I felt would be clearer
	// what's going on if we zoom in to the top of it...
	let everything = document.getElementById("everything");
	let lighthouse = document.getElementById("lighthouse");
	let swapTime = TRANSITION_TIME / 2;
	let endTime = TRANSITION_TIME;
	if (destArea == 'disco') {
		const zoomTime = 1500;
		// Add top and bottom black bars so that the enlarging image doesn't light up above and below
		// I'm sure it should be possible to do this with overflow-y: hidden but I couldn't make that work,
		// the image just disappears...
		showBlackBars();
		lighthouse.classList.add("zoomToLighthouse");
		setTimeout(function () {
			everything.classList.add("fadeOut");
		}, zoomTime);
		swapTime += zoomTime;
		endTime += zoomTime;
	} else {
		everything.classList.add("fadeOut");
	}
	// everything.animate([{ opacity: 1 }, { opacity: 0 }, { opacity: 1 }], { duration: TRANSITION_TIME, follow: "forwards" });
	// Halfway through the transition, swap over the images, scroll to the right place, and calculate the new exits
	setTimeout(function () {
		elCurArea.style.display = "none";
		elNewArea.style.display = "block";
		curArea = destArea;
		centerX = destX;
		window.scroll(centerX - window.innerWidth / 2, 0);
		calculatePermittedVertical();
		everything.classList.replace("fadeOut", "fadeIn");
		if (destArea == "disco") {
			lighthouse.classList.remove("zoomToLighthouse");
			hideBlackBars();
			// Start the party now so that the colours fade up
			// This value determines how rapidly the colours cycle - 30s gives a fairly slow one
			let partyTime = 120000;
			let partyPlace = document.getElementById("area-disco");
			discoColors(partyTime, partyPlace);
			discoColorsEvolve();
			setInterval(discoColorsEvolve, 6000);
			partyHandle = setInterval(function () {
				discoColors(partyTime, partyPlace);
			}, partyTime);
			elArrowDn.classList.add("moving");
			arrowMoverHandle = setInterval(function () {
				arrowMover();
			}, 30000);
		} else {
			// Stop any ongoing party
			if (partyHandle) {
				clearInterval(partyHandle);
				clearInterval(arrowMoverHandle);
				elArrowDn.classList.remove("moving");
				elArrowDn.style.bottom = "170px";
				elArrowDn.style.left = "50vw";
			}
		}
	}, swapTime);
	// Re-enable inputs once the transition is complete
	setTimeout(function () {
		inputsBlocked = false;
	}, endTime);
}

// Respond to inputs. The arg is whether to call requestAnimationFrame - true for keyboard control, false for joystick because it's called from readGamePad
function processActions(raf = true) {
	if (inputsBlocked) {
		if (raf) {
			setTimeout(function () {
				rAF(processActions);
			}, 20);
		}
		return;
	}
	if (raf) {
		dbgout = "";
	}
	// Keep track of progress through Konami. To ensure that only discrete movements advance the pattern,
	// we only step to the next one when entering the correct state from a "nothing pressed" state
	if (wasIdle) {
		if (isOn[KONAMI_CODE[konamiPos]]) {
			console.log("Konami Pos is " + konamiPos);
			if (konamiPos == 9) {
				// Got the code!
				let matrixTime = 15000;
				let matrixFadeTime = 3000;
				elPartyOverlay.animate([{ backgroundColor: "black", opacity: 0 }, { backgroundColor: "black", opacity: 1.0 }, { opacity: 0.5 }, { backgroundColor: "white" }], { duration: matrixTime, fill: 'forwards' });
				canvas.animate([{ opacity: 0 }, { opacity: 1 }], { duration: matrixFadeTime, fill: 'forwards' });
				let matrixHandle = setInterval(matrixLoop, 50);
				setTimeout(function () {
					canvas.animate([{ opacity: 1 }, { opacity: 0 }], { duration: matrixFadeTime, fill: 'forwards' });
				}, matrixTime);
				setTimeout(function () {
					clearInterval(matrixHandle);
				}, matrixTime + matrixFadeTime);
				setTimeout(function () {
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

		// Handle left/right movement
		if (isOn[LEFT]) {
			// Left
			centerX -= scrollSpeed;
			if (centerX - window.innerWidth / 2 < 0) {
				centerX = window.innerWidth / 2; // Don't go past the left edge
			}
			window.scroll(centerX - window.innerWidth / 2, 0);
		}
		// This is not an else, so that left and right cancel
		// out when both are pressed, rather than left dominating
		if (isOn[RIGHT]) {
			// Right
			centerX += scrollSpeed;
			var maxScroll = document.body.scrollWidth - window.innerWidth / 2;
			if (centerX > maxScroll) {
				centerX = maxScroll; // Don't go past the right edge
			}
			window.scroll(centerX - window.innerWidth / 2, 0);
		}
		if (reverseLeftRight) {
			dbgout += "<em>L/R Reversed</em><br>";
		}
		dbgout += "Area: " + curArea + "<br>";
		dbgout += "centerX: " + centerX + "<br>";

		// Find out if we are near a transition point
		calculatePermittedVertical();
		// Are we actually moving up or down?
		let destArea, destX;
		let direction = 0;
		if (permittedVertical[DOWN] && isOn[DOWN]) {
			destArea = permittedVertical[DOWN][0];
			destX = permittedVertical[DOWN][1];
			direction -= 1;
		}
		// No else here, so that simultaneous up and down cancel
		// instead of down dominating
		if (permittedVertical[UP] && isOn[UP]) {
			destArea = permittedVertical[UP][0];
			destX = permittedVertical[UP][1];
			direction += 1;
		}
		if (direction != 0) {
			// Clear any previous dbg messages
			dbgout = "<b>Going " + (direction > 0 ? "UP" : "DOWN") + " to " + destArea + ":" + destX + "</b>";
			moveTo(destArea, destX);
		}
		// Output the debug messages only if they've changed
		dbg(dbgout);
	}

	// If using only keyboard control, we need to loop this function so that holding a key down has the right effect
	// but with a delay or it moves much faster than the joystick. This doesn't apply to up and down, which do not repeat.
	if (raf) {
		clearTimeout(raftimer);
		if (isOn[UP]) {
			keyup({ code: "ArrowUp", preventDefault: () => { } });
		} else if (isOn[DOWN]) {
			keyup({ code: "ArrowDown", preventDefault: () => { } });
		}
		raftimer = setTimeout(function () {
			rAF(processActions);
		}, 20); // It loops too fast otherwise
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
document.getElementById("everything").classList.replace("fadeOut", "fadeIn");



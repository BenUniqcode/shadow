/*
 * Shadow Theatre Joystick Controller
 * Written 2023-2024 by Ben Wheeler <ben@uniqcode.com>
 * with some hints from
 * Gamepad API Test
 * Written in 2013 by Ted Mielczarek <ted@mielczarek.org>
 */

// Screen size
const SCREEN_WIDTH = 1920;
const SCREEN_HEIGHT = 760;
const HALF_SCREEN_WIDTH = SCREEN_WIDTH / 2;
const HALF_SCREEN_HEIGHT = SCREEN_HEIGHT / 2;
const PROJECTION_WIDTH = 1920;
const PROJECTION_HEIGHT = 1080;
const BAR_HEIGHT = (PROJECTION_HEIGHT - SCREEN_HEIGHT) / 2; // The upper and lower bars that are projected but sit above and below the screen

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
const PARTYTIME = 12000;
// Location and gravity strength of Black Hole
const BLACKHOLEX = 960; // centerX value
const BLACKHOLEY = 600; // centerY value
const BLACKHOLE_GRAVITY = 10 ** 3;
// Size of washing machine
const WASHING_MACHINE_WIDTH = 189;
const WASHING_MACHINE_HEIGHT = 237;

// How close do we need to be to the edge of an XY area that has an exit, to see the arrow, and then to actually take the exit
const XY_ARROW_PROXIMITY = 150;
const XY_EXIT_PROXIMITY = 2;

const SCROLL_ANIMATION_OPTIONS = {
	duration: 200,
	fill: 'forwards', // Stay in the final position instead of springing back
};

// Width of each image in multi-image areas like main, dragon, giant, and pirate
const STANDARD_IMAGE_WIDTH = 1351;

// Total widths of each Area
const WIDTH = {
	"main": 21 * STANDARD_IMAGE_WIDTH,
	"dragon": 3 * STANDARD_IMAGE_WIDTH,
	"giant": 5 * STANDARD_IMAGE_WIDTH,
	"hell": 1920,
	"hug": 3407,
	"pirate": 5 * STANDARD_IMAGE_WIDTH,
	"skyworld": 7853,
	"space": 7680,
	"undersea": 5760, // It's really only 1920 wide but pretends to be wider by moving objects around. 
	// To avoid blipping in and out of existence, we need at least the width of the widest object to be offscreen. Seems to work best if it's a whole number of screens
};

// Heights of areas with XY movement
const HEIGHT = {
	"space": 2000,
	"undersea": 2280,
};

// Which areas loop around horizontally?
// undersea doesn't count as we don't actually move horizontally at all, we just move its overlaid images
const XLOOP = {
	"main": true,
};

// Undersea objects, their starting position, and their widths.
// These will be loaded into a mutable array on entry to this area
// These will change mod the area width as we "move" left and right.
// Unlike normal levels, these positions are not "centerX", but can be any valid X value within the range, i.e. 0 to WIDTH["undersea"] - 1 - objectWidth
// (the position is to the top left of the object)
// I originally had position and width as arrays inside a single object, but I found that they were not getting reset properly. This works better.
const UNDERSEA_ENTRY_POS = WIDTH["undersea"] / 2;
const UNDERSEA_OBJECT_POS = {
	"chain": UNDERSEA_ENTRY_POS,
	"fish1": 800,
	"fish2": 600,
	"jellyfish": 4300,
	"anglerfish": 4150,
	"crab": 3380,
	"jellyfishes": 1400,
	"nemo": 5290,
	"seahorses": 2850,
	"moorishidol1": 3700, // We form the shoal by using different animation-delay on each fish
	"moorishidol2": 3700,
	"moorishidol3": 3700,
	"moorishidol4": 3700,
	"moorishidol5": 3700,
	"moorishidol6": 3700,
	"starfish": 5315,
	"turtle": 1000,
	"whale": 4000,
	"seafloor1": 50,
	"seafloor2": 600,
	"seafloor3": 1500,
	"seafloor4": 2500,
	"seafloor5": 3200,
	"seafloor6": 4100,
	"seafloor7": 4700,
};
var underseaObjects = {};
const UNDERSEA_OBJECT_WIDTH = {
	"chain": 1297,
	"fish1": 500,
	"fish2": 227,
	"jellyfish": 547,
	"anglerfish": 710,
	"crab": 178,
	"jellyfishes": 1017,
	"nemo": 202,
	"seahorses": 170,
	"moorishidol1": 139,
	"moorishidol2": 139,
	"moorishidol3": 139,
	"moorishidol4": 139,
	"moorishidol5": 139,
	"moorishidol6": 139,
	"starfish": 228,
	"turtle": 376,
	"whale": 752,
	"seafloor1": 702,
	"seafloor2": 1103,
	"seafloor3": 1103,
	"seafloor4": 800,
	"seafloor5": 1103,
	"seafloor6": 800,
	"seafloor7": 1103,
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
		[7420, -1, "pirate", 5795],
		[7420, 1, "disco", 675],
		[11000, 1, "hug", 1200],
		[12240, -1, "skyworld", 1240], // NB Mario tube, goes DOWN but to a world that is UP from elsewhere in the map
		[13850, 1, "giant", 2000],
		[16680, -1, "dragon", 2040],
		[18200, 1, "skyworld", 6700],
		[23800, -1, "undersea", UNDERSEA_ENTRY_POS], 
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
		[6700, -1, "main", 18200],
		[6700, 1, "space", 6695],
	],
	"space": [
		[6695, -1, "skyworld", 6700],
		// Space can also be exited via Black Hole
	],
	"undersea": [
		[UNDERSEA_ENTRY_POS, 1, "main", 23800], // Exit at the same position as entry
	],

};
// scrollPos must be within +/- this amount of the specific point to allow transitioning
const TRANSITION_RANGE = 400;
const TRANSITION_TIME = 1000;

var isOn = []; // Map of button input number to true/false
var scrollSpeed = 2;
var centerX = HALF_SCREEN_WIDTH;
var centerY = HALF_SCREEN_HEIGHT;  // Only matters for xy areas, and will be set on entry to such an area
var scrollSpeedLimiter = false; // Is set to true when the scroll speed changes, which blocks further changes for a while, to reduce the speed at which it was changing
var raftimer;
var hudFader;
var konamiPos = 0; // Current position in the Konami code
var wasIdle = true; // Whether no inputs were read on the last run through - for Konami discretisation
var gravityEnabled = true; // Whether gravity is enabled in space
var animationEnabled = true; // Whether animations such as spinning cogs and moving creatures are enabled

// Whether to reverse left and right inputs. Press "X" on keyboard to toggle. Useful if the image 
// is horizontally flipped for back-projection (didn't have to do that in 2023 because there was no text)
var reverseLeftRight = true;
var inputsBlocked = false; // Further inputs are ignored during a transition from one area to another, or during the easter egg party
var easterEggMutex = false; // Prevent easter egg being triggered again while it's running
var teleportMutex = false; // Prevent teleport likewise
var processActionsMutex = false; // Likewise ensure only one copy of processActions runs at a time
var anyInputOn = false; // Is anything being pressed or the joystick being moved?
var curArea = "main"; // Which area (contiguous left-right set of images) are we in?
var permittedVertical = []; // Whether we can go up or down (or both) from the current location

var haveEvents = 'GamepadEvent' in window;
var haveWebkitEvents = 'WebKitGamepadEvent' in window;
var controller;

var dbgOut = "";
var elDbg = document.getElementById("debug");
var elArrowDn = document.getElementById("arrowDn");
var elArrowUp = document.getElementById("arrowUp");
var elPartyOverlay = document.getElementById("partyOverlay");

var partyHandle, arrowMoverHandle;

var dbg;
if (elDbg.style.display == "none") {
	dbg = () => { };
} else {
	dbg = (str) => {
		if (elDbg.innerHTML != str) {
			elDbg.innerHTML = str + (inputsBlocked ? "<br>inputsBlocked" : "");
		}
	}
};

var rAF = window.requestAnimationFrame;

// Matrix init
// from https://dev.to/gnsp/making-the-matrix-effect-in-javascript-din
const canvas = document.getElementById('canv');
const ctx = canvas.getContext('2d');
const cw = canvas.width;
const ch = canvas.height;
const cols = Math.floor(cw / 20) + 1;
const ypos = Array(cols).fill(0);
ctx.fillStyle = '#000';
ctx.fillRect(0, 0, cw, ch);
// Set text colours
ctx.fillStyle = '#0f0';
ctx.font = '15pt monospace';

// Flip text horizontally
ctx.translate(cw, 0);
ctx.scale(-1, 1);

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
		initialValue: 'hsl(180deg, 100%, 20%)',
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
	const gamepads = navigator.getGamepads();
	controller = gamepads[0];

	if (!controller || !controller.buttons.length) {
		dbg("No controller");
		return;
	}

	anyInputOn = false;

	for (var i = 0; i < controller.axes.length; i++) {
		//dbgOut += "<br>Axis " + i + " value " + controller.axes[i];
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
		isOn[LEFT] = 1;
		isOn[RIGHT] = 0;
		anyInputOn = true;
	} else if (controller.axes[1] < -0.5) {
		isOn[RIGHT] = 1;
		isOn[LEFT] = 0;
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
		//dbgOut += "<br>" + i + ": " + (isPressed ? "pressed " : "") + (isTouched ? "touched" : "");
		// Store the button state in its own slot first
		isOn[i + 4] = isPressed | isTouched;
		anyInputOn |= isOn[i + 4];
		// But the meaning of all the buttons is just direction movements, so OR them with joystick movements
		// They've been wired up such that the order of each block of 4 matches the order of the joystick directions
		// ... except if L/R reversed!
		isOn[i % 4] |= isOn[i + 4];
	}

	processActions(false);
	rAF(readGamepad);
}

// Note we only call e.preventDefault() for keys that we handle - others are passed through to
// the browser as normal so that we can access devtools, reload etc.
function keydown(e) {
	if (e.code in KEYMAP) {
		e.preventDefault();
		if (e.repeat) {
			return;
		}
		let i = KEYMAP[e.code];
		isOn[i] = 1;
		anyInputOn |= isOn[i];
		rAF(processActions);
	} else {
		switch(e.key.toLowerCase()) {
		case 'x':
			e.preventDefault();
			console.log("Reversing the polarity");
			reverseLeftRight = !reverseLeftRight;
			console.log(reverseLeftRight);
			break;
		case 's':
			e.preventDefault();
			scrollSpeed = Math.max(SCROLLSPEED_MIN, --scrollSpeed);
			showHud("Scroll speed: " + scrollSpeed, 500);
			break;
		case 'f':
			e.preventDefault();
			scrollSpeed = Math.min(SCROLLSPEED_MAX, ++scrollSpeed);
			showHud("Scroll speed: " + scrollSpeed, 500);
			break;
		case 'e':
			e.preventDefault();
			easterEgg();
			break;
		case 'z':
			// Debugging for space and teleportation
			e.preventDefault();
			if (curArea == "space") {
				teleport();
			} else {
				changeArea("space", 6695);
			}
			break;
		case 'u':
			// Debugging for undersea
			e.preventDefault();
			changeArea("undersea", UNDERSEA_ENTRY_POS);
			break;
		case 'g':
			e.preventDefault();
			if (curArea == "space") {
				if (gravityEnabled) {
					console.log("Switching gravity OFF");
					gravityEnabled = false;
				} else {
					console.log("Switching gravity ON");
					gravityEnabled = true;
				}
			}
			break;
		case 'a':
			e.preventDefault();
			if (animationEnabled) {
				document.querySelectorAll('img.animate').forEach((el) => {
					el.classList.replace("animate", "canAnimate");
				});
				animationEnabled = false;
			} else {
				document.querySelectorAll("img.canAnimate").forEach((el) => {
					el.classList.replace("canAnimate", "animate");
				});
				animationEnabled = true;
			}
			break;
		}
	}
}

function keyup(e) {
	if (e.code in KEYMAP) {
		e.preventDefault();
		if (e.repeat) {
			return;
		}
		let i = KEYMAP[e.code];
		isOn[i] = 0;
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

// Get the offset of the image currently closest to the center of the screen, according to the current DOM order
// Say there are three images, currently in this order: <img id="2"> <img id="3"> <img id="1">
// and we're centred on the middle one, it will return 3
function getCenterImagePos() {
	let centerImagePos = Math.floor(centerX / STANDARD_IMAGE_WIDTH);
	return centerImagePos;
}

// Get the image element of the center image
function getCenterImage() {
	let centerImagePos = getCenterImagePos();
	let images = document.querySelectorAll("#area-" + curArea + " .slider img");
	console.log("Looking for image pos " + centerImagePos + " out of total " + images.length + " images");
	return images[centerImagePos];
}

// Get the image container of the center image
function getCenterImageBox() {
	let centerImagePos = getCenterImagePos();
	let imageboxes = document.querySelectorAll("#area-" + curArea + " .slider .imgbox");
	return imageboxes[centerImagePos];
}

// Get the ID number of the given loop area image - because their order in the DOM may have been rearranged
function getLoopImageNum(area, imageEl) {
	let id = imageEl.id;
	let num = id.replace(area, '');
	return num;
}

function showBars() {
	let bars = document.getElementsByClassName("bar");
	for (let i = 0; i < bars.length; i++) {
		bars[i].classList.remove("hidden");
	}
}

function hideBars() {
	let bars = document.getElementsByClassName("bar");
	for (let i = 0; i < bars.length; i++) {
		bars[i].classList.add("hidden");
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
	// This needs to be done on every loop to fade out the chars
	ctx.fillStyle = '#0001';
	ctx.fillRect(0, 0, cw, ch);
	ctx.fillStyle = '#0c0';
	ctx.font = '18pt monospace';

	let text = "";
	if (Math.random() < 0.05) {
		text = "QUEXTAL";
	} else {
		for (let i = 0; i < 7; i++) { 
			// Use pages 0 to 36 of UTF16 for a reasonable variety of characters without
			// ending up dominated by Chinese
			let page = Math.random() * 36;
			let cnum = Math.random() * 128 + 128 * page;
			text += String.fromCharCode(cnum);
		}
	}

	let i = 0;
	ypos.forEach((y, ind) => {
		let c = text.charAt(i);
		const x = ind * 35;
		ctx.fillText(c, x, y);
		if (y > 100 + Math.random() * 10000) {
			ypos[ind] = 0;
		} else {
			ypos[ind] = y + 20;
		}
		if (i < 7) {
			i++;
		} else {
			i = 0;
		}
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
	let randomL = Math.floor(Math.random() * 50) + 20; // 20-70%

	let nextColor = 'hsl(' + randomH + 'deg, ' + randomS + '%, ' + randomL + '%)';
	// Apply the new color, update the DOM.
	document.getElementById("area-disco").style.setProperty(discoGradientColorNames[evolveIndex], nextColor);
	evolveIndex = (evolveIndex + 1) % discoGradientColorNames.length;
}

function partyColors(partyTime) {
	console.log("partyColors");
	let colorAnims = [];
	for (let i = 0; i < 20; i++) {
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
	inputsBlocked = true;
	setTimeout(function () {
		inputsBlocked = false;
	}, PARTYTIME);
	partyColors(PARTYTIME);
	let imageAnims = [];
	for (let i = 0; i < 50; i++) {
		let theseanims = {};
		let randomOpacity = Math.random() * 0.25 + 0.25; // From 0.25 to 0.5
		theseanims["opacity"] = randomOpacity;
		let transform = "";
		// Transforms become progressively more likely, and potentially larger, as we proceed
		if (Math.random() * i > 5) {
			let randomMoveX = Math.floor(Math.random() * i - i / 2); // From -i/2 to +i/2
			let randomMoveY = Math.floor(Math.random() * i - i / 2);
			transform += " translate(" + randomMoveX + "px, " + randomMoveY + "px)";
		}
		if (Math.random() * i > 10) {
			let randomSizeX = Math.random() * i / 4 - i / 8 + 100; // From 100-i/4 to 100+i/4
			// Preserve aspect ratio at first, then allow it to squish later
			let randomSizeY = randomSizeX;
			if (i > 30) {
				randomSizeY = Math.random() * i / 4 - i / 8 + 100; // From 100-i/4 to 100+i/4
			}
			transform += " scale(" + randomSizeX + "%, " + randomSizeY + "%)";
		}
		if (Math.random() * i > 20) {
			let randomSkewX = Math.random() * i / 5 - i / 10; // From -i/10 to +i/10
			let randomSkewY = Math.random() * i / 5 - i / 10;
			transform += " skew(" + randomSkewX + "deg, " + randomSkewY + "deg)";
		}
		if (Math.random() * i > 30) {
			let randomAngle = Math.random() * 2 * i - i; // From -i to +i degrees
			transform += " rotate("  + randomAngle + "deg)";
		}
		if (transform.length > 0) {
			theseanims["transform"] = transform;
		}
		let filter = "";
		if (Math.random() * i > 30) {
			let randomInvert = Math.random() * 100;
			filter += " invert(" + randomInvert + "%)";
		}
		if (Math.random() * i > 20) {
			let randomDS1 = Math.floor(Math.random() * 50);
			let randomDS2 = Math.floor(Math.random() * 50);
			let randomDS3 = Math.floor(Math.random() * 100);
			let randomDSR = Math.floor(Math.random() * 256);
			let randomDSG = Math.floor(Math.random() * 256);
			let randomDSB = Math.floor(Math.random() * 256);
			filter += " drop-shadow(" + randomDS1 + "px " + randomDS2 + "px " + randomDS3 + "px rgb(" + randomDSR + ", " + randomDSG + ", " + randomDSB + "))";
		}
		if (Math.random() * i > 20) {
			let randomRot = Math.floor(Math.random() * 360);
			filter += " hue-rotate(" + randomRot + "deg)";
		}
		if (Math.random() * i > 30) {
			let randomBlur = Math.floor(Math.random() * 30);
			filter += " blur(" + randomBlur + "px)";
		}
		if (filter.length > 0) {
			theseanims["filter"] = filter;
		}
		imageAnims.push(theseanims);

	}
	imageAnims.push({ transform: "scale(1.0) translate(0px,0px)", opacity: 0.5 }, { opacity: 0.75 }, { opacity: 1 });
	console.log(imageAnims);
	let images = document.querySelectorAll("#area-" + curArea + " .slider img");
	// If there is only one image, do it
	// Otherwise, try to only animate the main image that's on the screen, and its neighbours
	if (images.length == 1) {
		console.log("Only one image in this area");
		images[0].animate(imageAnims, { duration: PARTYTIME });
	} else {
		// When there are multiple images in a slider, assume they are all the same size (1351 wide)
		// The index of the image at the centre of the screen will therefore be floor(centerX / 1351)
		let centerImagePos = getCenterImagePos();
		let imagesToAnimate = [centerImagePos];
		// But do the left neighbour too because they might be on the screen, or creep
		// onto the screen during the animations
		if (centerImagePos > 0) {
			imagesToAnimate.push(centerImagePos - 1);
			console.log("Also animating the one to the left: " + (centerImagePos - 1));
		}
		// Same with the right neighbour
		if (centerImagePos < images.length - 1) {
			imagesToAnimate.push(centerImagePos + 1);
			console.log("Also animating the one to the right: " + (centerImagePos + 1));
		}
		// Animate the selected images
		for (let i = 0; i < imagesToAnimate.length; i++) {
			console.log("Animating: " + imagesToAnimate[i]);
			images[imagesToAnimate[i]].animate(imageAnims, { duration: PARTYTIME });
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
	// We don't want to change centerX (or use it) for XLOOP levels as it's relative to the current DOM image order, which might have changed
	// What we care about here is the "old" or "true" centerX value  
	let trueCenterX;
	if (XLOOP[curArea]) {
		// Translate the current image closest to the center of the screen, and its center position, into the old-style centerX value
		let centerImage = getCenterImage();
		let centerImageNum = getLoopImageNum(curArea, centerImage);
		let boundingRect = centerImage.getBoundingClientRect(); // This is relative to the viewport
		let imageCenterXpos = Math.floor(boundingRect.right - STANDARD_IMAGE_WIDTH / 2);
		// But the image position goes the opposite way than the x position we want, so we actually want screenwidth - centrexpos as the offset
		let imageCenterXrev = SCREEN_WIDTH - imageCenterXpos;
		trueCenterX = (centerImageNum - 1) * STANDARD_IMAGE_WIDTH + imageCenterXrev;
		// But it needs a fudge because something about the maths isn't quite right
		trueCenterX -= 250;
		dbgOut += "<br>Image #" + centerImageNum + "'s centerXpos " + imageCenterXpos + " = Xrev " + imageCenterXrev + " = centerX " + trueCenterX;
	} else {
		trueCenterX = centerX;
	}

	let spaceProximityArrow = false;
	let underseaProximityArrow = false;
	for (let i = 0; i < trans.length; i++) {
		if (Math.abs(trueCenterX - trans[i][0]) < TRANSITION_RANGE) {
			let direction = trans[i][1];
			let destArea = trans[i][2];
			let destX = trans[i][3];
			canMove = true;
			if (direction < 0) {
				if (curArea == "space") {
					// Need to be close to the bottom of the image in order to exit
					// Some slop is needed for the value of centerY anyway, as it never quite reaches 1620
					// So we make the exit take effect within 2px of the bottom, but show the arrow for 25px
					let proximityToBottom = HEIGHT["space"] - HALF_SCREEN_HEIGHT - centerY;
					if (proximityToBottom <= XY_ARROW_PROXIMITY) {
						elArrowDn.classList.remove("hidden");
						spaceProximityArrow = true; // Prevent it from being rehidden if the movement is not actually allowed yet
						if (proximityToBottom >= XY_EXIT_PROXIMITY) {
							dbgOut += "<br>Exit " + i + " vertical proximity is within arrow range but not exit range";
						}
					} 
					if (proximityToBottom <= XY_EXIT_PROXIMITY) {
						dbgOut += "<br>Exit " + i + " in range - can go DOWN to " + destArea + ":" + destX;
						permittedVertical[DOWN] = [destArea, destX];
					}
				} else {
					dbgOut += "<br>Exit " + i + " in range - can go DOWN to " + destArea + ":" + destX;
					elArrowDn.classList.remove("hidden");
					permittedVertical[DOWN] = [destArea, destX];
				}
			} else if (direction > 0) {
				if (curArea == "undersea") {
					// Similar to space, but the exit is at the top
					let proximityToTop = centerY - HALF_SCREEN_HEIGHT;
					if (proximityToTop <= XY_ARROW_PROXIMITY) {
						elArrowUp.classList.remove("hidden");
						underseaProximityArrow = true; // Prevent it from being rehidden if the movement is not actually allowed yet
						if (proximityToTop > XY_EXIT_PROXIMITY) {
							dbgOut += "<br>Exit " + i + " vertical proximity is within arrow range but not exit range";
						}
					}
					if (proximityToTop <= XY_EXIT_PROXIMITY) {
						dbgOut += "<br>Exit " + i + " in range - can go UP to " + destArea + ":" + destX;
						permittedVertical[UP] = [destArea, destX];
					}
				} else {
					dbgOut += "<br>Exit " + i + " in range - can go UP to " + destArea + ":" + destX;
					elArrowUp.classList.remove("hidden");
					permittedVertical[UP] = [destArea, destX];
				}
			} else {
				console.log("Invalid direction value");
			}
		}
	}
	// Hide the arrows that do not apply
	if (!permittedVertical[DOWN] && !spaceProximityArrow) {
		elArrowDn.classList.add("hidden");
	}
	if (!permittedVertical[UP] && !underseaProximityArrow) {
		elArrowUp.classList.add("hidden");
	}
}

function changeArea(destArea, destX) {
	inputsBlocked = true;
	let elCurArea = document.getElementById("area-" + curArea);
	let elNewArea = document.getElementById("area-" + destArea);
	// Set location to the new area and pos
	dbgOut += "<br>Moving from " + curArea + ":" + centerX;
	dbgOut += "<br>to " + destArea + ":" + destX;
	if (XLOOP[destArea]) {
		// Can't easily move to a specific image, so we don't bother trying; the old centerX offset will work fine,
		// BUT we must ensure the images are in their original order. So rotate left the correct number of times if necessary.
		// The check that curArea is not main prevents this happening when we call changeArea on first load.
		let images = elNewArea.querySelectorAll(".slider img");
		for (let i = getLoopImageNum(destArea, images[0]); i > 1; i--) {
			rotateLoopImagesRight(destArea); // Obviously in some circumstances it would be quicker to go left by 1-i, but fuggit
		}
	}

	// I tried to do something fancier with the images overlaid, but it's problematic because they don't line up - you can
	// see the jump when we scroll to the right place on the new image. So it's easier to just fade everything on the screen to black 
	// (including the arrows because they change too) while the changeover happens.
	// The exception is going from the lighthouse into the disco, which I felt would be clearer
	// what's going on if we zoom in to the top of it...
	let everything = document.getElementById("screen");
	let lighthouse = document.querySelector(".lighthouse"); // Had to use a class here because we need IDs for the numbering
	let swapTime = TRANSITION_TIME / 2;
	let endTime = TRANSITION_TIME;
	if (destArea == 'disco') {
		const zoomTime = 1500;
		// Add top and bottom black bars so that the enlarging image doesn't light up above and below
		// I'm sure it should be possible to do this with overflow-y: hidden but I couldn't make that work,
		// the image just disappears...
		lighthouse.classList.add("zoomToLighthouse");
		setTimeout(function () {
			everything.classList.add("fadeOut");
		}, zoomTime);
		swapTime += zoomTime;
		endTime += zoomTime;
	} else {
		everything.classList.add("fadeOut");
	}
	// If the washing machine is showing, fade it out now
	let washingMachine = document.querySelector('#washingMachine');
	washingMachine.classList.replace("fadeIn", "fadeOut");
	washingMachine.classList.remove("zoomOut");
	washingMachine.classList.remove("sink");

	// everything.animate([{ opacity: 1 }, { opacity: 0 }, { opacity: 1 }], { duration: TRANSITION_TIME, follow: "forwards" });
	// Halfway through the transition, swap over the images, scroll to the right place, and calculate the new exits
	setTimeout(function () {
		elCurArea.style.display = "none";
		elNewArea.style.display = "block";
		curArea = destArea;
		centerX = destX;
		if (destArea == "space") {
			// Space is 2D. As we're coming in from the bottom, we need to start at the bottom of the image.
			centerY = HEIGHT["space"] - HALF_SCREEN_HEIGHT;
		} else if (destArea == "undersea") {
			// Also 2D but we come in from the top
			centerY = HALF_SCREEN_HEIGHT;
			populateUnderseaObjects(); // Make sure all objects start in their initial locations
			moveUnderseaObjects(0); // Draw them in their right places
		} else {
			centerY = HALF_SCREEN_HEIGHT; // Ignored, but set it to what it should be
		}
		move();
		calculatePermittedVertical();
		everything.classList.replace("fadeOut", "fadeIn");
		if (destArea == "hell" || destArea == "disco") {
			hideBars();
		} else {
			showBars();
		}
		if (destArea == "disco") {
			lighthouse.classList.remove("zoomToLighthouse");
			// Start the party now so that the colours fade up
			// This value determines how rapidly the colours cycle - 30s gives a fairly slow one
			let partyPlace = document.getElementById("area-disco");
			discoColors(PARTYTIME, partyPlace);
			discoColorsEvolve();
			setInterval(discoColorsEvolve, 6000);
			partyHandle = setInterval(function () {
				discoColors(PARTYTIME, partyPlace);
			}, PARTYTIME);
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
				elArrowDn.style.bottom = "220px";
				elArrowDn.style.left = "50vw";
				showBars();
			}
		}
	}, swapTime);
	// Re-enable inputs and run rAF once the transition is complete
	setTimeout(function () {
		inputsBlocked = false;
		processActions(false, true);
	}, endTime);
}

function easterEgg() {
	// Prevent running more than once simultaneously
	if (easterEggMutex) {
		console.log("Easter egg is already running, will not run again");
		return;
	}
	console.log("Easter Egg triggered");
	easterEggMutex = true;
	let matrixTime = 12000;
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
		console.log("Matrix ended - party time!");
		party();
	}, matrixTime);
	setTimeout(function() {
		console.log("Releasing Easter Egg Mutex");
		easterEggMutex = false;
	}, matrixTime + PARTYTIME);
}

function rotateLoopImagesRight(area) {
	// Move the rightmost image to the left (thus doing a right-shift with wrap), and change centerX accordingly
	let container = document.querySelector("#area-" + area + " .slider .flexbox");
	let imageboxes = container.querySelectorAll(".imgbox");
	container.insertBefore(imageboxes[imageboxes.length - 1], imageboxes[0]);
	centerX += STANDARD_IMAGE_WIDTH;
}

function rotateLoopImagesLeft(area) {
	// Move the leftmost image to the right (thus doing a left-shift with wrap) and change centerX accordingly
	let container = document.querySelector("#area-" + area + " .slider .flexbox");
	let imageboxes = container.querySelectorAll(".imgbox");
	container.insertBefore(imageboxes[0], null); // null means insert at the end
	centerX -= STANDARD_IMAGE_WIDTH;
}

function populateUnderseaObjects() {
	underseaObjectPos = {};
	for (var key in UNDERSEA_OBJECT_POS) {
		underseaObjectPos[key] = UNDERSEA_OBJECT_POS[key];
	}
}

// Place the undersea objects based on the current value of centerX - bearing in mind that their movement is in the opposite
// direction than the movement of a background.
function moveUnderseaObjects(pixels) {
	for (var key in underseaObjectPos) {
		const oldPos = underseaObjectPos[key];
		const objectWidth = UNDERSEA_OBJECT_WIDTH[key];
		let newPos = oldPos;
		if (pixels > 0) {
			newPos = (newPos + pixels) % WIDTH["undersea"]; // right wrap
		} else {
			newPos += pixels;
			if (newPos < 0) {
				newPos += WIDTH["undersea"]; // left wrap
			}
		}
		dbgOut += "<br>" + key + ": " + oldPos + " -> " + newPos + " ";
		let el = document.getElementById(key);
		// Because we are really moving objects, not the background, the visible area doesn't change - it's always
		// half a screen each side of the entry point. But because the position is the left of the object, we must take account
		// of the object's width when deciding whether to hide it on the left, otherwise it will vanish as soon as its left side touches the
		// screen edge. 
		const viewportL = UNDERSEA_ENTRY_POS - HALF_SCREEN_WIDTH - objectWidth;
		const viewportR = UNDERSEA_ENTRY_POS + HALF_SCREEN_WIDTH;
		// dbgOut += "<br>Viewport L:" + viewportL + " R:" + viewportR + " / ";
		if (newPos < viewportL || newPos > viewportR) {
			if (!el.classList.contains("hidden")) {
				dbgOut += "HIDE";
				//el.classList.add("hidden");
			} else {
				dbgOut += "hidden";
			}
		} else {
			if (el.classList.contains("hidden")) {
				dbgOut += "SHOW";
				//el.classList.remove("hidden");
			} else {
				dbgOut += "visible";
			}
		}
		// Remember the left position is relative to the div, which does not move
		let leftVal = newPos - SCREEN_WIDTH + "px"; // I don't really understand why this is correct, but it is
		el.style.left = leftVal;
		dbgOut += " left:" + leftVal;
		// Update it
		underseaObjectPos[key] = newPos;
	}
}

function move() {
	// Not all areas have a slider; if not, it's a full-screen level with no left/right movement allowed
	let slider = document.querySelector("#area-" + curArea + " .slider");
	if (!slider) {
		return;
	}
	if (XLOOP[curArea]) {
		// If we are in a forever scrolling area, ensure at least two images are present to the left and right of the currently-centred one.
		// (It may not yet be actually centred on the screen, but it's the one that *will* be when we set the margin, because centerX points to it)
		// (In the case of the sea areas, which only have 2 images per level, this requires having multiple copies of the images alternating in the HTML)
		let container = document.querySelector("#area-" + curArea + " .slider .flexbox");
		let images = container.querySelectorAll("img");
		let centerImagePos = getCenterImagePos();
		while (centerImagePos < 2) {
			console.log("Rotate right to ensure 2 images on left");
			rotateLoopImagesRight(curArea);
			centerImagePos = getCenterImagePos();
			images = container.querySelectorAll("img");
			console.log("Centre Image is now position " + centerImagePos + " and is image number " + getLoopImageNum(curArea, images[centerImagePos]));
		}
		while (centerImagePos > images.length - 3) {
			console.log("Rotate left to ensure 2 images on right");
			rotateLoopImagesLeft(curArea);
			centerImagePos = getCenterImagePos();
			images = container.querySelectorAll("img");
			console.log("Centre Image is now position " + centerImagePos + " and is image number " + getLoopImageNum(curArea, images[centerImagePos]));
		}
	}
	// Don't set the margins until after the images have been rearranged, to avoid jumping around
	if (curArea != "undersea") {
		slider.style.marginLeft = -centerX + HALF_SCREEN_WIDTH + "px";
	}
	let xyslider = document.querySelector("#area-" + curArea + " .xyslider");
	if (xyslider) {
		// console.log("Setting xyslider marginTop");
		xyslider.style.marginTop = -centerY + HALF_SCREEN_HEIGHT + BAR_HEIGHT + "px";
	}
}

function moveLeft() {
	// Not all areas have a slider; if not, it's a full-screen level with no left/right movement allowed
	let slider = document.querySelector("#area-" + curArea + " .slider");
	if (!slider) {
		return;
	}
	centerX -= scrollSpeed;
	// Special handling for undersea - still do centerX because that's needed for the exits, but don't use it for movement -
	// each object must be moved individually so that they wrap around correctly with no jumps
	if (curArea == "undersea") {
		// Wrap around if we hit the left edge. For this area, the left edge is zero, not HALF_SCREEN_WIDTH
		if (centerX < 0) {
			centerX += WIDTH["undersea"];
		}
		// The objects move in the opposite direction than the background would
		moveUnderseaObjects(scrollSpeed);
		return;
	} else if (!XLOOP[curArea] && centerX < HALF_SCREEN_WIDTH) {
		// Stop at the left edge
		centerX = HALF_SCREEN_WIDTH; 
	}
	move();
}

function moveRight() {
	// Not all areas have a slider; if not, it's a full-screen level with no left/right movement allowed
	let slider = document.querySelector("#area-" + curArea + " .slider");
	if (!slider) {
		return;
	}
	// Right
	centerX += scrollSpeed;
	// Special handling for undersea
	if (curArea == "undersea") {
		// Wrap around if we hit the right edge. For this area, that's the full width.
		if (centerX > WIDTH["undersea"]) {
			centerX -= WIDTH["undersea"]; 
		}
		// The objects move in the opposite direction than the background would
		moveUnderseaObjects(-scrollSpeed);
		return;
	} else if (!XLOOP[curArea] && centerX > WIDTH[curArea] - HALF_SCREEN_WIDTH - 1) {
		// Stop at the right edge
		centerX = WIDTH[curArea] - HALF_SCREEN_WIDTH - 1;
	}
	move();
}

function moveUp() {
	// Only allow for xy areas
	// Apparently can't use .slider.xy to match on two classes: "not a valid selector!"
	let slider = document.querySelector("#area-" + curArea + " .xyslider");
	if (!slider) {
		return;
	}
	// Up
	centerY -= scrollSpeed;
	let minScroll = HALF_SCREEN_HEIGHT;
	if (centerY < minScroll) {
		centerY = minScroll;
	}
	move();
}

function moveDown() {
	// Only allow for xy areas
	let slider = document.querySelector("#area-" + curArea + " .xyslider"); 
	if (!slider) {
		return;
	}
	// Down
	centerY += scrollSpeed;
	let maxScroll = HEIGHT[curArea] - HALF_SCREEN_HEIGHT;
	if (centerY > maxScroll) {
		centerY = maxScroll;
	}
	move();
}

function teleport() {
	if (teleportMutex) {
		return;
	}
	teleportMutex = true;
	// Pick a random location on main
	// The range of valid centerX values is the total width of the number of images -1 (because it's in the center, so half of the leftmost image
	// and half of the rightmost image are outside the valid range. 
	let images = document.querySelectorAll("#area-main .slider img");
	let newLoc = Math.floor(Math.random() * (images.length - 1) * STANDARD_IMAGE_WIDTH); 
	console.log("Random location chosen: " + newLoc);
	changeArea("main", newLoc);
	setTimeout(function() {
		// Place the washing machine image in the center of the center imagebox, near the bottom
		let imgbox = getCenterImageBox();
		let washingMachine = document.querySelector('#washingMachine');
		imgbox.insertBefore(washingMachine, null);
		// Don't set the top in here, CSS needs to manage that for the transition
		washingMachine.classList.replace("fadeOut", "fadeIn");
		washingMachine.classList.add("zoomOut");
		console.log("Applying fadeIn class");
		// If the washing machine is on water, it starts sinking after the level appears
		let image = imgbox.querySelector("img");
		if (image.classList.contains("water")) {
			setTimeout(function() {
				console.log("Applying sink class");
				washingMachine.classList.add("sink");
			}, 3000);
		}
		setTimeout(function() {
			console.log("Applying fadeOut class");
			washingMachine.classList.replace("fadeIn", "fadeOut");
		}, 10000);
		teleportMutex = false;
	}, TRANSITION_TIME / 2 + 100);
}

function speedUpBlackHoleSpin() {
	let blackhole = document.getElementById("blackhole");
	if (!blackhole.anim) {
		return;
	}
	const startTime = blackhole.anim.startTime;
	console.log(blackhole.style.animationDuration);
	let duration = parseInt(blackhole.style.animationDuration);
	console.log(blackhole.style.animationDuration);
	duration --;
	blackhole.style.animationDuration = duration + "s";
	blackhole.anim.startTime = startTime;
	// Do it again for as long as the zoom class is present
	if (blackhole.classList.contains("zoom")) {
		setTimeout(speedUpBlackHoleSpin, 200);
	}
}

// Respond to inputs. The arg is whether to call requestAnimationFrame - true for keyboard control, false for joystick because it's called from readGamePad
function processActions(raf = true, forceOutput = false) {
	if (processActionsMutex) {
		return;
	}
	processActionsMutex = true;
	if (curArea == "space" && gravityEnabled) {
		// Apply Black Hole gravity to space
		let distanceX = centerX - BLACKHOLEX;
		let distanceY = centerY - BLACKHOLEY;
		//console.log("DistanceX: " + distanceX + " DistanceY: " + distanceY);
		let distanceToBlackHole = Math.sqrt(distanceX ** 2 + distanceY ** 2);
		//console.log("Distance to Black Hole: " + distanceToBlackHole);
		// A 1/r^2 dropoff makes for very slow movement until you're very close, and then it's too fast. 
		// let gravityForce = BLACKHOLE_GRAVITY / (distanceToBlackHole ** 2);
		// Linear looks better
		let gravityForce = BLACKHOLE_GRAVITY / distanceToBlackHole;
		//console.log("Gravity Force: " + gravityForce);
		// Find the angle
		let angle = Math.atan((centerY - BLACKHOLEY) / (centerX - BLACKHOLEX)); // tantheta = O/A 
		//console.log("Angle: " + angle);
		// Calculate X and Y components of the force
		let gravityX = gravityForce * Math.cos(angle);
		let gravityY = gravityForce * Math.sin(angle);
		//console.log("Gravity X: " + gravityX + " Y: " + gravityY);
		centerX -= gravityX;
		// The blackhole is as far left as we can go anyway
		if (centerX < BLACKHOLEX) {
			centerX = BLACKHOLEX;
		}
		// However, it's somewhere in the middle Y-wise. We want to grab it if we're close *and* at the right X value,
		// so we don't go shooting past it.
		if (centerX == BLACKHOLEX && Math.abs(centerY - BLACKHOLEY) < gravityY) {
			centerY = BLACKHOLEY;
		} else {
			centerY -= gravityY;
		}
		move();
		if (Math.abs(centerX - BLACKHOLEX) < 2 && Math.abs(centerY - BLACKHOLEY) < 2) {
			// Zoom into black hole
			let blackhole = document.getElementById("blackhole");
			blackhole.classList.add('zoom'); 
			// The zoom effect is done in JS instead of CSS, so that it doesn't interfere with the rotation
			// The CSS 
			// 	animation-composition: add 
			// didn't seem to work. Changing the class does work, if you include the rotation effect as well,
			// but all the parameters need to be the same. I wanted to try speeding up the rotation - though
			// that has its own problems.
			blackhole.anim = blackhole.animate([
				{ transform: "scale(1)", }, { transform: "scale(12)", } 
			], {
				duration: 5000,
				easing: "cubic-bezier(1,0,.96,.64)",
				fill: "forwards",
				composite: "add", // add to the rotation effect instead of overriding it
			});
			// Hyperspace
			let hyperspaceCircle = document.getElementById('hyperspaceCircle');
			let slider = document.querySelector('#area-space .xyslider');
			let circles = [];
			for (let i = 3; i < 17; i++) {
				let el = hyperspaceCircle.cloneNode();
				el.id = "";
				slider.insertBefore(el, null);
				el.style.animationDelay = 2/i + "s";
				circles.push(el);
			}
			setTimeout(function() {
				for (let el of circles) {
					el.classList.add("hyperspaceCircle");
					el.classList.add("zoom");
					el.classList.remove("hidden");
				}
			}, 3500);
			setTimeout(function() {
				// Remove the copies, which have class hyperspaceCircle rather than id hyperspaceCircle 
				for (let el of circles) { 
					el.remove(); 
				}
			}, 8000);

				
			// Gradually speed up the rotation without restarting the animation, until the zoom class is removed
			// This doesn't work of course because it makes the rotation jump to where it would have been if it
			// had had this duration all along. We'd need to do maths to try to figure out which frame we're supposed
			// to be on. Never mind.
			//setTimeout(speedUpBlackHoleSpin, 200);

			setTimeout(function() {
				// Exit to a random location on main
				teleport();
				processActionsMutex = false;
			}, 5000);
			setTimeout(function() {
				// Reset the black hole
				blackhole.classList.remove('zoom'); 
				if (blackhole.anim) {
					blackhole.anim.cancel();
				}
			}, 8000);
				
			return;
		}
		forceOutput = true; // Ensure exit arrows are updated as we move
	}

	// If inputs are currently blocked there won't be anything else to do, so set raf if required and return
	if (inputsBlocked) {
		if (raf) {
			setTimeout(function () {
				rAF(processActions);
			}, 20);
		}
		processActionsMutex = false;
		return;
	}

	// Keep track of progress through Konami. To ensure that only discrete movements advance the pattern,
	// we only step to the next one when entering the correct state from a "nothing pressed" state
	if (wasIdle) {
		if (isOn[KONAMI_CODE[konamiPos]]) {
			console.log("Konami Pos is " + konamiPos);
			if (konamiPos == 9) {
				// Got the code!
				easterEgg();
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
	}
	if (anyInputOn || forceOutput) {
		dbgOut = "";
		dbgOut += "Area: " + curArea;
		dbgOut += "<br>centerX: " + centerX;
		dbgOut += "<br>centerY: " + centerY;

		// Handle left/right movement
		if (isOn[LEFT]) {
			// Left (or is it right?)
			if (reverseLeftRight) {
				moveRight();
			} else {
				moveLeft();
			}
		}
		// This is not an else, so that left and right cancel
		// out when both are pressed, rather than left dominating
		if (isOn[RIGHT]) {
			if (reverseLeftRight) {
				moveLeft();
			} else {
				moveRight();
			}
		}
		if (reverseLeftRight) {
			dbgOut += "<br><em>L/R Reversed</em>";
		}

		// No else here, because we can also exit from space via the DOWN direction, if we are 
		// at the bottom (and it's in horizontal range)
		// other areas use up/down for transitions to other areas
		// Find out if we are near a transition point
		calculatePermittedVertical();
		// Are we actually moving up or down?
		let destArea, destX;
		let direction = 0;
		// Because exiting from space requires holding DOWN to get to the bottom of the image first, we can't require wasIdle
		if (permittedVertical[DOWN] && isOn[DOWN] && (curArea == "space" || wasIdle)) {
			console.log("Going down");
			destArea = permittedVertical[DOWN][0];
			destX = permittedVertical[DOWN][1];
			direction -= 1;
		}
		// No else here, so that simultaneous up and down cancel
		// instead of down dominating
		// Again, undersea doesn't require being idle because we want to exit from holding up
		if (permittedVertical[UP] && isOn[UP] && (curArea == "undersea" || wasIdle)) {
			console.log("Going up");
			destArea = permittedVertical[UP][0];
			destX = permittedVertical[UP][1];
			direction += 1;
		}
		if (direction != 0) {
			changeArea(destArea, destX);
		} else if (HEIGHT[curArea]) {
			// XY areas also allow up/down movement within the area. Do this only if no exit was taken.
			if (isOn[UP]) {
				moveUp();
			}
			// No else here, so that simultaneous up and down cancel instead of down dominating
			if (isOn[DOWN]) {
				moveDown();
			}
		}
		wasIdle = false;
		// Output the debug messages only if they've changed
		dbg(dbgOut);

	}

	// If using only keyboard control, we need to loop this function so that holding a key down has the right effect
	// but with a delay or it moves much faster than the joystick. 
	if (raf) {
		clearTimeout(raftimer);
		if (!HEIGHT[curArea]) {
			// When using up and down for area transitions, we don't want them to repeat, so inject a keyup.
			if (isOn[UP]) {
				keyup({ code: "ArrowUp", preventDefault: () => { } });
			} else if (isOn[DOWN]) {
				keyup({ code: "ArrowDown", preventDefault: () => { } });
			}
		}
		raftimer = setTimeout(function () {
			rAF(processActions);
		}, 20); // It loops too fast otherwise
	}
	processActionsMutex = false;
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

// As we have preloaded the "end" image to the left of the start image for wrapping purposes,
// jump to the start position (and fade in)
changeArea("main", 1000);


#!/bin/sh
## Launch browser in Kiosk mode

PATH=/bin:/usr/bin

URL=https://shadow.test.uniqcode.com/
# URL=file:///home/pi/shadow/index.html

# CHROMIUM="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
CHROMIUM="chromium-browser"
CHROMIUM_TMPDIR="/tmp/chromium"
mkdir -p $CHROMIUM_TMPDIR 2>/dev/null

## Disable screensaver
xset -dpms
xset s off
xset s noblank

## Disable mouse cursor
unclutter &

"$CHROMIUM" --kiosk --disable-infobars --no-first-run --disable-java \
--window-size=1920,1080 \
--window-position=0,0 \
--noerrdialogs --disable-translate \
--disable-session-storage --disable-plugins --disable-plugins-discovery --disable-sync \
--enable-features=OverlayScrollbar,OverlayScrollbarFlashAfterAnyScrollUpdate,OverlayScrollbarFlashWhenMouseEnter \
--disable-features=TranslateUI \
--disk-cache-size=0 --disk-cache-dir=/dev/null \
--safebrowsing-disable-auto-update \
--user-data-dir=/tmp/chromium/ \
--incognito \
--app="$URL"


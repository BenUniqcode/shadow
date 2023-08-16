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

"$CHROMIUM" --kiosk --disable-infobars --no-first-run --disable-java --disable-plugins \
--enable-features=OverlayScrollbar,OverlayScrollbarFlashAfterAnyScrollUpdate,OverlayScrollbarFlashWhenMouseEnter \
--disk-cache-size=1048576 --disk-cache-dir=$CHROMIUM_TMPDIR \
--safebrowsing-disable-auto-update \
--user-data-dir=/tmp/chromium/ \
--app=$URL


#copy this to pvf dir and run it
SCRIPT_DIR=$(cd $(dirname $0); pwd)
(cd "$SCRIPT_DIR" && zip -0r - ./*) > "$(basename $SCRIPT_DIR).psf"
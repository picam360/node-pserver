#!/bin/bash
#
#usage : source setup_volta.sh
#

if hash volta 2>/dev/null; then
    echo "volta is already installed."
else
    sudo apt-get -y install curl

    curl https://get.volta.sh | bash
    export VOLTA_HOME="$HOME/.volta"
    export PATH="$VOLTA_HOME/bin:$PATH"
    echo VOLTA_HOME="$VOLTA_HOME"
    echo PATH="$PATH"
    volta install node@22.10.0
    node -v
    npm -v
    echo "volta has been installed."
fi
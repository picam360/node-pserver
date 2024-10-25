#!/bin/bash
#
#usage : source setup_nodebrew.sh
#

if hash nodebrew 2>/dev/null; then
    echo "nodebrew is already installed."
else
    sudo apt-get -y install curl

    curl -L git.io/nodebrew | perl - setup
    echo "export PATH=$HOME/.nodebrew/current/bin:\$PATH" >> $HOME/.bashrc
    export PATH=$HOME/.nodebrew/current/bin:$PATH
    sed -i -z "s/} elsif (\$machine =~ m\/aarch64\/) {\n        \$arch = 'armv7l';/} elsif (\$machine =~ m\/aarch64\/) {\n        \$arch = 'arm64'/g" $HOME/.nodebrew/nodebrew
    nodebrew install v22.10.0 && nodebrew use v22.10.0
fi
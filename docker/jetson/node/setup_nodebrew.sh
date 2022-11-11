#!/bin/bash

if hash nodebrew 2>/dev/null; then
    echo "nodebrew is already installed."
    exit 0
fi

curl -L git.io/nodebrew | perl - setup
echo "export PATH=$HOME/.nodebrew/current/bin:\$PATH" >> $HOME/.bashrc
export PATH=$HOME/.nodebrew/current/bin:\$PATH
sed -i -z "s/} elsif (\$machine =~ m\/aarch64\/) {\n        \$arch = 'armv7l';/} elsif (\$machine =~ m\/aarch64\/) {\n        \$arch = 'arm64'/g" $HOME/.nodebrew/nodebrew
nodebrew install v14.17.1 && nodebrew use v14.17.1
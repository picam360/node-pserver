#!/bin/bash

PSERVER_VERSION=$1
if sudo docker image inspect pserver:${PSERVER_VERSION} 1> /dev/null 2>/dev/null; then
    echo "pserver:${PSERVER_VERSION} found"
else
    echo "pserver:${PSERVER_VERSION} not found"
    sudo docker build -t pserver:${PSERVER_VERSION} --build-arg PSERVER_VERSION=${PSERVER_VERSION} -f Dockerfile.jetson .
fi
sed -e "s/@PSERVER_VERSION@/${PSERVER_VERSION}/g" pserver.image.in | sudo tee /usr/bin/pserver
sudo chmod +x /usr/bin/pserver

xhost +
grep -qxF 'xhost +' ~/.xsessionrc || echo 'xhost +' >> ~/.xsessionrc
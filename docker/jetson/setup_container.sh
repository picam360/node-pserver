#!/bin/bash

PSERVER_VERSION=$1
CONFIG_PATH=$2
if sudo docker image inspect pserver:${PSERVER_VERSION} 1> /dev/null 2>/dev/null; then
    echo "pserver:${PSERVER_VERSION} found"
    sudo docker container rm pserver
else
    echo "pserver:${PSERVER_VERSION} not found"
    sudo docker build -t pserver:${PSERVER_VERSION} --build-arg PSERVER_VERSION=${PSERVER_VERSION} -f Dockerfile.jetson .
fi
sudo docker run -d --name pserver --runtime nvidia -p 9001:9001 -v /etc/pserver:/etc/pserver --net=host -e DISPLAY=:0 -e PULSE_SERVER=unix:${XDG_RUNTIME_DIR}/pulse/native -v ${XDG_RUNTIME_DIR}/pulse/native:${XDG_RUNTIME_DIR}/pulse/native --privileged pserver:${PSERVER_VERSION} -c ${CONFIG_PATH}
sed -e "s/@PSERVER_VERSION@/${PSERVER_VERSION}/g" pserver.container.in | sudo tee /usr/bin/pserver
sudo chmod +x /usr/bin/pserver

xhost +
grep -qxF 'xhost +' ~/.xsessionrc || echo 'xhost +' >> ~/.xsessionrc
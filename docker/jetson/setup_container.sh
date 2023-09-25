#!/bin/bash

PSERVER_VERSION=$1
CONFIG_PATH=$2

if [[ $CONFIG_PATH =~ ^/ ]]; then
    CONFIG_DIR=$(dirname $CONFIG_PATH)
else
    CONFIG_DIR=$(pwd)/$(dirname $CONFIG_PATH)
fi
CONFIG_DIR_PARAM="-v $CONFIG_DIR:$CONFIG_DIR"

if sudo docker image inspect pserver:${PSERVER_VERSION} 1> /dev/null 2>/dev/null; then
    echo "pserver:${PSERVER_VERSION} found"
    sudo docker container rm pserver
else
    echo "pserver:${PSERVER_VERSION} not found"
    L4T_VERSION_INFO=$(dpkg-query --showformat='${Version}' --show nvidia-l4t-core)
    L4T_VERSION=${version_info%%-*}
    echo "use L4T_VERSION=${L4T_VERSION}"
    sudo docker build -t pserver:${PSERVER_VERSION} --build-arg PSERVER_VERSION=${PSERVER_VERSION} --build-arg L4T_VERSION=${L4T_VERSION} -f Dockerfile.jetson .
fi
sudo docker run -d --name pserver --runtime nvidia -p 9001:9001 $CONFIG_DIR_PARAM --net=host -e DISPLAY=:0 -e PULSE_SERVER=unix:${XDG_RUNTIME_DIR}/pulse/native -v ${XDG_RUNTIME_DIR}/pulse/native:${XDG_RUNTIME_DIR}/pulse/native -v /var/run/dbus:/var/run/dbus --privileged pserver:${PSERVER_VERSION} -c ${CONFIG_PATH}
sed -e "s/@PSERVER_VERSION@/${PSERVER_VERSION}/g" pserver.container.in | sudo tee /usr/bin/pserver
sudo chmod +x /usr/bin/pserver

xhost +
grep -qxF 'xhost +' ~/.xsessionrc || echo 'xhost +' >> ~/.xsessionrc
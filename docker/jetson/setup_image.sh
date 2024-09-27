#!/bin/bash

PSERVER_VERSION=$1
if sudo docker image inspect pserver:${PSERVER_VERSION} 1> /dev/null 2>/dev/null; then
    echo "pserver:${PSERVER_VERSION} found"
else
    echo "pserver:${PSERVER_VERSION} not found"

    if [ -z "${L4T_VERSION}" ]; then
        L4T_VERSION_INFO=$(dpkg-query --showformat='${Version}' --show nvidia-l4t-core)
        L4T_VERSION=${L4T_VERSION_INFO%%-*}
    fi
    echo "use L4T_VERSION=${L4T_VERSION}"

    if [ "${PSERVER_VERSION}" = "github" ]; then
        NODE_PSERVER_VERSION=https://github.com/picam360/node-pserver.git
    elif [[ "$PSERVER_VERSION" == github.com* ]]; then
        NODE_PSERVER_VERSION=https://${PSERVER_VERSION}
    else
        NODE_PSERVER_VERSION=node-pserver@${PSERVER_VERSION}
    fi
    echo "use NODE_PSERVER_VERSION=${NODE_PSERVER_VERSION}"

    sudo docker build -t pserver:${PSERVER_VERSION} --build-arg NODE_PSERVER_VERSION="${NODE_PSERVER_VERSION}" --build-arg NODE_PSTCORE_VERSION="${NODE_PSTCORE_VERSION}" --build-arg L4T_VERSION="${L4T_VERSION}" -f Dockerfile.jetson .
fi
sed -e "s/@PSERVER_VERSION@/${PSERVER_VERSION}/g" pserver.image.in | sudo tee /usr/bin/pserver
sudo chmod +x /usr/bin/pserver

xhost +
grep -qxF 'xhost +' ~/.xsessionrc || echo 'xhost +' >> ~/.xsessionrc
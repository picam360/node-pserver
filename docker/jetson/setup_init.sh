#!/bin/bash

PSERVER_VERSION=$1
CONFIG_PATH=$2

sudo apt-get update
sudo apt-get install -y build-essential \
                        cmake \
                        curl \
                        git \
                        nano \
                        pkg-config \
                        v4l-utils \
                        usbutils \
                        network-manager \
                        p7zip-full p7zip-rar \
                        nvidia-container-runtime nvidia-docker2
                        
sudo systemctl restart docker

bash setup_image.sh $PSERVER_VERSION
bash setup_service.sh $CONFIG_PATH

sudo sed -i 's/FAN_DEFAULT_PROFILE .*/FAN_DEFAULT_PROFILE cool/g' /etc/nvfancontrol.conf
sudo rm /var/lib/nvfancontrol/status
sudo systemctl restart nvfancontrol

sudo chmod 666 /var/run/docker.sock
#!/bin/bash

PSERVER_VERSION=$1
CONFIG_PATH=$2

sudo apt-get update
sudo apt-get -y install nano nvidia-container-runtime nvidia-docker2
bash setup_image.sh $PSERVER_VERSION
bash setup_service.sh $CONFIG_PATH

sudo sed -i 's/FAN_DEFAULT_PROFILE .*/FAN_DEFAULT_PROFILE cool/g' /etc/nvfancontrol.conf
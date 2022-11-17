#!/bin/bash

PSERVER_VERSION=$1
CONFIG_PATH=$2

sudo apt-get install nano
bash setup_image.sh $PSERVER_VERSION
bash setup_service.sh $CONFIG_PATH
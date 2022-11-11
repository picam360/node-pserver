#!/bin/bash

CONFIG_PATH=$1
sed -e "s%@CONFIG_PATH@%${CONFIG_PATH}%" pserver.service.in | sudo tee /etc/systemd/system/pserver.service
sudo systemctl daemon-reload
sudo systemctl start pserver.service
sudo systemctl enable pserver.service

xhost +
grep -qxF 'xhost +' ~/.xsessionrc || echo 'xhost +' >> ~/.xsessionrc
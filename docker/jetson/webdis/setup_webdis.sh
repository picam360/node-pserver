#!/bin/bash

sudo apt-get update
sudo apt-get -y install redis-server libevent-dev
git clone --depth=1 https://github.com/nicolasff/webdis.git
cd webdis
make 
sudo make install
cd ..
rm -rf webdis
sudo cp webdis.prod.json /etc/webdis.prod.json

CONFIG_PATH=/etc/webdis.prod.json
sed -e "s%@CONFIG_PATH@%${CONFIG_PATH}%" webdis.service.in | sudo tee /etc/systemd/system/webdis.service
sudo systemctl daemon-reload
sudo systemctl restart webdis.service
sudo systemctl enable webdis.service
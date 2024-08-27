#!/bin/bash

sudo docker pull nicolas/webdis:0.1.22
sudo cp etc/systemd/system/redis-webdis.service /etc/systemd/system/redis-webdis.service
sudo cp etc/webdis.prod.json /etc/webdis.prod.json
sudo systemctl daemon-reload
sudo systemctl restart redis-webdis.service
sudo systemctl enable redis-webdis.service
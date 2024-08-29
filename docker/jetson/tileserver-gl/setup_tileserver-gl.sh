#!/bin/bash

sudo docker pull maptiler/tileserver-gl:v4.13.0

DATA_PATH=/var/mbtiles
sed -e "s%@DATA_PATH@%${DATA_PATH}%" tileserver-gl.service.in | sudo tee /etc/systemd/system/tileserver-gl.service
sudo systemctl daemon-reload
sudo systemctl restart tileserver-gl.service
sudo systemctl enable tileserver-gl.service
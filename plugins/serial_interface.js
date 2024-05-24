
const async = require('async');
const fs = require("fs");
const os = require('os');
const { exec } = require('child_process');
const path = require('path');
const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');

var pstcore = require('node-pstcore');

var m_options = {};
var m_base_path = "./";
var PLUGIN_NAME = "ocs";

var m_target_filename = "";


const getIPAddress = (callback) => {
    const networkInterfaces = os.networkInterfaces();
    for (const interfaceName in networkInterfaces) {
        const addresses = networkInterfaces[interfaceName];
        for (const address of addresses) {
            if (address.family === 'IPv4' && !address.internal) {
                callback(address.address);
                return;
            }
        }
    }
    callback('IP_NOT_FOUND');
};

const getSSID = (callback) => {
  const platform = os.platform();
  
  let command;
  if (platform === 'win32') {
    command = 'netsh wlan show interfaces';
  } else if (platform === 'darwin') {
    command = '/System/Library/PrivateFrameworks/Apple80211.framework/Versions/Current/Resources/airport -I';
  } else if (platform === 'linux') {
    command = 'nmcli -t -f active,ssid dev wifi | egrep \'^yes:\' | cut -d\\: -f2';
  } else {
    console.log('Unsupported platform:', platform);
    return;
  }

  exec(command, (err, stdout, stderr) => {
    if (err) {
      console.error('Error executing command:', err);
      callback('ERROR_OCURED');
      return;
    }

    if (platform === 'win32') {
      const match = stdout.match(/SSID\s*:\s*(.+)/);
      if (match && match[1]) {
        callback(match[1].trim());
      } else {
        callback('SSID_NOT_FOUND');
      }
    } else if (platform === 'darwin') {
      const match = stdout.match(/ SSID: (.+)/);
      if (match && match[1]) {
        callback(match[1].trim());
      } else {
        callback('SSID_NOT_FOUND');
      }
    } else if (platform === 'linux') {
      if (stdout) {
        callback(stdout.trim());
      } else {
        callback('SSID_NOT_FOUND');
      }
    }
  });
};

const connectWifi = (ssid, password, callback) => {
  const platform = os.platform();
  let command;

  if (platform === 'win32') {
    // Windows
    command = `netsh wlan add profile filename="wifi-profile.xml" & netsh wlan connect name="${ssid}" ssid="${ssid}" interface="Wi-Fi"`;
    // Windows用のWiFiプロファイルXMLを作成
    const wifiProfile = `
      <WLANProfile xmlns="http://www.microsoft.com/networking/WLAN/profile/v1">
        <name>${ssid}</name>
        <SSIDConfig>
          <SSID>
            <name>${ssid}</name>
          </SSID>
        </SSIDConfig>
        <connectionType>ESS</connectionType>
        <connectionMode>auto</connectionMode>
        <MSM>
          <security>
            <authEncryption>
              <authentication>WPA2PSK</authentication>
              <encryption>AES</encryption>
              <useOneX>false</useOneX>
            </authEncryption>
            <sharedKey>
              <keyType>passPhrase</keyType>
              <protected>false</protected>
              <keyMaterial>${password}</keyMaterial>
            </sharedKey>
          </security>
        </MSM>
      </WLANProfile>
    `;
    require('fs').writeFileSync('wifi-profile.xml', wifiProfile);
  } else if (platform === 'darwin') {
    // macOS
    command = `networksetup -setairportnetwork en0 "${ssid}" "${password}"`;
  } else if (platform === 'linux') {
    // Linux
    command = `nmcli dev wifi connect "${ssid}" password "${password}"`;
  } else {
    console.log('Unsupported platform:', platform);
    return;
  }

  exec(command, (err, stdout, stderr) => {
    if (err || stderr) {
      console.error('Error executing command:', err, stderr);
      callback(false);
      return;
    }
    console.log('Command executed successfully');
    console.log('stdout:', stdout);
    callback(true);
  });
};

const getWifiNetworks = (callback) => {
  const platform = os.platform();
  let command;

  if (platform === 'win32') {
    // Windows
    command = 'netsh wlan show networks mode=Bssid';
  } else if (platform === 'darwin') {
    // macOS
    command = '/System/Library/PrivateFrameworks/Apple80211.framework/Versions/Current/Resources/airport -s';
  } else if (platform === 'linux') {
    // Linux
    command = 'nmcli -t -f SSID,SIGNAL dev wifi';
  } else {
    console.log('Unsupported platform:', platform);
    return;
  }

  exec(command, (err, stdout, stderr) => {
    if (err) {
      console.error('Error executing command:', err);
      return;
    }

    let networks = [];
    if (platform === 'win32') {
      // Windowsの場合のパース
      const ssidRegex = /SSID \d+ : (.+)/g;
      const signalRegex = /Signal\s*:\s*(\d+)%/g;
      let ssidMatch, signalMatch;
      while ((ssidMatch = ssidRegex.exec(stdout)) && (signalMatch = signalRegex.exec(stdout))) {
        networks.push({ ssid: ssidMatch[1], signal: parseInt(signalMatch[1]) });
      }
    } else if (platform === 'darwin') {
      // macOSの場合のパース
      const lines = stdout.split('\n').slice(1);
      lines.forEach(line => {
        const parts = line.split(/\s+/).filter(part => part !== '');
        const ssid = parts[0];
        const signal = parseInt(parts[parts.length - 1]);
        if (ssid && !isNaN(signal)) {
          networks.push({ ssid, signal });
        }
      });
    } else if (platform === 'linux') {
      // Linuxの場合のパース
      const lines = stdout.split('\n');
      lines.forEach(line => {
        const [ssid, signal] = line.split(':');
        if (ssid && signal) {
          networks.push({ ssid, signal: parseInt(signal) });
        }
      });
    }
    callback(networks);
  });
};

var self = {
    create_plugin: function (plugin_host) {
        m_plugin_host = plugin_host;
        console.log("create host plugin");
        var plugin = {
            name: PLUGIN_NAME,
            init_options: function (options) {
                m_options = options["serial_interface"];

                if(m_options && m_options.path){
                    plugin.handle_serial_interface(m_options.path);
                }
            },
            pst_started: function (pstcore, pst) {
            },
            pst_stopped: function (pstcore, pst) {
            },
            command_handler: function (cmd, conn) {
            },
            handle_serial_interface : (path) => {

                const port = new SerialPort({
                    path,
                    baudRate: 115200,
                });
                
                const parser = port.pipe(new ReadlineParser({ delimiter: '\n' }));

                function reconnect(port){
                    if(port.timeout){
                        return;
                    }
                    port.timeout = setTimeout(() => {
                        plugin.handle_serial_interface(path);
                    }, 5000);
                }
                
                port.on('open', () => {
                    console.log('Serial port opened');
                });
                port.on('close', () => {
                    console.log('Serial port closed');
                    reconnect(port);
                });
                port.on('error', (err) => {
                    console.log('Serial port error ' + err);
                    reconnect(port);
                });
                
                parser.on('data', (data) => {
                    if(data.startsWith("REQ ")){
                        var params = data.trim().split(' ');
                        switch(params[1]){
                        case "GET_IP":
                            getIPAddress((ip_address) => {
                                var res = `RES GET_IP ${ip_address}\n`;
                                port.write(res, (err) => {
                                    if (err) {
                                        return console.log('Error on write:', err.message, res);
                                    }
                                });
                            });
                            break;
                        case "GET_SSID":
                            getSSID((ssid) => {
                                var res = `RES GET_SSID ${ssid}\n`;
                                port.write(res, (err) => {
                                    if (err) {
                                        return console.log('Error on write:', err.message, res);
                                    }
                                });
                            });
                            break;
                        case "CONNECT_WIFI":
                            connectWifi(params[2], params[3], (succeeded) => {
                                var res = `RES CONNECT_WIFI ${succeeded ? "SUCCEEDED" : "FAILED"}\n`;
                                port.write(res, (err) => {
                                    if (err) {
                                        return console.log('Error on write:', err.message, res);
                                    }
                                });
                            });
                            break;
                        case "GET_WIFI_NETWORKS":
                            getWifiNetworks((list) => {
                              list.sort((a, b) => b.signal - a.signal);
                              let list_str = list.map(net => net.ssid).join(' ');
                              if (list_str.length > 500) {
                                list_str = list_str.substring(0, 500);
                                list_str = list_str.substring(0, list_str.lastIndexOf(' '));
                              }
                              var res = `RES GET_WIFI_NETWORKS ${list_str}\n`;
                              port.write(res, (err) => {
                                  if (err) {
                                      return console.log('Error on write:', err.message, res);
                                  }
                              });
                            });
                            break;
                        }
                    }
                    //console.log('Received data:', data);
                });
            }
        };
        return plugin;
    }
};
module.exports = self;
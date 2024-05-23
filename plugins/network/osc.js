
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

const networkInterfaces = os.networkInterfaces();

const getIPAddress = (callback) => {
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

var self = {
    create_plugin: function (plugin_host) {
        m_plugin_host = plugin_host;
        console.log("create host plugin");
        var plugin = {
            name: PLUGIN_NAME,
            init_options: function (options) {
                m_options = options["osc"];

                if(m_options && m_options.serial_interface){
                    plugin.handle_serial_interface(m_options.serial_interface);
                }

                m_base_path = 'userdata/pvf';
                if(options["osc"] && options["osc"]["base_path"]){
                    m_base_path = options["osc"]["base_path"] + "/";
                }else if(options["http_pvf"] && options["http_pvf"]["base_path"]){
                    m_base_path = options["http_pvf"]["base_path"] + "/";
                }

                function formatDate(date) {
                    const year = date.getFullYear();
                    const month = String(date.getMonth() + 1).padStart(2, '0');
                    const day = String(date.getDate()).padStart(2, '0');
                    const hours = String(date.getHours()).padStart(2, '0');
                    const minutes = String(date.getMinutes()).padStart(2, '0');
                    const seconds = String(date.getSeconds()).padStart(2, '0');
                
                    return `${year}-${month}-${day}_${hours}-${minutes}-${seconds}`;
                }

                var express_app = m_plugin_host.get_express_app();
                
                express_app.all('/ocs/*', function(req, res) {
                    var url = req.url.split("?")[0];
                    var query = req.url.split("?")[1];
                    var filename = url.substr(5);
                    console.log(url);
                    console.log(query);
                    console.log(filename);
                    var mime = "application/json";
                    var data = {};
                    switch(filename){
                    case "info":
                        data = {"type":"info"};
                        break;
                    case "commands/execute":
                        if(req.method == 'POST'){
                            var options = req.body;
                            switch(options.name){
                            case "camera.takePicture":
                                m_target_filename = formatDate(new Date()) + ".pvf";
                                data = {"id":m_target_filename.toString()};
                                plugin.start_stream(options.name, {
                                    "FILE_PATH" : m_base_path + m_target_filename
                                }, () => {
                                    console.log("done");
                                });
                                break;
                            case "pserver.generatePsf":
                                m_target_filename = formatDate(new Date()) + ".psf";
                                data = {"id":m_target_filename.toString()};
                                plugin.generate_psf(m_base_path + m_target_filename, options.psf_config, () => {
                                    console.log("done");
                                });
                                break;
                            default:
                                data = {"err":"unknown cmd"};
                                break;
                            }
                        }else{
                            data = {"err":"need POST request"};
                        }
                        break;
                    case "commands/status":
                        if(req.method == 'POST'){
                            var options = req.body;
                            if(options.id == m_target_filename){
                                if (fs.existsSync(m_base_path + m_target_filename)) {
                                    data = {
                                        "state" : "done",
                                        "results" : {
                                            "fileUrl" : "pvf/" + m_target_filename
                                        }
                                    };
                                }else{
                                    data = {
                                        "state" : "processing"
                                    };
                                }
                            }
                        }else{
                            data = {"err":"need POST request"};
                        }
                        break;
                    default:
                        res.writeHead(403);
                        res.end();
                        console.log("403");
                        return;
                        break;
                    }
                    var content = JSON.stringify(data);
                    res.writeHead(200, {
                        'Content-Type': mime,
                        'Content-Length': content.length,
                        'Cache-Control': 'private, no-cache, no-store, must-revalidate',
                        'Expires': '-1',
                        'Pragma': 'no-cache',
                    });
                    res.end(content);
                    console.log("200");
                });
            },
            pst_started: function (pstcore, pst) {
            },
            pst_stopped: function (pstcore, pst) {
            },
            command_handler: function (cmd, conn) {
            },
            apply_params : (str, params) => {
                if(!str){
                    return "";
                }
                for(var key in params) {
                    str = str.toString().replace(new RegExp("@" + key + "@", "g"), params[key]);
                }
                return str;
            },
            start_stream : (name, params, callback) => {
                var stream_params = null;
                if(m_options && m_options["stream_params"] && m_options["stream_params"][name]){
                    stream_params = m_options["stream_params"][name];
                }
                if(!stream_params || !stream_params[""]){
                    return;
                }
                var def = stream_params[""];
                def = plugin.apply_params(def, params);
                pstcore.pstcore_build_pstreamer(def, pst => {
                    if(!pst){
                        console.log("something wrong!", def);
                        return;
                    }
                    for(var key in stream_params) {
                        if(key === ""){
                            continue;
                        }
                        var dotpos = key.lastIndexOf(".");
                        var name = key.substr(0, dotpos);
                        var param = key.substr(dotpos + 1);
                        var value = stream_params[key];
                        value = plugin.apply_params(value, params);
                        if(!name || !param || !value){
                            continue;
                        }
                        pstcore.pstcore_set_param(pst, name, param, value);
                    }
        
                    var eob = true;
                    pstcore.pstcore_set_dequeue_callback(pst, (data)=>{
                        if(data == null){//eob
                            if(eob){//eos
                                pstcore.pstcore_destroy_pstreamer(pst);
                                if(callback){
                                    callback();
                                }
                            }else{
                                eob = true;
                            }
                        }else{
                            eob = false;
                        }
                    });
                    pstcore.pstcore_start_pstreamer(pst);
                });
            },
            generate_psf : (filepath, config, callback) => {
                var tmp_dir = filepath + ".tmp";
                fs.mkdirSync(tmp_dir);
                fs.mkdirSync(tmp_dir + "/pvf");
                fs.writeFileSync(tmp_dir + "/config.json", JSON.stringify(config));

                function copy_pvf(idx, cb){
                    if(idx >= config.points.length){
                        cb();
                        return;
                    }
                    var src = m_base_path + path.basename(config.points[idx].path);
                    var dst = tmp_dir + "/" + config.points[idx].path;
                    fs.copyFile(src, dst, (err) => {
                        if (err) {
                            console.error('error', err);
                        }
                        copy_pvf(idx + 1, cb);
                    });
                }
                copy_pvf(0, () => {const { spawn } = require('child_process');
                    const cmd = `(cd ${tmp_dir} && zip -0r - ./*) > ${filepath + ".zip"}`;
                    exec(cmd, (error, stdout, stderr) => {
                        if (error) {
                          console.error(`error: ${error.message}`);
                          return;
                        }

                        console.log(`done ${cmd}`);
                        fs.renameSync(filepath + ".zip", filepath);
                        if(callback){
                            callback();
                        }
                    });
                });
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
                        }
                    }
                    console.log('Received data:', data);
                });
            }
        };
        return plugin;
    }
};
module.exports = self;
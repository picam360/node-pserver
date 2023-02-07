const { spawn, execSync } = require('child_process');

var fs = require("fs");
var sprintf = require('sprintf-js').sprintf;

var pstcore = require('node-pstcore');

var options = {};
var PLUGIN_NAME = "acs";

const chan_start = 1;
const chan_end = 13;
const nmcli_path = "/usr/bin/nmcli";

function getLeastUsedChannel() {
  return new Promise((resolve, reject) => {
    const nmcli = spawn(nmcli_path, ['-t', '-f', 'CHAN,SIGNAL', 'dev', 'wifi', 'list']);

    let stdout = '';
    nmcli.stdout.on('data', data => {
      stdout += data.toString();
    });

    nmcli.on('close', code => {
      if (code === 0) {
        const lines = stdout.split('\n');
        const channelSignal = {};
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].length > 0) {
            const [channel, signal] = lines[i].split(':');
            if (!(channel in channelSignal)) {
              channelSignal[channel] = [signal];
            } else {
              channelSignal[channel].push(signal);
            }
          }
        }
        const channelSignal2 = {};
        for (let i = chan_start; i <= chan_end; i++) {
            if (!(i in channelSignal)) {
                channelSignal2[i] = 0;
            }else{
                channelSignal2[i] = Math.max(...channelSignal[i].map(x => parseInt(x, 10)));
            }
        }
        const channelSignal3 = {};
        for (let i = chan_start; i <= chan_end; i++) {
            let m3 = ((i-3 in channelSignal2) ? channelSignal2[i-3] : 0);
            let m2 = ((i-2 in channelSignal2) ? channelSignal2[i-2] : 0);
            let m1 = ((i-1 in channelSignal2) ? channelSignal2[i-1] : 0);
            let c = ((i in channelSignal2) ? channelSignal2[i] : 0);
            let p1 = ((i+1 in channelSignal2) ? channelSignal2[i+1] : 0);
            let p2 = ((i+2 in channelSignal2) ? channelSignal2[i+2] : 0);
            let p3 = ((i+3 in channelSignal2) ? channelSignal2[i+3] : 0);
            channelSignal3[i] = m3*0.05 + m2*0.1 + m1*0.2 + 0.4*c + p1*0.2 + p2*0.1 + p2*0.05;
        }
        let leastUsedChannel;
        let leastUsedSignal = Number.MAX_SAFE_INTEGER;
        for (let i = chan_start; i <= chan_end; i++) {
          if (channelSignal3[i] < leastUsedSignal) {
            leastUsedChannel = i;
            leastUsedSignal = channelSignal3[i];
          }
        }
        resolve([leastUsedChannel, channelSignal3]);
      } else {
        reject(`nmcli process exited with code ${code}`);
      }
    });
  });
}

function trafic(iface){
    try {
        const data = execSync(`cat /proc/net/dev | grep ${iface}`).toString();

        const words = data.trim().split(/\s+/);
        const receive = parseInt(words[1], 10);
        const transmit = parseInt(words[9], 10);
        return receive + transmit;
    } 
    catch (error) {
        console.error(error);
        return -1;
    }
}

var self = {
    create_plugin: function (plugin_host) {
        console.log("create host plugin");
        var plugin = {
            name: PLUGIN_NAME,
            init_options: function (_options) {
                options = _options;
                
                const acs = () => {
                    let hotspot_exists = true;
                    try {
                        execSync(`${nmcli_path} con show | grep "hotspot"`).toString();
                    } 
                    catch (error) {
                        hotspot_exists = false;
                    }
                    if(!hotspot_exists){//suspend
                        return;
                    }
                    const trafic_s = trafic("wlan0");
                    if(trafic_s < 0){//fail safe
                        return;
                    }
                    const check_trafic_sec = 10;
                    setTimeout(() => {
                        const trafic_e = trafic("wlan0");
                        const trafic_bps = (trafic_e - trafic_s) * 8 / check_trafic_sec;
                        if(trafic_bps > (options.acs_trafic_busy_kbps || 100) * 1000){//default 100kbps
                            return;
                        }
                        try {
                            console.log("start acs");
                            execSync(`${nmcli_path} con down hotspot`);
                        } 
                        catch (error) {
                            console.error(error);
                        }
                        
                        setTimeout(() => {
                            getLeastUsedChannel().then(([chan, signals]) => {
                                try {
                                    const chan_cur = execSync(`${nmcli_path} -t conn show hotspot | grep 802-11-wireless.channel: | sed -e 's/802-11-wireless.channel:\\(.*\\)/\\1/g'`).toString().trim();
                                    
                                    if(signals[chan] < signals[chan_cur]){
                                        execSync(`${nmcli_path} con mod hotspot 802-11-wireless.channel ${chan}`);
                                        console.log(`change channel ${chan_cur} to ${chan}`);
                                    }else{
                                        console.log(`current channel ${chan_cur} is suitable`);
                                    }
                                } 
                                catch (error) {
                                    console.error(error);
                                }
                                finally{
                                    execSync(`${nmcli_path} con up hotspot`);
                                    console.log("finish acs");
                                }
                            }).catch(error => {
                                console.error(error);
                                execSync(`${nmcli_path} con up hotspot`);
                            });
                        }, (options.acs_scan_sec || 10) * 1000);
                    }, check_trafic_sec * 1000);
                };
                setTimeout(() => {
                    acs();
                    if(options.acs_interval_min){
                        setInterval(acs, options.acs_interval_min * 60 * 1000);
                    }
                }, (options.acs_start_delay_sec || 10) * 1000);
                
            },
            pst_started: function (pstcore, pst) {
            },
            pst_stopped: function (pstcore, pst) {
            },
            command_handler: function (cmd) {
            },
        };
        return plugin;
    }
};
module.exports = self;
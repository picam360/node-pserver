
var async = require('async');
var fs = require("fs");
var sprintf = require('sprintf-js').sprintf;
var uuidgen = require('uuid/v4');
var EventEmitter = require('eventemitter3');
var express = require('express');
var xmlhttprequest = require('xmlhttprequest');
global.XMLHttpRequest = xmlhttprequest.XMLHttpRequest;

var pstcore = require('node-pstcore');

var rtp_mod = require("./rtp.js");
var mt_mod = require("./meeting.js");

var UPSTREAM_DOMAIN = "upstream.";
var SERVER_DOMAIN = "";
var CAPTURE_DOMAIN = UPSTREAM_DOMAIN;
var DRIVER_DOMAIN = UPSTREAM_DOMAIN + UPSTREAM_DOMAIN;
var PT_STATUS = 100;
var PT_CMD = 101;
var PT_FILE = 102;
var PT_ENQUEUE = 110;
var PT_SET_PARAM = 111;
var PT_MT_ENQUEUE = 120;
var PT_MT_SET_PARAM = 121;


var SIGNALING_HOST = "peer.picam360.com";
// var SIGNALING_HOST = "test-peer-server.herokuapp.com";
var SIGNALING_PORT = 443;
var SIGNALING_SECURE = true;

var rtp_rx_conns = [];
var cmd2upstream_list = [];
var cmd_list = [];

var upstream_info = "";
var upstream_menu = "";
var upstream_quaternion = [0, 0, 0, 1.0];
var upstream_north = 0;

var http = null;

var options = {};
var PLUGIN_NAME = "host";
var m_pvf_filepath;
var m_mt_host;

function init_data_stream(callback) {
    console.log("init data stream");

    var active_frame = null;
    var startTime = new Date();
    var num_of_frame = 0;
    var fps = 0;

    rtp_mod.send_error = function(conn, err) {
        setTimeout(function() {
            var name = "error";
            var value = err;
            var status = "<picam360:status name=\"" + name +
                "\" value=\"" + value + "\" />";
//				var pack = rtp
//					.build_packet(Buffer.from(status, 'ascii'), PT_STATUS);
//				rtp.send_packet(pack);
        }, 1000);
    }

    rtp_mod.remove_conn = function(conn) {
        for (var i = rtp_rx_conns.length - 1; i >= 0; i--) {
            if (rtp_rx_conns[i] === conn) {
                console.log("connection closed : " +
                    rtp_rx_conns[i].attr.ip);
                rtp_rx_conns.splice(i, 1);

                clearInterval(conn.attr.timer);
                clearInterval(conn.attr.timer2);
                conn.close();
                if(conn.attr.pst){

                    //TODO
                    // //let plugins know pst destroyed
                    // for (var i = 0; i < plugins.length; i++) {
                    //     if (plugins[i].pst_stopped) {
                    //         plugins[i].pst_stopped(pstcore, conn.attr.pst);
                    //         break;
                    //     }
                    // }

                    pstcore.pstcore_destroy_pstreamer(conn.attr.pst);
                    conn.attr.pst = 0;
                }
                return;
            }
        }
    };
    
    rtp_mod.add_conn = function(conn) {
        var ip;
        if (conn.peerConnection) { // webrtc
            ip = " via webrtc";
        } else {
            ip = " via websocket";
        }
        if (rtp_rx_conns.length >= 2) { // exceed client
            console.log("exceeded_num_of_clients : " + ip);
            rtp_mod.send_error(conn, "exceeded_num_of_clients");
            return;
        } else {
            console.log("connection opend : " + ip);
        }
        
        conn.frame_info = {
            stream_uuid: uuidgen(),
            renderer_uuid: uuidgen(),
            snapper_uuid: uuidgen(),
            recorder_uuid: uuidgen(),
            mode: options.frame_mode || "WINDOW",
            width: options.frame_width || 512,
            height: options.frame_height || 512,
            stream_def: options.stream_def || "h264",
            fps: options.frame_fps || 5,
            bitrate: options.frame_bitrate,
        };

        conn.attr = {
            ip: ip,
            frame_queue: [],
            fps: 5,
            latency: 1.0,
            min_latency: 1.0,
            frame_num: 0,
            tmp_num: 0,
            tmp_latency: 0,
            tmp_time: 0,
            timeout: false,
            param_pendings: [],
        };
        var rtp = rtp_mod.Rtp(conn);
        conn.rtp = rtp;
        new Promise((resolve, reject) => {
            rtp.set_callback(function(packet) {
                conn.attr.timeout = new Date().getTime();
                if (packet.GetPayloadType() == PT_CMD) {
                    var cmd = packet.GetPacketData()
                        .toString('ascii', packet.GetHeaderLength());
                    var split = cmd.split('\"');
                    var id = split[1];
                    var value = split[3].split(' ');
                    if (value[0] == "frame_mode") {
                        conn.frame_info.mode = value[1];
                        return;
                    } else if (value[0] == "frame_width") {
                        conn.frame_info.width = value[1];
                        return;
                    } else if (value[0] == "frame_height") {
                        conn.frame_info.height = value[1];
                        return;
                    } else if (value[0] == "frame_fps") {
                        conn.frame_info.fps = value[1];
                        return;
                    } else if (value[0] == "stream_def") {
                        conn.frame_info.stream_def = value[1];
                        return;
                    } else if (value[0] == "frame_bitrate") {
                        conn.frame_info.bitrate = value[1];
                        return;
                    } else if (value[0] == "ping") {
                        var status = "<picam360:status name=\"pong\" value=\"" +
                            value[1] +
                            " " +
                            new Date().getTime() +
                            "\" />";
                        var pack = rtp
                            .build_packet(Buffer.from(status, 'ascii'), PT_STATUS);
                        rtp.send_packet(pack);
                        return;
                    } else if (value[0] == "set_timediff_ms") {
                        resolve();
                    }
                }
            });
        }).then(() => {
            if(!m_mt_host){
                m_mt_host = mt_mod.MeetingHost(pstcore, options.meeting_enabled, options);
            }
            m_mt_host.add_client(rtp);

            var def;
            var need_to_set_stream_params = false;
            if(m_pvf_filepath){
                var def = "pvf_loader url=\"file:/" + m_pvf_filepath + "\"";
            }else{
                if (!options['stream_defs'] || !options['stream_defs'][conn.frame_info.stream_def]) {
                    console.log("no stream definition : " + conn.frame_info.stream_def);
                    return;
                }
                def = options['stream_defs'][conn.frame_info.stream_def];
                for(var key in options['params']) {
                    def = def.replace(new RegExp("@" + key + "@", "g"), options['params'][key]);
                }
                need_to_set_stream_params = true;
            }
            pstcore.pstcore_build_pstreamer(def, pst => {
                conn.attr.pst = pst;
                if(need_to_set_stream_params){
                    if(options['stream_params'] && options['stream_params'][conn.frame_info.stream_def]) {
                        for(var key in options['stream_params'][conn.frame_info.stream_def]) {
                            var dotpos = key.lastIndexOf(".");
                            var name = key.substr(0, dotpos);
                            var param = key.substr(dotpos + 1);
                            var value = options['stream_params'][conn.frame_info.stream_def][key];
                            for(var key in options['params']) {
                                value = value.replace(new RegExp("@" + key + "@", "g"), options['params'][key]);
                            }
                            if(!name || !param || !value){
                                continue;
                            }
                            pstcore.pstcore_set_param(conn.attr.pst, name, param, value);
    
                            var msg = sprintf("[\"%s\",\"%s\",\"%s\"]", name, param, value.replace(/"/g, '\\"'));
                            conn.attr.param_pendings.push(msg);
                        }
                    }
                    if(options['pviewer_config_ext']) {
                        fs.readFile(options['pviewer_config_ext'], 'utf8', function(err, data_str) {
                            if (err) {
                                console.log("err :" + err);
                            } else {
                                var msg = sprintf("[\"%s\",\"%s\",\"%s\"]", 
                                    "network", "pviewer_config_ext", data_str.replace(/\n/g, '\\n').replace(/"/g, '\\"'));
                                conn.attr.param_pendings.push(msg);
                            }
                        });
                    }
                }
    
                pstcore.pstcore_set_dequeue_callback(conn.attr.pst, (data)=>{
                    try{
                        if(data == null){//eob
                            var pack = rtp.build_packet(Buffer.from("<eob/>", 'ascii'), PT_ENQUEUE);
                            rtp.send_packet(pack);
                        }else{
                            conn.attr.transmitbytes += data.length;
                            //console.log("dequeue " + data.length);
                            var MAX_PAYLOAD = conn.getMaxPayload() || 16*1024;//16k is webrtc max
                            var CHUNK_SIZE = MAX_PAYLOAD - rtp_mod.PacketHeaderLength;
                            for(var cur=0;cur<data.length;cur+=CHUNK_SIZE){
                                var chunk = data.slice(cur, cur + CHUNK_SIZE);
                                var pack = rtp.build_packet(chunk, PT_ENQUEUE);
                                rtp.send_packet(pack);
                            }
                        }
                    }catch(err){
                        rtp_mod.remove_conn(conn);
                    }
                });
        
                //TODO
                // //let plugins know pst created
                // for (var i = 0; i < plugins.length; i++) {
                //     if (plugins[i].pst_started) {
                //         plugins[i].pst_started(pstcore, conn.attr.pst);
                //         break;
                //     }
                // }
        
                pstcore.pstcore_add_set_param_done_callback(conn.attr.pst, (msg)=>{
                    //console.log("set_param " + msg);
                    if(conn.attr.in_pt_set_param){//prevent loop back
                        return;
                    }
                    conn.attr.param_pendings.push(msg);
                });
                pstcore.pstcore_start_pstreamer(conn.attr.pst);
    
                rtp_rx_conns.push(conn);
    
                conn.attr.timer = setInterval(function() {
                    try{
                        var now = new Date().getTime();
                        if (now - conn.attr.timeout > 60000) {
                            console.log("timeout");
                            throw "TIMEOUT";
                        }
                        if(conn.attr.param_pendings.length > 0) {
                            var msg = "[" + conn.attr.param_pendings.join(',') + "]";
                            var pack = rtp.build_packet(Buffer.from(msg, 'ascii'), PT_SET_PARAM);
                            rtp.send_packet(pack);
                            conn.attr.param_pendings = [];
                        }
                    }catch(err){
                        rtp_mod.remove_conn(conn);
                    }
                }, 33);
                
                conn.attr.transmitbytes = 0;
                conn.attr.timer2 = setInterval(()=>{
                    if(conn.attr.transmitbytes == 0){
                        return;
                    }
                    console.log(8*conn.attr.transmitbytes/1000);
                    conn.attr.transmitbytes=0;
                },1000);
                
                rtp.set_callback(function(packet) {
                    conn.attr.timeout = new Date().getTime();
                    if (packet.GetPayloadType() == PT_ENQUEUE) {
                        console.log("PT_ENQUEUE from client");
                    }else if (packet.GetPayloadType() == PT_SET_PARAM) { // set_param
                        var str = (new TextDecoder)
                            .decode(packet.GetPayload());
                        try{
                            var list = JSON.parse(str);
                            for(var ary of list){
                                conn.attr.in_pt_set_param = true;
                                pstcore.pstcore_set_param(conn.attr.pst, ary[0], ary[1], ary[2]);
                                conn.attr.in_pt_set_param = false;
                            }
                        }catch{
                            console.log("fail parse json", str);
                        }
                    }else if (packet.GetPayloadType() == PT_CMD) {
                        var cmd = packet.GetPacketData().toString('ascii', packet
                            .GetHeaderLength());
                        var split = cmd.split('\"');
                        var id = split[1];
                        var value = split[3];
                        plugin_host.send_command(value, conn);
                        if (options.debug >= 5) {
                            console.log("cmd got :" + cmd);
                        }
                    }else{
                        m_mt_host.handle_packet(packet, rtp);
                    }
                });
            });
        });
    }
    callback(null);
}
function start_webserver(callback) { // start up websocket server
    console.log("websocket server starting up");
    var app = require('express')();
    http = require('http').Server(app);
    app
        .get('/img/*.jpeg', function(req, res) {
            var url = req.url.split("?")[0];
            var query = req.url.split("?")[1];
            var filepath = 'userdata/' + url.split("/")[2];
            console.log(url);
            console.log(query);
            console.log(filepath);
            fs
                .readFile(filepath, function(err, data) {
                    if (err) {
                        res.writeHead(404);
                        res.end();
                        console.log("404");
                    } else {
                        res
                            .writeHead(200, {
                                'Content-Type': 'image/jpeg',
                                'Content-Length': data.length,
                                'Cache-Control': 'private, no-cache, no-store, must-revalidate',
                                'Expires': '-1',
                                'Pragma': 'no-cache',
                            });
                        res.end(data);
                        console.log("200");
                    }
                });
        });
    app.get('/img/*.mp4', function(req, res) {
        var url = req.url.split("?")[0];
        var query = req.url.split("?")[1];
        var filepath = 'userdata/' + url.split("/")[2];
        console.log(url);
        console.log(query);
        console.log(filepath);
        fs.readFile(filepath, function(err, data) {
            if (err) {
                res.writeHead(404);
                res.end();
                console.log("404");
            } else {
                var range = req.headers.range // bytes=0-1
                if (!range) {
                    res.writeHead(200, {
                        "Content-Type": "video/mp4",
                        "X-UA-Compatible": "IE=edge;chrome=1",
                        'Content-Length': data.length
                    });
                    res.end(data)
                } else {
                    var total = data.length;
                    var split = range.split(/[-=]/);
                    var ini = +split[1];
                    var end = split[2] ? +split[2] : total - 1;
                    var chunkSize = end - ini + 1;
                    res.writeHead(206, {
                        "Content-Range": "bytes " + ini + "-" + end +
                            "/" + total,
                        "Accept-Ranges": "bytes",
                        "Content-Length": chunkSize,
                        "Content-Type": "video/mp4",
                    })
                    res.end(data.slice(ini, chunkSize + ini))
                }
            }
        });
    });
    app.use(express.static('www')); // this need be set
    http.listen(9001, function() {
        console.log('listening on *:9001');
    });
    callback(null);
}
function start_websocket(callback) {
    // websocket
    var WebSocket = require("ws");
    var server = new WebSocket.Server({ server: http });

    server.on("connection", dc => {
        class DataChannel extends EventEmitter {
            constructor() {
                super();
                var self = this;
                dc.on('message', function(data) {
                    self.emit('data', data);
                });
                dc.on('error', function(event) {
                    console.log(event);
                });
                dc.on('close', function(event) {
                    self.close();
                });
            }
            getMaxPayload() {
                return dc._maxPayload;
            }
            send(data) {
                if (dc.readyState != 1) {
                    return;
                }
                if (!Array.isArray(data)) {
                    data = [data];
                }
                try {
                    for (var i = 0; i < data.length; i++) {
                        dc.send(data[i]);
                    }
                } catch (e) {
                    console.log('error on dc.send');
                    this.close();
                }
            }
            close() {
                dc.close();
                console.log('WebSocket closed');
                rtp_mod.remove_conn(this);
            }
        }
        var conn = new DataChannel();
        rtp_mod.add_conn(conn);
    });
    callback(null);
}
function start_wrtc(callback) {
    // wrtc
    if (options["wrtc_enabled"]) {
        var P2P_API_KEY = "v8df88o1y4zbmx6r";
        global.Blob = "blob";
        global.File = "file";
        global.WebSocket = require("ws");
        global.window = require("wrtc");
        global.window.evt_listener = [];
        global.window.postMessage = function(message, origin) {
            console.log(message);
            var event = {
                source: global.window,
                data: message,
            };
            if (global.window.evt_listener["message"]) {
                global.window.evt_listener["message"].forEach(function(
                    callback) {
                    callback(event);
                });
            }
        };
        global.window.addEventListener = function(name, callback, bln) {
            if (!global.window.evt_listener[name]) {
                global.window.evt_listener[name] = [];
            }
            global.window.evt_listener[name].push(callback);
        }
        var key = options["wrtc_key"] || uuidgen();
        console.log("\n\n\n");
        console.log("webrtc key : " + key);
        console.log("https://picam360.github.io/pviewer/?wrtc-key=" + key);
        console.log("\n\n\n");
        var sig_options = {
            host: SIGNALING_HOST,
            port: SIGNALING_PORT,
            secure: SIGNALING_SECURE,
            key: P2P_API_KEY,
            local_peer_id: key,
            iceServers: [{
                "urls": "stun:stun.l.google.com:19302"
            },
            {
                "urls": "stun:stun1.l.google.com:19302"
            },
            {
                "urls": "stun:stun2.l.google.com:19302"
            },
            ],
            debug: options.debug || 0,
        };
        if (options.turn_server) {
            options.iceServers.push({
                urls: 'turn:turn.picam360.com:3478',
                username: "picam360",
                credential: "picam360"
            });
        }
        var Signaling = require("./signaling.js").Signaling;
        var connect = function() {
            var pc_map = {};
            var sig = new Signaling(sig_options);
            sig.connect(function() {
                sig.start_ping();
            });
            sig.onrequestoffer = function(request) {
                var pc = new global.window.RTCPeerConnection({
                    sdpSemantics: 'unified-plan',
                    iceServers: sig_options.iceServers,
                });
                pc_map[request.src] = pc;

                var dc = pc.createDataChannel('data');
                dc.onopen = function() {
                    console.log('Data channel connection success');
                    class DataChannel extends EventEmitter {
                        constructor() {
                            super();
                            var self = this;
                            this.peerConnection = pc;
                            dc.addEventListener('message', function(data) {
                                self.emit('data', Buffer.from(new Uint8Array(data.data)));
                            });
                        }
                        getMaxPayload() {
                            return dc.maxRetransmits;
                        }
                        send(data) {
                            if (dc.readyState != 'open') {
                                return;
                            }
                            if (!Array.isArray(data)) {
                                data = [data];
                            }
                            try {
                                for (var i = 0; i < data.length; i++) {
                                    dc.send(Uint8Array.from(data[i]).buffer);
                                }
                            } catch (e) {
                                console.log('error on dc.send');
                                this.close();
                            }
                        }
                        close() {
                            dc.close();
                            pc.close();
                            console.log('Data channel closed');
                        }
                    }
                    dc.DataChannel = new DataChannel();
                    rtp_mod.add_conn(dc.DataChannel);
                }

                pc.createOffer().then(function(sdp) {
                    console.log('setLocalDescription');
                    pc.setLocalDescription(sdp);
                    sig.offer(request.src, sdp);
                }).catch(function(err) {
                    console.log('failed offering:' +
                        err);
                });
                pc.onicecandidate = function(event) {
                    if (event.candidate) {
                        sig.candidate(request.src, event.candidate);
                    } else {
                        // All ICE candidates have been sent
                    }
                };
                pc.onconnectionstatechange = function(event) {
                    console.log('peer connection state changed : ' + pc.connectionState);
                    switch (pc.connectionState) {
                        case "connected":
                            // The connection has become fully connected
                            break;
                        case "disconnected":
                        case "failed":
                        case "closed":
                            console.log('peer connection closed');
                            pc.close();
                            dc.close();
                            if (dc.DataChannel) {
                                rtp_mod.remove_conn(dc.DataChannel);
                            }
                            break;
                    }
                }
            };
            sig.onanswer = function(answer) {
                if (pc_map[answer.src]) {
                    pc_map[answer.src].setRemoteDescription(answer.payload.sdp);
                }
            };
            sig.oncandidate = function(candidate) {
                if (pc_map[candidate.src] && candidate.payload.ice.candidate) {
                    pc_map[candidate.src].addIceCandidate(candidate.payload.ice);
                }
            };
            sig.onclose = function(e) {
                // console.log('Socket closed : dump error object below');
                // console.dir(e);
                setTimeout(() => {
                    console.log('Try to reconnect');
                    connect();
                }, 1000);
            };
        };
        connect();
    }
    callback(null);
}

var self = {
    create_plugin: function (plugin_host) {
        console.log("create host plugin");
        var plugin = {
            name: PLUGIN_NAME,
            init_options: function (_options) {
                options = _options;
                init_data_stream(() => {
                    start_webserver(() => {
                        start_websocket(() => {
                            start_wrtc(() => {
                                console.log("host initiation done!");
                            });
                        });
                    });
                });
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
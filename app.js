#! /usr/bin/env node
process.chdir(__dirname);
var os = require('os');
var child_process = require('child_process');
var async = require('async');
var fs = require("fs");
var moment = require("moment");
var sprintf = require('sprintf-js').sprintf;
var express = require('express');
var cors = require('cors');

var pstcore = require('node-pstcore');

var express_app = null;
var http = null;
var https = null;

var plugin_host = {};
var plugins = [];
var cmd_list = [];
var watches = [];
var statuses = [];

var upstream_info = "";
var upstream_menu = "";
var upstream_quaternion = [0, 0, 0, 1.0];
var upstream_north = 0;

var GC_THRESH = 16 * 1024 * 1024; // 16MB

var UPSTREAM_DOMAIN = "upstream.";

var options = {};
var m_pvf_filepath = null;
var m_calibrate = null;
var m_calibrate_hq = null;

function start_webserver(callback) { // start up websocket server
    console.log("websocket server starting up");
    express_app = express();
	express_app.use(cors());
	express_app.use(express.json());
    http = require('http').Server(express_app);

	var https_key_filepath = 'certs/https/localhost-key.pem';
	var https_cert_filepath = 'certs/https/localhost.pem';
	if(options['https_key_filepath'] &&
	   options['https_cert_filepath']){
		if(fs.existsSync(options['https_key_filepath']) &&
		   fs.existsSync(options['https_cert_filepath'])){
			https_key_filepath = options['https_key_filepath'];
			https_cert_filepath = options['https_cert_filepath'];
		}else{
			console.log("https key cert file not found.");
		}
	}
	var https_options = {
		key: fs.readFileSync(https_key_filepath),
		cert: fs.readFileSync(https_cert_filepath)
	};
	https = require('https').Server(https_options, express_app);

    express_app.get('/img/*.jpeg', function(req, res) {
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
    express_app.get('/img/*.mp4', function(req, res) {
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
    express_app.use(express.static('www')); // this need be set
	var http_port = 9001;
	if(options['http_port']){
		http_port = options['http_port'];
	}
    http.listen(http_port, function() {
        console.log('listening http on *:' + http_port);
    });

	var https_port = 9002;
	if(options['https_port']){
		https_port = options['https_port'];
	}
    https.listen(https_port, function() {
        console.log('listening https on *:' + https_port);
    });
    callback(null);
}

async.waterfall([
	function(callback) { // argv
		var wrtc_key = null;
		var conf_filepath = 'config.json';
		var params = {};
		for (var i = 0; i < process.argv.length; i++) {
			if (process.argv[i] == "-c") {//config
				conf_filepath = process.argv[i + 1];
				i++;
			}
			if (process.argv[i] == "-f") {//file
				m_pvf_filepath = process.argv[i + 1];
				i++;
			}
			if (process.argv[i] == "-w") {//wrtc or ws
				wrtc_key = process.argv[i + 1];
				i++;
			}
			if (process.argv[i] == "-p") {//params
				var [key, value] = process.argv[i + 1].split("=");
				params[key] = value;
				i++;
			}
			if (process.argv[i].startsWith("--calibrate=")) {
				m_calibrate = process.argv[i].split("=")[1];
			}
			if (process.argv[i].startsWith("--calibrate-hq=")) {
				m_calibrate_hq = process.argv[i].split("=")[1];
			}
		}
		if (!fs.existsSync(conf_filepath)) {
			conf_filepath = __dirname + "/" + conf_filepath;
		}
		if (fs.existsSync(conf_filepath)) {
			console.log("load config file : " + conf_filepath);
			
			var lines = fs.readFileSync(conf_filepath, 'utf-8').replace(/\r/g, '').split('\n')
			for(var i=0;i<lines.length;i++){
				if(lines[i][0] == '#'){
					lines[i] = "";
				}
			}
			var json_str = lines.join("\n");
			options = JSON.parse(json_str);
		} else {
			options = {};
		}
		if(wrtc_key){
			options["wrtc_enabled"] = true;
			options["wrtc_key"] = wrtc_key;
		}
		options["params"] = Object.assign(options["params"]||{}, params);

		callback(null);
	},
	function(callback) { // exit sequence
		function cleanup() {
		}
		process.on('uncaughtException', (err) => {
			cleanup();
			throw err;
		});
		process.on('SIGINT', function() {
			cleanup();
			console.log("exit process done");
			process.exit();
		});
		process.on('SIGUSR2', function() {
			if (agent.server) {
				agent.stop();
			} else {
				agent.start({
					port: 9999,
					bind_to: '192.168.3.103',
					ipc_port: 3333,
					verbose: true
				});
			}
		});
		callback(null);
	},
	function(callback) {
		if(options["license"] && options["license"]["app_key"]){
			console.log("init license");
			var cmd = sprintf("node %s/tools/license_retriever %s %s %s %s",
				__dirname, options["license"]["app_key"], options["license"]["sku"], "license_key.json", options["license"]["iface"]);
			//console.log(cmd);
			child_process.exec(cmd);
		}
		
		callback(null);
	},
	function(callback) {
		console.log("init pstcore");
		
		pstcore.pstcore_add_log_callback((level, tag, msg) => {
			console.log(level, tag, msg);
		});

		var config_json = "";
		config_json += "{\n";
		config_json += "	\"plugin_paths\" : [\n";
		config_json += "		\"plugins/dummy_st.so\",\n";
		config_json += "		\"plugins/pvf_loader_st.so\",\n";
		config_json += "		\"plugins/psf_loader_st.so\",\n";
		config_json += "		\"plugins/libde265_decoder_st.so\",\n";
		config_json += "		\"plugins/recorder_st.so\",\n";
		config_json += "        \"plugins/tc_capture_st.so\",\n";
		config_json += "        \"plugins/nc_capture_st.so\",\n";
		config_json += "        \"plugins/dup_st.so\",\n";
		config_json += "        \"plugins/dealer_st.so\",\n";
		config_json += "        \"plugins/suspender_st.so\",\n";
		if(process.platform === 'darwin') {
			config_json += "		\"plugins/vt_decoder_st.so\",\n";
			config_json += "        \"plugins/oal_capture_st.so\",\n";
			config_json += "        \"plugins/oal_player_st.so\",\n";
			config_json += "        \"plugins/opus_encoder_st.so\",\n";
			config_json += "        \"plugins/opus_decoder_st.so\",\n";
		}else if(process.platform === 'linux') {
			config_json += "        \"plugins/pcuda_remapper_st.so\",\n";
			config_json += "        \"plugins/v4l2_capture_st.so\",\n";
			config_json += "        \"plugins/mjpeg_tegra_decoder_st.so\",\n";
			config_json += "        \"plugins/v4l2_tegra_encoder_st.so\",\n";
			config_json += "        \"plugins/mux_st.so\",\n";
			config_json += "        \"plugins/demux_st.so\",\n";
			config_json += "        \"plugins/oal_capture_st.so\",\n";
			config_json += "        \"plugins/oal_player_st.so\",\n";
			config_json += "        \"plugins/opus_encoder_st.so\",\n";
			config_json += "        \"plugins/opus_decoder_st.so\",\n";
			config_json += "        \"plugins/icm20948_st.so\",\n";
			config_json += "        \"plugins/pantilt_st.so\",\n";
			config_json += "        \"plugins/amimon_tx_st.so\",\n";
			config_json += "        \"plugins/amimon_rx_st.so\",\n";
			config_json += "        \"plugins/ptpvf_generator_st.so\",\n";
		}else if(process.platform === 'win32') {
			config_json += "        \"plugins/pcuda_remapper_st.so\",\n";
			config_json += "        \"plugins/mjpeg_decoder_st.so\",\n";
			config_json += "        \"plugins/mux_st.so\",\n";
			config_json += "        \"plugins/demux_st.so\",\n";
		}
		config_json += "		\"plugins/pgl_renderer_st.so\",\n";
		config_json += "		\"plugins/pgl_remapper_st.so\",\n";
		config_json += "		\"plugins/pgl_calibrator_st.so\",\n";
		config_json += "		\"plugins/pipe_st.so\"\n";
		config_json += "	]\n";
		config_json += "}\n";
		pstcore.pstcore_init(config_json);
		
		setInterval(() => {
			pstcore.pstcore_poll_events();
		}, 33);
		
		if(m_calibrate){
			var [size_, device] = m_calibrate.split(":");
			var [size, framerate] = size_.split("@");
			var framerate_str = framerate ? " -r " + framerate : "";
			var def = "pipe name=capture t=I420 s=" + size + " ! pgl_calibrator w=1024 h=512";
			//var def = "tc_capture name=capture debayer=1 expo=20000 gain=1000 binning=2 ! pgl_calibrator w=1024 h=512";
			pstcore.pstcore_build_pstreamer(def, (pst) => {
				if(process.platform==='darwin'){
					var pipe_def = "/usr/local/bin/ffmpeg -f avfoundation -s @OWIDTH@x@OHEIGHT@" + framerate_str + " -i \""
									 + device + "\" -f rawvideo -pix_fmt yuv420p -";
					pstcore.pstcore_set_param(pst, "capture", "def", pipe_def);
	
					var meta = "<meta maptype=\"FISH\" lens_params=\"file://lens_params.json\" />";
					pstcore.pstcore_set_param(pst, "capture", "meta", meta);
				}
				else if(process.platform==='linux'){
					var pipe_def = "ffmpeg -f video4linux2 -s @OWIDTH@x@OHEIGHT@" + framerate_str + " -i \""
									 + device + "\" -f rawvideo -pix_fmt yuv420p -";
					pstcore.pstcore_set_param(pst, "capture", "def", pipe_def);
	
					var meta = "<meta maptype=\"FISH\" lens_params=\"file://lens_params.json\" />";
					pstcore.pstcore_set_param(pst, "capture", "meta", meta);
				}
				else if(process.platform==='win32'){
					var pipe_def = "ffmpeg -f dshow -s @OWIDTH@x@OHEIGHT@" + framerate_str + " -i video=\""
									 + device + "\" -f rawvideo -pix_fmt yuv420p -";
					pstcore.pstcore_set_param(pst, "capture", "def", pipe_def);
	
					var meta = "<meta maptype=\"FISH\" lens_params=\"file://lens_params.json\" />";
					pstcore.pstcore_set_param(pst, "capture", "meta", meta);
				}
				pstcore.pstcore_start_pstreamer(pst);
				//don't call callback(null);
			});
		}else if(m_calibrate_hq){
			var def = "nc_capture name=capture debayer=1 expo=20000 gain=1000 binning=0 ! pgl_calibrator w=1024 h=512";
			pstcore.pstcore_build_pstreamer(def, (pst) => {
				var meta = "<meta maptype=\"FISH\" lens_params=\"file://lens_params.json\" />";
				pstcore.pstcore_set_param(pst, "capture", "meta", meta);
	
				pstcore.pstcore_start_pstreamer(pst);
				//don't call callback(null);
			});
		}else{
			callback(null);
		}
	},
	function(callback) { // gc
		console.log("gc");
		if(process.platform === 'win32') {
		}else if(process.platform === 'darwin') {
		}else if(process.platform === 'linux') {
			var disk_free = 0;
			setInterval(function() {
				disk.check('/tmp', function(err, info) {
					disk_free = info.available;
				});
			}, 1000);
			setInterval(function() {
				if (global.gc && os.freemem() < GC_THRESH) {
					console.log("gc : free=" + os.freemem() + " usage=" +
						process.memoryUsage().rss);
					console.log("disk_free=" + disk_free);
					global.gc();
				}
			}, 100);
		}
		callback(null);
	},
	function(callback) {
		// plugin host
		var m_view_quaternion = [0, 0, 0, 1.0];
		// cmd handling
		function command_handler(value, callback, ext) {
			var split = value.split(' ');
			var domain = split[0].split('.');
			if (domain.length != 1 && domain[0] != "pserver") {
				// delegate to plugin
				for (var i = 0; i < plugins.length; i++) {
					if (plugins[i].name && plugins[i].name == domain[0]) {
						if (plugins[i].command_handler) {
							split[0] = split[0].substring(split[0].indexOf('.') + 1);
							plugins[i].command_handler(split.join(' '), callback, ext);
							break;
						}
					}
				}
				return;
			}
			if (split[0] == "ping") {
				//
			} else if (split[0] == "snap") {
				var id = conn.frame_info.snapper_uuid;
				if (id) {
					var dirname = moment().format('YYYYMMDD_HHmmss');
					var filepath = (options['record_path'] || 'Videos') + '/' + dirname;
					var cmd = CAPTURE_DOMAIN + "set_vstream_param";
					cmd += " -p base_path=" + filepath;
					cmd += " -p mode=RECORD";
					cmd += " -u " + id;
					plugin_host.send_command(cmd, callback, ext);
					console.log("snap");
				}
			} else if (split[0] == "start_record") {
				if (conn.frame_info.is_recording)
					return;
				var id = conn.frame_info.recorder_uuid;
				if (id) {
					var dirname = moment().format('YYYYMMDD_HHmmss');
					var filepath = (options['record_path'] || 'Videos') + '/' + dirname;
					var cmd = CAPTURE_DOMAIN + "set_vstream_param";
					cmd += " -p base_path=" + filepath;
					cmd += " -p mode=RECORD";
					cmd += " -u " + id;
					plugin_host.send_command(cmd, callback, ext);
					conn.frame_info.is_recording = true;
					console.log("start record");
				}
			} else if (split[0] == "stop_record") {
				var id = conn.frame_info.recorder_uuid;
				if (id) {
					var cmd = CAPTURE_DOMAIN + "set_vstream_param";
					cmd += " -p mode=IDLE";
					cmd += " -u " + id;
					plugin_host.send_command(cmd, callback, ext);
					conn.frame_info.is_recording = false;
					console.log("stop record");
				}
			}
		}
		setInterval(function() {
			if (cmd_list.length) {
				var params = cmd_list.shift();
				command_handler(params.cmd, params.callback, params.ext);
			}
		}, 20);
		plugin_host.send_command = function(cmd, callback, ext) {
			cmd_list.push({ cmd, callback, ext });
		};
		plugin_host.get_vehicle_quaternion = function() {
			return upstream_quaternion;
		};
		plugin_host.get_vehicle_north = function() {
			return upstream_north;
		};
		plugin_host.get_view_quaternion = function() {
			return m_view_quaternion;
		};
		plugin_host.add_watch = function(name, callback) {
			watches[name] = callback;
		};
		plugin_host.add_status = function(name, callback) {
			statuses[name] = callback;
		};
		plugin_host.get_http = function() {
			return http;
		};
		plugin_host.get_https = function() {
			return https;
		};
		plugin_host.get_express_app = function() {
			return express_app;
		};
		plugin_host.fire_pst_started = function(pst) {
			for (var i = 0; i < plugins.length; i++) {
				if (plugins[i].pst_started) {
					plugins[i].pst_started(pstcore, pst);
				}
			}
		};
		plugin_host.fire_pst_stopped = function(pst) {
			for (var i = 0; i < plugins.length; i++) {
				if (plugins[i].pst_stopped) {
					plugins[i].pst_stopped(pstcore, pst);
				}
			}
		};

		plugin_host.add_watch(UPSTREAM_DOMAIN + "quaternion", function(
			value) {
			var separator = (/[,]/);
			var split = value.split(separator);
			upstream_quaternion = [parseFloat(split[0]),
			parseFloat(split[1]), parseFloat(split[2]),
			parseFloat(split[3])
			];
		});

		plugin_host.add_watch(UPSTREAM_DOMAIN + "north", function(value) {
			upstream_north = parseFloat(value);
		});

		plugin_host.add_watch(UPSTREAM_DOMAIN + "info", function(value) {
			upstream_info = value;
		});

		plugin_host.add_watch(UPSTREAM_DOMAIN + "menu", function(value) {
			upstream_menu = value;
		});

		plugin_host.add_status("is_recording", function(conn) {
			return {
				succeeded: true,
				value: conn.frame_info.is_recording
			};
		});

		plugin_host.add_status("info", function() {
			return {
				succeeded: upstream_info != "",
				value: upstream_info
			};
		});

		plugin_host.add_status("menu", function() {
			return {
				succeeded: upstream_menu != "",
				value: upstream_menu
			};
		});

		callback(null);
	},
	function(callback) {
		start_webserver(() => {
			callback(null);
		});
	},
	function(callback) {
		// load plugin
		if (options["plugin_paths"]) {
			for (var k in options["plugin_paths"]) {
				var plugin_path = options["plugin_paths"][k];
				console.log("loading... " + plugin_path);
				var plugin_factory = require("./" + plugin_path);
				if(plugin_factory && plugin_factory.create_plugin){
					var plugin = plugin_factory.create_plugin(plugin_host);
					plugins.push(plugin);
				}else{
					console.log("fail... " + plugin_path);
				}
			}
			for (var i = 0; i < plugins.length; i++) {
				if (plugins[i].init_options) {
					plugins[i].init_options(options);
				}
			}
		}
		callback(null);
	},
], function(err, result) { });

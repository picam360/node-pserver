
var async = require('async');
var fs = require("fs");

var pstcore = require('node-pstcore');

var m_options = {};
var m_base_path = "./";
var PLUGIN_NAME = "live";

var m_take_picture_id = "";

var self = {
    create_plugin: function (plugin_host) {
        m_plugin_host = plugin_host;
        console.log("create host plugin");
        var plugin = {
            name: PLUGIN_NAME,
            init_options: function (options) {
                m_options = options["control"];

                m_base_path = 'userdata/pvf';
                if(options["control"] && options["control"]["base_path"]){
                    m_base_path = options["control"]["base_path"] + "/";
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
                
                express_app.all('/ctl/*', function(req, res) {
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
                                m_take_picture_id = m_base_path + formatDate(new Date()) + ".pvf";
                                data = {"id":m_take_picture_id.toString()};
                                plugin.start_stream(options.name, {
                                    "FILE_PATH" : m_take_picture_id
                                }, () => {
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
                            if(options.id == m_take_picture_id){
                                if (fs.existsSync(m_take_picture_id)) {
                                    data = {
                                        "state" : "done",
                                        "results" : {
                                            "fileUrl" : m_take_picture_id
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
        };
        return plugin;
    }
};
module.exports = self;
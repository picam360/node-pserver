
var async = require('async');
var fs = require("fs");

var options = {};
var PLUGIN_NAME = "live";

var m_take_picture_id = "";

var self = {
    create_plugin: function (plugin_host) {
        m_plugin_host = plugin_host;
        console.log("create host plugin");
        var plugin = {
            name: PLUGIN_NAME,
            init_options: function (_options) {
                options = _options;

                var base_path = 'userdata/pvf';
                if(options["http_pvf"] && options["http_pvf"]["base_path"]){
                    base_path = options["http_pvf"]["base_path"];
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
                                m_take_picture_id = "test";
                                data = {"id":m_take_picture_id.toString()};
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
                                data = {
                                    "state" : "done",
                                    "results" : {
                                        "fileUrl" : "/sample/sample.pvf"
                                    }
                                };
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
        };
        return plugin;
    }
};
module.exports = self;
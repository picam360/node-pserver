
var async = require('async');
var fs = require("fs");

var options = {};
var PLUGIN_NAME = "live";

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
                
                express_app.get('/pvf/*', function(req, res) {
                    var url = req.url.split("?")[0];
                    var query = req.url.split("?")[1];
                    var filepath = base_path + url.substr(4);
                    console.log(url);
                    console.log(query);
                    console.log(filepath);
                    var mime;
                    if(url.endsWith(".json")){
                        mime = "application/json";
                    }else if(url.endsWith(".pif")){
                        mime = "binary/octet-stream";
                    }else{
                        res.writeHead(403);
                        res.end();
                        console.log("403");
                        return;
                    }
                    fs.readFile(filepath, function(err, data) {
                        if (err) {
                            res.writeHead(404);
                            res.end();
                            console.log("404");
                        } else {
                            res.writeHead(200, {
                                'Content-Type': mime,
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
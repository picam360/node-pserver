
var async = require('async');
var fs = require("fs");
var rangeParser = require('range-parser');

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
                    if(false){//debug
                        console.log(url);
                        console.log(query);
                        console.log(filepath);
                    }
                    if (!fs.existsSync(filepath)) {
                        res.status(404).send('File not found');
                        return;
                    }
                    var mime;
                    if(url.endsWith(".json")){
                        mime = "application/json";
                    }else if(url.endsWith(".pif")){
                        mime = "binary/octet-stream";
                    }else if(url.endsWith(".pvf")){
                        mime = "binary/octet-stream";
                    }else if(url.endsWith(".pvf2")){
                        mime = "binary/octet-stream";
                    }else if(url.endsWith(".psf")){
                        mime = "binary/octet-stream";
                    }else{
                        res.writeHead(403);
                        res.end();
                        console.log("403");
                        return;
                    }

                    var fileStream = null;
                    var filesize = fs.statSync(filepath).size;
                    if (req.headers.range) {
                        var ranges = rangeParser(filesize, req.headers.range);
                        if (ranges === -1 || ranges === -2 || ranges.length === 0) {
                          res.status(416).send('Range not satisfiable');
                          return;
                        }
                        var { start, end } = ranges[0];
                        var chunkSize = (end - start) + 1;
                        fileStream = fs.createReadStream(filepath, { start, end });

                        res.writeHead(206, {
                            'Content-Type': mime,
                            'Content-Range': `bytes ${start}-${end}/${filesize}`,
                            'Accept-Ranges': 'bytes',
                            'Content-Length': chunkSize,
                            'Access-Control-Expose-Headers': 'Content-Range, Accept-Ranges, Content-Length',
                            'Cache-Control': 'private, no-cache, no-store, must-revalidate',
                            'Expires': '-1',
                            'Pragma': 'no-cache',
                        });
                    }else{
                        fileStream = fs.createReadStream(filepath);

                        res.writeHead(200, {
                            'Content-Type': mime,
                            'Content-Length': filesize,
                            'Access-Control-Expose-Headers': 'Content-Length',
                            'Cache-Control': 'private, no-cache, no-store, must-revalidate',
                            'Expires': '-1',
                            'Pragma': 'no-cache',
                        });
                    }

                    fileStream.pipe(res);
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

var fs = require("fs");
var sprintf = require('sprintf-js').sprintf;

var pstcore = require('node-pstcore');

var options = {};
var PLUGIN_NAME = "startup";

function init_pst(plugin) {
    
    if (!options['stream_defs'] || !options['stream_defs'][plugin.stream_def]) {
        console.log("no stream definition : " + plugin.stream_def);
        return;
    }

    plugin.attr = {
        pst: 0,
        param_pendings: [],
    };
    def = options['stream_defs'][plugin.stream_def];
    for(var key in options['params']) {
        def = def.replace(new RegExp("@" + key + "@", "g"), options['params'][key]);
    }
    
    pstcore.pstcore_build_pstreamer(def, pst => {
        plugin.attr.pst = pst;
        if(options['stream_params'] && options['stream_params'][plugin.stream_def]) {
            for(var key in options['stream_params'][plugin.stream_def]) {
                var dotpos = key.lastIndexOf(".");
                var name = key.substr(0, dotpos);
                var param = key.substr(dotpos + 1);
                var value = options['stream_params'][plugin.stream_def][key];
                for(var key in options['params']) {
                    value = value.replace(new RegExp("@" + key + "@", "g"), options['params'][key]);
                }
                if(!name || !param || !value){
                    continue;
                }
                pstcore.pstcore_set_param(plugin.attr.pst, name, param, value);

                var msg = sprintf("[\"%s\",\"%s\",\"%s\"]", name, param, value.replace(/"/g, '\\"'));
                plugin.attr.param_pendings.push(msg);
            }
        }
        if(options['pviewer_config_ext']) {
            fs.readFile(options['pviewer_config_ext'], 'utf8', function(err, data_str) {
                if (err) {
                    console.log("err :" + err);
                } else {
                    var msg = sprintf("[\"%s\",\"%s\",\"%s\"]", 
                        "network", "pviewer_config_ext", data_str.replace(/\n/g, '\\n').replace(/"/g, '\\"'));
                        plugin.attr.param_pendings.push(msg);
                }
            });
        }
        
        pstcore.pstcore_set_dequeue_callback(plugin.attr.pst, (data)=>{
        });
            
        pstcore.pstcore_add_set_param_done_callback(plugin.attr.pst, (msg)=>{
        });

        pstcore.pstcore_start_pstreamer(plugin.attr.pst);
    });
}

var self = {
    create_plugin: function (plugin_host) {
        console.log("create host plugin");
        var plugin = {
            name: PLUGIN_NAME,
            stream_def: "startup",
            init_options: function (_options) {
                options = _options;
                init_pst(plugin);
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
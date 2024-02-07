
var PLUGIN_NAME = "shutdown";

var self = {
    create_plugin: function (plugin_host) {
        console.log("create host plugin");
        var plugin = {
            name: PLUGIN_NAME,
            init_options: function (options) {
            },
            command_handler: function (cmd) {
                if(cmd == "execute" || cmd == "exe"){
                    console.log("shutdown required.");
                    process.exit();
                }
            },
        };
        return plugin;
    }
};
module.exports = self;
const redis = require('redis');
var PLUGIN_NAME = "redis";

var self = {
    create_plugin: function (plugin_host) {
        m_plugin_host = plugin_host;
        m_redis_client = null;
        console.log("create host plugin");
        var plugin = {
            name: PLUGIN_NAME,
            init_options: function (options) {
                m_options = options["serial_interface"];

                const client = redis.createClient({
                    host: 'localhost',
                    port: 6379,
                });
                client.on('connect', () => {
                    console.log('redis connected:');
                    m_redis_client = client;
                });
                client.on('error', (err) => {
                    console.error('redis error:', err);
                    m_redis_client = null;
                });

                m_plugin_host.get_redis_client = () => {
                    return m_redis_client;
                };
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
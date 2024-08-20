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
                m_options = options["redis"];

                const client = redis.createClient({
                    host: 'localhost',
                    port: 6379,
                });
                client.on('error', (err) => {
                    console.error('redis error:', err);
                    m_redis_client = null;
                });
                client.connect().then(() => {
                    console.log('redis connected:');
                    m_redis_client = client;
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
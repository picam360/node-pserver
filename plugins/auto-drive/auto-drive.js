module.exports = {
	create_plugin: function (plugin_host) {
		console.log("create motor plugin");

		var m_options = {};

		var plugin = {
			name: "motor",
			init_options: function (options) {
				m_options = options["motor"];
			},
			command_handler: function (cmd) {
			}
		};
		return plugin;
	}
};
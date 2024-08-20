module.exports = {
	create_plugin: function (plugin_host) {
		console.log("create motor plugin");
		var { PythonShell } = require('python-shell');

		var m_cmd_timer = 0;
		var m_duty = 50;// %
		var pyshell = new PythonShell(__dirname + '/motor.py');
		pyshell.on('message', function (message) {
			console.log("motor.py : " + message);
		});
		pyshell.send('init');

		var plugin = {
			name: "motor",
			init_options: function (options) {
				m_options = options["motor"];

				if (m_options.subscribe_redis && m_plugin_host.get_redis_client) {
					setTimeout(() => {
						const client = m_plugin_host.get_redis_client();
						if (client) {
							const subscriber = client.duplicate();
							subscriber.connect().then(() => {
								console.log('redis connected:');

								subscriber.subscribe('pserver-vehicle-control', (data, key) => {
									var params = data.trim().split(' ');
									switch (params[0]) {
										case "CMD":
											console.log(`"${data}" subscribed.`);
											plugin.command_handler(params[1]);
											break;
									}
								});
							});
						}
					}, 1000);
				}
			},
			command_handler: function (cmd) {
				var split = cmd.split(' ');
				cmd = split[0];
				pyshell.send(cmd);

				clearTimeout(m_cmd_timer);
				m_cmd_timer = setTimeout(() => {
					pyshell.send("stop");
				}, m_options.cmd_effective_period || 100);
			}
		};
		return plugin;
	}
};
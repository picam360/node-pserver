module.exports = {
	create_plugin : function(plugin_host) {
		console.log("create motor plugin");
		var {PythonShell} = require('python-shell');

		var m_duty = 50;// %
		var pyshell = new PythonShell(__dirname + '/motor.py');
		pyshell.on('message', function (message) {
			console.log("motor.py : " + message);
		});
		pyshell.send('init');

		var plugin = {
			name : "motor",
			command_handler : function(cmd) {
				var split = cmd.split(' ');
				cmd = split[0];
				pyshell.send(cmd);
			}
		};
		return plugin;
	}
};
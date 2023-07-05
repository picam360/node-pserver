module.exports = {
	create_plugin : function(plugin_host) {
		console.log("create servo plugin");
		var {PythonShell} = require('python-shell');

		var pyshell = new PythonShell(__dirname + '/servo.py');
		pyshell.on('message', function (message) {
			console.log("servo.py : " + message);
		});
		pyshell.send('init');

		var plugin = {
			name : "servo",
			command_handler : function(cmd) {
				var split = cmd.split(' ');
				cmd = split[0];
				pyshell.send(cmd);
			}
		};
		return plugin;
	}
};
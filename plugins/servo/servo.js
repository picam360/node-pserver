module.exports = {
	create_plugin : function(plugin_host) {
		console.log("create servo plugin");
		var {PythonShell} = require('python-shell');
		var m_pyshell_silent = true;

		var pyshell = new PythonShell(__dirname + '/servo.py');
		pyshell.on('message', function (message) {
			if(m_pyshell_silent){
				return;
			}
			console.log("servo.py : " + message);
		});
		pyshell.send('init');

		var Quaternion = require('quaternion');
		var m_pst = 0;

		var plugin = {
			name : "servo",
			command_handler : function(cmd) {
				var split = cmd.split(' ');
				cmd = split[0];
				pyshell.send(cmd);
			},
            pst_started: function (pstcore, pst) {
				if(m_pst){
					return;
				}

				m_pst = pst;

				pstcore.pstcore_add_set_param_done_callback(pst, (msg)=>{
					var [name, param, value] = JSON.parse(msg);
					if(param == "view_quat"){
						var quat_str = value.split(',');
						var quat = {
							x : parseFloat(quat_str[0]),
							y : parseFloat(quat_str[1]),
							z : parseFloat(quat_str[2]),
							w : parseFloat(quat_str[3]),
						};
						///console.log("servo : view_quat ", quat[0], quat[1], quat[2], quat[3]);
						var view_quat = new Quaternion(quat);
						var vec = view_quat.rotateVector([0, 1, 0]);
						if(vec[1] > 1.0 / 1.414){
							vec = view_quat.rotateVector([0, 0, 1]);
						}
						var yaw_deg = Math.atan2(vec[0], vec[2]) * 180 / Math.PI;
						//console.log("servo : yaw_deg ", yaw_deg.toFixed(0),
						//	vec[0].toFixed(3), vec[1].toFixed(3), vec[2].toFixed(3),
						//	quat.x.toFixed(3), quat.y.toFixed(3), quat.z.toFixed(3), quat.w.toFixed(3));
						var cmd = "rotate_to_" + yaw_deg.toFixed(0);
						pyshell.send(cmd);
					}
				});
            },
            pst_stopped: function (pstcore, pst) {
				if(pst == m_pst){
					m_pst = 0;
				}
            },
		};
		return plugin;
	}
};
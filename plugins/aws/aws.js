
	function(callback) {
		// aws_iot
		// need to after plugin loaded
		// wrtc could conflict in connection establishing
		if (options.aws_iot && options.aws_iot.enabled) {
			if (!options.aws_iot.client_id) {
				options.aws_iot.client_id = "picam360-" + uuidgen();
			}
			// making sure connection established
			var awsIot = require('aws-iot-device-sdk');
			var thingShadow = awsIot
				.thingShadow({
					keyPath: options.aws_iot.private_key,
					certPath: options.aws_iot.certificate,
					caPath: options.aws_iot.root_ca,
					clientId: options.aws_iot.client_id,
					region: options.aws_iot.region,
					baseReconnectTimeMs: 4000,
					keepalive: 300,
					protocol: "mqtts",
					// port: undefined,
					host: options.aws_iot.host,
					debug: options.aws_iot.debug,
				});

			thingShadow
				.on('connect', function() {
					console.log('Connected to AWS IOT.');

					for (var i = 0; i < plugins.length; i++) {
						if (plugins[i].aws_iot_conneced) {
							plugins[i]
								.aws_iot_conneced(thingShadow, options.aws_iot.thing_name);
						}
					}

					thingShadow
						.register(options.aws_iot.thing_name, {}, function() {
							for (var i = 0; i < plugins.length; i++) {
								if (plugins[i].aws_iot_registered) {
									plugins[i]
										.aws_iot_registered(thingShadow, options.aws_iot.thing_name);
								}
							}
						});
				});

			thingShadow.on('close', function() {
				console.log('close');
			});

			thingShadow.on('error', function(err) {
				console.log('Error on AWS IOT. ' + err);
			});
		}
		callback(null);
	}
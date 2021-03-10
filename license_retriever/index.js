const fs = require('fs');
var xmlhttprequest = require('xmlhttprequest');
global.XMLHttpRequest = xmlhttprequest.XMLHttpRequest;
var macaddress = require('macaddress');

var options = {};
options.app_key = process.argv[2];
options.output_path = process.argv[3];
options.iface = process.argv[4];
options.device_id = "";
options.product_name = "PICAM360_ADVANCED_FEATURE_LICENSE";

var interfaces = macaddress.networkInterfaces();
if(!interfaces[options.iface]){
	console.log("no interface : " + interfaces[options.iface]);
    process.exit(-1);
}else if(!interfaces[options.iface]["mac"]){
	console.log("no macaddress : " + interfaces[options.iface]);
    process.exit(-1);
}else{
	options.device_id = interfaces[options.iface]["mac"];
}
			
if (options.app_key == "" && fs.existsSync('config.json')) {
	console.log('loading config...');
	options = JSON.parse(fs.readFileSync('config.json', 'utf8'));
	if (!options.app_key) {
		console.log('error : no app_key in config.json');
		console.log('options:', options);
		return;
	} else if (!options.output_path) {
		console.log('error : no output_path in config.json');
		console.log('options:', options);
		return;
	}
}

var xhr = new XMLHttpRequest();
xhr.withCredentials = true;

xhr.addEventListener("readystatechange", function() {
	if (this.readyState === 4) {
		var license = JSON.parse(this.responseText);
		if (license.error) {
			console.log(license.error, license.message);
			return;
		} else if (license.license_key && license.signature) {
            if(process.platform==='win32'){
				license["iface"] = options.device_id;
			}else{
				license["iface"] = options.iface;
			}
			fs.writeFileSync(options.output_path, JSON.stringify(license, null,
					'\t'));
			console.log("succeeded!");
		} else {
			console.log("something wrong : " + this.responseText);
			return;
		}
	}
});

xhr.open("GET", "https://park.picam360.com/api/v1/" + options.app_key
		+ "/licenses/" + options.product_name + "/file/text?device_id="
		+ options.device_id);
xhr.send();
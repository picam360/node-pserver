#! /usr/bin/env node
process.chdir(__dirname);

const fs = require("fs");
const rimraf = require("rimraf");
const { execSync } = require('child_process');

try{
	if (fs.existsSync('www')) {
		rimraf.sync('www');
	}
}catch(err){
	console.log("error on rm www:" + err);
}

try{
	execSync('git clone --depth 1 https://github.com/picam360/pviewer.git www -b v0.16', {cwd : __dirname});
}catch(err){
	console.log("error on git:" + err);
}

try{
	fs.copyFileSync("www/plugins/network/signaling.js", "plugins/network/signaling.js");
	fs.copyFileSync("www/plugins/network/meeting.js", "plugins/network/meeting.js");
	fs.copyFileSync("www/plugins/network/rtp.js", "plugins/network/rtp.js");
}catch(err){
	console.log("copy files:" + err);
}

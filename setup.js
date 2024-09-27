#! /usr/bin/env node
process.chdir(__dirname);

const fs = require("fs");
const { execSync } = require('child_process');

try{
	if (fs.existsSync('www')) {
		fs.rmSync('www', {recursive:true, force:true});
	}
}catch(err){
	console.log("error on rm www:" + err);
}

try{
	execSync('git clone --depth 1 https://github.com/picam360/pviewer.git www -b v0.32', {cwd : __dirname});
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

if (process.env.NODE_PSTCORE_VERSION) {
	fs.rmSync('node_modules/node-pstcore', {recursive:true, force:true});
	if(process.env.NODE_PSTCORE_VERSION.startsWith("https")){
		execSync(`git clone --depth 1 ${process.env.NODE_PSTCORE_VERSION} node-pstcore`, {cwd : `${__dirname}/node_modules`});
		execSync(`npm install`, {cwd : `${__dirname}/node_modules/node-pstcore`});
	}else{
		execSync(`npm install node-pstcore@${process.env.NODE_PSTCORE_VERSION}`);
	}
	
    console.log(`Updated node-pstcore version to ${process.env.NODE_PSTCORE_VERSION}`);
}else{
	console.log(`Use node-pstcore original version in package.json`);
}
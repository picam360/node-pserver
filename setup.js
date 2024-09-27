#! /usr/bin/env node
process.chdir(__dirname);

const path = require('path');
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
	let node_pstcore_version = process.env.NODE_PSTCORE_VERSION;
	if(node_pstcore_version == "github"){
		node_pstcore_version = "https://github.com/picam360/node-pstcore.git";
	}
	if(node_pstcore_version.startsWith("github.com")){
		node_pstcore_version = `https://${node_pstcore_version}`;
	}
	const node_pstcore_path = path.dirname(require.resolve('node-pstcore'));
	console.log(node_pstcore_path, path.dirname(node_pstcore_path));

	fs.rmSync(node_pstcore_path, {recursive:true, force:true});
	if(node_pstcore_version.startsWith("https")){
		execSync(`git clone --depth 1 ${node_pstcore_version} node-pstcore`, {cwd : path.dirname(node_pstcore_path)});
		execSync(`npm install`, {cwd : node_pstcore_path});
	}else{
		execSync(`npm install node-pstcore@${node_pstcore_version}`);
	}
	
    console.log(`Updated node-pstcore version to ${node_pstcore_version}`);
}else{
	console.log(`Use node-pstcore original version in package.json`);
}
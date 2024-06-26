//node index.js bucket_name -1 2400 3600

const AWS = require('aws-sdk');
const fs = require('fs');

var options = {};
options.bucket = process.argv[2];
options.start = process.argv[3];
options.end = process.argv[4];
options.expires = (process.argv[5] ? parseInt(process.argv[5]) : 3600);

if(process.argv.length > 8){
  options.accessKeyId = process.argv[6];
  options.secretAccessKey = process.argv[7];
  options.region = process.argv[8];
  AWS.config.update({
    accessKeyId: options.accessKeyId,
    secretAccessKey: options.secretAccessKey,
    region: options.region
  });
}

const s3 = new AWS.S3();

const file_list = [];
file_list.push("config.json");
for (let i = options.start; i <= options.end; i++) {
  file_list.push(`${i}.pif`);
}

const links = {};

const generatePresignedUrls = async () => {
  for (var file_path of file_list) {
    const url = await s3.getSignedUrlPromise('getObject', {
      Bucket: options.bucket,
      Key: file_path,
      Expires: options.expires
    });
    links[file_path] = url;
  }

  var pvflink = {
    format : "pvflink",
    version : "1.0",
    links,
  };

  var output_path = options.bucket.replaceAll('/', '_') + '.pvflink';
  fs.writeFileSync(output_path, JSON.stringify(pvflink, null, 2));
  console.log('Generated URLs have been saved to ' + output_path);
};

generatePresignedUrls().catch((err) => console.log(err));

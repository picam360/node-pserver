const AWS = require('aws-sdk');
const fs = require('fs');

var options = {};
options.accessKeyId = process.argv[2];
options.secretAccessKey = process.argv[3];
options.region = process.argv[4];
options.bucket = process.argv[5];
options.start = process.argv[6];
options.end = process.argv[7];

AWS.config.update({
  accessKeyId: options.accessKeyId,
  secretAccessKey: options.secretAccessKey,
  region: options.region
});

const s3 = new AWS.S3();

const file_list = [];
file_list.push("config.json");
for (let i = options.start; i <= options.end; i++) {
  file_list.push(`${i}.pif`);
}

const urls = {};

const generatePresignedUrls = async () => {
  for (var file_path of file_list) {
    const url = await s3.getSignedUrlPromise('getObject', {
      Bucket: options.bucket,
      Key: file_path,
      Expires: 3600
    });
    urls[file_path] = url;
  }

  fs.writeFileSync('query.json', JSON.stringify(urls, null, 2));
  console.log('Generated URLs have been saved to query.json');
};

generatePresignedUrls().catch((err) => console.log(err));

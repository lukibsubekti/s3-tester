import { createReadStream } from 'fs';
import { writeFile } from 'fs/promises';
import { basename, join as pathJoin } from 'path';
import { get as httpGet } from 'http';
import { get as httpsGet } from 'https';
import AWS from 'aws-sdk';

interface UploadConfig {
  filePath: string;
  bucketEndpoint: string;
  bucketName: string;
  bucketAccessId: string;
  bucketSecretKey: string;
}

interface DownloadConfig {
  fileUrl: string;
  downloadDirectory: string;
}

export interface UploadResult {
  startedOn: number;
  finishedOn: number;
  duration: number;
  fileSource: string;
  fileUrl: string;
}

export interface DownloadResult {
  startedOn: number;
  finishedOn: number;
  duration: number;
  fileUrl: string;
  fileOutput: string;
}

function isUrl(str: string) {
  return typeof str === 'string' && /^http(s?)\:\/\//.test(str);
}

function isHttps(str: string) {
  if (isUrl(str)) {
    let url = new URL(str);
    return url.protocol === 'https:';
  }

  return false;
}

function getFileName(str: string) {
  let url = new URL(str);
  return basename(url.pathname);
}

function getDownloadedFileLocation(str: string, directory: string) {
  let fileName =  getFileName(str);
  if (fileName.length > 40) {
    fileName = fileName.substring(fileName.length - 40);
  }
  return pathJoin(process.cwd(), directory, 'test-' + Math.ceil(Math.random() * 1000) + fileName);
}

export function upload(
  config: UploadConfig
): Promise<UploadResult | false> {
  const s3 = new AWS.S3({
    endpoint: config.bucketEndpoint,
    accessKeyId: config.bucketAccessId,
    secretAccessKey: config.bucketSecretKey,
  });

  const result: UploadResult = {} as UploadResult;

  return new Promise((resolve, reject) => {
    // init upload parameters
    const uploadParams: AWS.S3.PutObjectRequest = {
      Bucket: config.bucketName, 
      Key: '', 
      Body: '', 
      ACL: 'public-read',
    };
    
    // configure the file stream and obtain the upload parameters
    const fileStream = createReadStream(config.filePath);
    fileStream.on('error', (err) => {
      console.error('File uploading stream error:', err);
      return resolve(false);
    });
    uploadParams.Body = fileStream;

    // set key
    let fileKey = basename(config.filePath);
    // uploadParams.Key = pathJoin('tests', '' + Math.ceil(Math.random() * 100), fileKey);
    uploadParams.Key = 'tests-' + Math.ceil(Math.random() * 1000) + '-' + fileKey;

    // call S3 to retrieve upload file to specified bucket
    result.fileSource = config.filePath;
    result.startedOn = Date.now();
    s3.upload(uploadParams, function (err, data) {
      if (err) {
        console.log('S3 uploading error:', err);
        return resolve(false);
      } 

      if (data && data.Location && data.Key) {
        let { Location: uploadedLocation, Key: uploadedKey } = data;

        result.finishedOn = Date.now();
        result.duration = result.finishedOn - result.startedOn;
        result.fileUrl = uploadedLocation;
        return resolve(result);
      }

      return resolve(false);
    });
  });
}

export function download(config: DownloadConfig): Promise<DownloadResult | false> {
  let getter = isHttps(config.fileUrl) ? httpsGet : httpGet;
  const result: DownloadResult = {} as DownloadResult;

  return new Promise((resolve, reject) => {

    result.startedOn = Date.now();
    getter(config.fileUrl, (res) => {
      // check status code
      let statusCode = res.statusCode;
      if (!statusCode || !(statusCode >= 200 && statusCode <= 302)) {
        console.error(`HTTP status code is not 2xx, 301, or 302. Status Code: ${statusCode}. URL: ${config.fileUrl}`);
        res.resume(); // to free memory
        return resolve(false);
      }

      // handle redirection
      if ([301, 302].includes(statusCode)) {
        if (res.headers.location) {
          return resolve(download({ fileUrl: res.headers.location, downloadDirectory: config.downloadDirectory }));
        } else {
          console.error('Redirection without destination');
          return resolve(false);
        }
      }

      // get body
      let buff: Buffer;
      res.on('data', (chunk) => {
        if (buff) {
          buff = Buffer.concat([buff, chunk]);
        } else {
          buff = Buffer.from(chunk);
        }
      });
      res.on('end', () => {
        result.finishedOn = Date.now();
        result.duration = result.finishedOn - result.startedOn;
        let location = getDownloadedFileLocation(config.fileUrl, config.downloadDirectory);

        writeFile(location, buff)
          .then(() => {
            return resolve({
              ...result,
              fileUrl: config.fileUrl,
              fileOutput: location,
            });
          })
          .catch((reason) => {
            console.error(reason);
            return resolve(false);
          });
      });

    }).on('error', (err) => {
      console.error('HTTP request error');
      return resolve(false);
    });
  });
}
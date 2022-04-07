import fs, { writeFile, statSync } from 'fs';
import { join as pathJoin } from 'path';
import dotenv from 'dotenv';
import { upload, UploadResult, download as downloadFile, DownloadResult } from './store';

interface StorageEnv {
  BUCKET_ENDPOINT: string;
  BUCKET_NAME: string;
  BUCKET_ACCESS_ID: string;
  BUCKET_SECRET_KEY: string;
}

interface StorageConfig {
  name: string;
  envFile: string;
  isUsed?: boolean;
}

interface FullStorageConfig extends StorageConfig {
  env: StorageEnv;
}

interface FileConfig {
  location: string;
  isUsed?: boolean;
}

interface DownloadConfig {
  fileUrl: string;
  isUsed?: boolean;
}

interface TestConfig {
  numberUpload: number;
  numberDownload: number;
  uploadResultLocation: string;
  downloadResultLocation: string;
  downloadDirectory: string;
  isUpload: boolean;
  isDownload: boolean;
}

interface Config {
  storages: StorageConfig[];
  files: FileConfig[];
  downloads: DownloadConfig[];
  test: TestConfig;
}

export async function startApp(config: Config) {
  // setup storages
  const storageConfigs: FullStorageConfig[] = config.storages
    .filter((storage) => typeof storage.isUsed === 'undefined' || storage.isUsed === true )
    .map((storage) => {
      const location = pathJoin(process.cwd(), storage.envFile);
      const env: any = dotenv.parse(fs.readFileSync(location));
      return {
        ...storage,
        env,
      };
    });

  // setup files
  const files = config.files
    .filter((file) => typeof file.isUsed === 'undefined' || file.isUsed === true)
    .map((file) => {
      const fullPath = pathJoin(process.cwd(), file.location);
      const size = statSync(fullPath).size;
      return {
        ...file,
        isUsed: true,
        fullPath,
        size,
      }
    });

  // setup downloads
  const downloads = config.downloads
    .filter((file) => typeof file.isUsed === 'undefined' || file.isUsed === true)
    .map((file) => {
      return {
        ...file,
        isUsed: true,
        downloadDirectory: config.test.downloadDirectory
      }
    });

  // perform upload test
  if (config.test.isUpload) {
    const results = [];

    // all storages
    for (let i=0; i<storageConfigs.length; i++) {
      const storage = storageConfigs[i];
      const storageResults = []; 
      
      // all files
      for (let j=0; j<files.length; j++) {
        const file = files[j];
        const fileResults = [];

        // all tests
        for (let k=0; k<config.test.numberUpload; k++) {
          const result = await upload({
            filePath: file.fullPath,
            bucketAccessId: storage.env.BUCKET_ACCESS_ID,
            bucketSecretKey: storage.env.BUCKET_SECRET_KEY,
            bucketEndpoint: storage.env.BUCKET_ENDPOINT,
            bucketName: storage.env.BUCKET_NAME,
          });

          fileResults.push(result);
        }

        const successResult = fileResults.filter((r) => r !== false);
        storageResults.push({
          fileSource: file.fullPath,
          fileSizeBytes: file.size,
          averageDuration: Math.ceil(successResult
            .map((r) => (r as UploadResult).duration)
            .reduce((a, b) => a + b) / successResult.length),
          results: fileResults,
        })
      }

      results.push({
        name: storage.name,
        results: storageResults,
      });
    }

    // save
    const resultFileName = config.test.uploadResultLocation.replace('{time}', '' + Date.now());
    const resultFilePath = pathJoin(process.cwd(), resultFileName);
    writeFile(resultFilePath, JSON.stringify(results, null, 2), (err) => {
      if(err) {
        console.error(err);
      } else {
        console.error("JSON saved to "+resultFilePath);
      }
    });
  } 

  // perform download test
  if (config.test.isDownload) {
    // all downloads
    const results = [];

    for (let i=0; i<downloads.length; i++) {
      const download = downloads[i];
      const downloadResults = [];

      for (let j=0; j<config.test.numberDownload; j++) {
        const result = await downloadFile({ fileUrl: download.fileUrl, downloadDirectory: download.downloadDirectory });

        downloadResults.push(result);
      }

      const successResult = downloadResults.filter((r) => r !== false);
      results.push({
        fileUrl: download.fileUrl,
        averageDuration: 
          Math.ceil(successResult.map((r) => (r as DownloadResult).duration).reduce((a,b) => a + b) / successResult.length),
        results: downloadResults,
      });
    }

    // save
    const resultFileName = config.test.downloadResultLocation.replace('{time}', '' + Date.now());
    const resultFilePath = pathJoin(process.cwd(), resultFileName);
    writeFile(resultFilePath, JSON.stringify(results, null, 2), (err) => {
      if(err) {
        console.error(err);
      } else {
        console.error("JSON saved to "+resultFilePath);
      }
    });
  }
}
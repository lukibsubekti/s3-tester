## Introduction

This program is used to test quality of S3-compatible storage services based on download or upload duration.

## Set Up and Run

1. Put storage configurations in separate `.env` files. For example:

    ```bash
    cp ./.env.sample ./.env.digitalocean
    ```
1. Configure `config.json` file for test, upload, and download settings.
    
    ```bash
    cp ./config.sample.json ./config.json
    ```
1. Prepare files that will be uploaded in correct directory.
1. Install dependencies and run the application
    ```bash
    yarn
    yarn build
    yarn start
    ```

## Notes
@TODO

## Configuration
@TODO
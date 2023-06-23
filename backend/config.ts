import EditorModel, { IEditorSchema, Tokens } from './src/models/environmentModel';
import { randomBytes } from 'crypto';
import UserModel from './src/models/userModel';
import { Response } from 'express';
import mongoose, { CallbackError } from 'mongoose';
import cron, { Job, scheduleJob } from 'node-schedule'

import { getLatestRelease } from './src/tools/tools';
import bcrypt from 'bcrypt';
import { backupPageLogger, logger } from './logger-init';
import { promisify } from 'util';
import { exec, spawn } from 'child_process';

class BackupHandler {
  public backupJob?: Job;
  public isEnabled: boolean = false;

  constructor() { }

  public async getBackupSettings(): Promise<IEditorSchema | null> {
    return await EditorModel.findOne({}).select(['backup']);
  }

  public async clearWholeDatabase() {
    const db = mongoose.connection.db;

    // remove all collections from all models from database
    // Get all collections
    const collections = await db.listCollections().toArray();

    // Create an array of collection names and drop each collection
    collections
      .map((collection) => collection.name)
      .forEach(async (collectionName) => {
        db.dropCollection(collectionName).then((done) => {
          if (done) {
            backupPageLogger.debug(`dropped collection ${collectionName}`);
          }
        }).catch((err) => {
          backupPageLogger.error(`failed to drop collection ${collectionName}`);
        });
      });
  }

  public async restoreBackup(file: Buffer) {

    const restoreCommand = `mongorestore
    ${process.env.MONGO_DB ? ' --db=' + process.env.MONGO_DB : ''} \
    ${process.env.MONGO_USER ? ' --username=' + process.env.MONGO_USER : ''} \
    ${process.env.MONGO_PASSWORD ? ' --password=' + process.env.MONGO_PASSWORD : ''} \
    ${process.env.MONGO_PASSWORD ? ' --authenticationDatabase=admin' : ''} \
    --archive`.replace(/\s\s+/g, ' ');

    return new Promise<boolean>((resolve, reject) => {
      const restoreProcess = spawn('sh', ['-c', restoreCommand]);

      restoreProcess.stdin.write(file);
      restoreProcess.stdin.end();

      restoreProcess.stdin.on('exit', (code, signal) => {
        if (code === 0) {
          backupPageLogger.info(`Backup restored successfully!`);
          resolve(true);
        } else {
          backupPageLogger.error(`Backup restore failed with code ${code} and signal ${signal}`);
          reject(false);
        }
      });

      restoreProcess.stdin.on('close', () => {
        backupPageLogger.info(`Backup restore closed!`);
        resolve(true);
      });

      restoreProcess.stdin.on('error', (error) => {
        backupPageLogger.error(`Backup restore failed with error: ${error}`);
        reject(false);
      });

    });
  }

  public stopBackup() {
    if (this.backupJob) {
      this.backupJob.cancel();
      this.backupJob = undefined;

      EditorModel.updateOne({}, { $set: { 'backup.enabled': false } }).then(() => {
        backupPageLogger.info(`Backup disabled!`);
      }).catch((err: CallbackError) => {
        logger.error(`Error while disabling backup!`, {
          stack: err,
        });
      });
    }
  }

  public async updateBackupState(enabled: boolean) {
    if (enabled) {
      this.startBackup();
    }
    else {
      this.stopBackup();
    }
  }

  public async updateBackupCronjob(cronjob: string) {
    if (this.backupJob) {
      // rescedule cronjob
      backupPageLogger.info(`Rescheduling backup cronjob to ${cronjob}`);
      this.backupJob.reschedule(cronjob);
    }

    EditorModel.updateOne({}, { $set: { 'backup.cronjob': cronjob } }).then(() => {
      backupPageLogger.info(`Backup cronjob updated to ${cronjob}`);
    }).catch((err: CallbackError) => {
      backupPageLogger.error(`Error while updating backup cronjob!`, {
        stack: err,
      })
    });
  }

  public async startBackup(): Promise<void> {
    // get backup settings from db
    const backupSettings = await this.getBackupSettings();

    if (backupSettings === null) {
      backupPageLogger.error('No Editorsettings settings found!');
      return;
    }

    // check if backupsettings are in db
    if (backupSettings.backup?.enabled === undefined) {
      backupPageLogger.error('No backup settings found! Creating default settings...');

      // create default backup settings
      const defaultBackupSettings = {
        enabled: false,
        cronjob: '0 0 * * *',
      };

      // save default backup settings to db
      await EditorModel.updateOne({}, { $set: { backup: defaultBackupSettings } });

      return this.startBackup();
    }
    else if (backupSettings.backup?.enabled) {
      backupPageLogger.info('Backup enabled!');

      this.backupJob = cron.scheduleJob(backupSettings.backup.cronjob ?? '0 0 * * *', async () => {
        backupPageLogger.info('Starting backup!');

        const dumpFilePath = `./backup/ABWBS_${new Date().toISOString().replaceAll(':', '-')}.dump`;
        const dumpCommand = `mongodump
        ${process.env.MONGO_DB ? ' --db=' + process.env.MONGO_DB : ''} \
        ${process.env.MONGO_USER ? ' --username=' + process.env.MONGO_USER : ''} \
        ${process.env.MONGO_PASSWORD ? ' --password=' + process.env.MONGO_PASSWORD : ''} \
        ${process.env.MONGO_PASSWORD ? ' --authenticationDatabase=admin' : ''} \
        --archive=${dumpFilePath}`.replace(/\s\s+/g, ' ');

        const dumpResult = await promisify(exec)(dumpCommand);

        if (dumpResult.stdout && dumpResult.stderr) {
          backupPageLogger.error(`Backup failed: ${dumpResult.stderr} `);
          return false;
        }

        backupPageLogger.info(`Backup succeeded: ${dumpFilePath}`);
      });
    }

    return;
  }

  // public async createBackupWithBuffer() {
  //   const dumpCommand = `mongodump
  //   ${process.env.MONGO_DB ? ' --db=' + process.env.MONGO_DB : ''} \
  //   ${process.env.MONGO_USER ? ' --username=' + process.env.MONGO_USER : ''} \
  //   ${process.env.MONGO_PASSWORD ? ' --password=' + process.env.MONGO_PASSWORD : ''} \
  //   ${process.env.MONGO_PASSWORD ? ' --authenticationDatabase=admin' : ''} \
  //   --archive`.replace(/\s\s+/g, ' ');    

  //   const dumpResult = await promisify(exec)(dumpCommand);

  //   if (!dumpResult.stdout && dumpResult.stderr) {
  //     backupPageLogger.error(`Backup failed: ${dumpResult.stderr} `);
  //     throw new Error(`Backup failed: ${dumpResult.stderr} `);
  //   }

  //   // return a buffer that is converted to base64 with the backup
  //   return Buffer.from(dumpResult.stdout).toString('utf-8');
  // }

  public async createBackupWithBuffer(): Promise<Buffer> {
    return new Promise<Buffer>((resolve, reject) => {
      const mongodumpCommand = `mongodump \
        ${process.env.MONGO_DB ? `--db=${process.env.MONGO_DB}` : ''} \
        ${process.env.MONGO_USER ? `--username=${process.env.MONGO_USER}` : ''} \
        ${process.env.MONGO_PASSWORD ? `--password=${process.env.MONGO_PASSWORD}` : ''} \
        ${process.env.MONGO_PASSWORD ? '--authenticationDatabase=admin' : ''} \
        --archive`;

      const mongodumpProcess = spawn('sh', ['-c', mongodumpCommand]);
      const buffers: Buffer[] = [];

      mongodumpProcess.stdout.on('data', (data) => {
        buffers.push(data);
      });

      mongodumpProcess.on('exit', (code, signal) => {
        if (code === 0) {
          const buffer = Buffer.concat(buffers);
          resolve(buffer);
        } else {
          logger.error(`mongodump failed with code ${code} and signal ${signal}`);
          reject(`mongodump failed with code ${code} and signal ${signal}`);
        }
      });

      mongodumpProcess.on('error', (error) => {
        logger.error(`mongodump failed with error: ${error}`);
        reject(error);
      });
    });
  }
}

class TokenHandler {
  public tokens: Tokens;
  private EditorID: mongoose.Types.ObjectId | undefined;

  constructor() {
    this.tokens = {
      SECRET_TOKEN: '',
      REFRESH_TOKEN: '',
      PERMISSON_USER: '',
      PERMISSON_ADMIN: '',
      PERMISSON_EDITOR: '',
    };

    this.getTokens().then(async () => {
      await BackupHandlerInstance.startBackup();
    });
  }

  generateNewToken = () => {
    return randomBytes(128).toString('hex');
  };

  updateUserKeys = async (newTokens: Tokens, res: Function) => {
    UserModel.updateMany(
      {
        $or: [
          { permissionID: this.tokens.PERMISSON_USER },
          { permissionID: '' },
          { permissionID: { $nin: Object.values(this.tokens) } },
        ],
      },
      { $set: { permissionID: newTokens.PERMISSON_USER } })
      .then((res) => {


        logger.info(`Updated UserKeys!`);
      })
      .catch((err: CallbackError) => {
        if (err) {
          logger.error(`Error while updating UserKeys!`, {
            stack: err,
          });

          res('USER');
        }
      }
      );

    UserModel.updateMany(
      { permissionID: this.tokens.PERMISSON_ADMIN },
      { $set: { permissionID: newTokens.PERMISSON_ADMIN } })
      .catch((err: CallbackError) => {
        logger.error(`Error while updating AdminKeys!`, {
          stack: err,
        });

        res('ADMIN');
      }
      );

    UserModel.updateMany(
      { permissionID: this.tokens.PERMISSON_EDITOR },
      { $set: { permissionID: newTokens.PERMISSON_EDITOR } })
      .catch((err: CallbackError) => {
        logger.error(`Error while updating EditorKeys!`, {
          stack: err,
        });

        res('EDITOR');
      }
      );
  };

  /**
   * @description: Updates the tokens in the database
   *
   * @param res Needed to send a response to the client
   * @returns new Tokens object
   */
  public refreshTokens = async (res: Response) => {
    const newTokens: Tokens = {
      SECRET_TOKEN: this.generateNewToken(),
      REFRESH_TOKEN: this.generateNewToken(),
      PERMISSON_USER: this.generateNewToken(),
      PERMISSON_ADMIN: this.generateNewToken(),
      PERMISSON_EDITOR: this.generateNewToken(),
    };

    await EditorModel.updateOne(
      { _id: this.EditorID },
      { $set: { tokens: newTokens } }
    );

    await this.updateUserKeys(newTokens, (permissionType: string) => {

      return res.status(400).jsonp({
        access: true,
        error: `Failed to update ${permissionType} permissions`,
        res: `Failed to update ${permissionType} permissions`,
      });
    });

    this.tokens = newTokens;

    logger.info('Keys refreshed!')
    return res.status(200).jsonp({
      access: true,
      res: 'Keys refreshed! Refresh to login again',
    });
  };

  private async checkFirstStart() {
    // get first users from db
    const users = await UserModel.find({});

    if (users.length === 0) {

      if (process.env.FIRST_USER_PASSWORD === undefined) throw new Error('No password for first user set! (process.env.FIRST_USER_PASSWORD)');

      // encrypt password
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(process.env.FIRST_USER_PASSWORD, salt);

      // create first user
      const user = new UserModel({
        forename: process.env.FIRST_USER,
        surname: '☕',
        username: process.env.FIRST_USER,
        rank: '1. IT',
        password: hashedPassword,
        permissionID: this.tokens.PERMISSON_EDITOR
      });

      await user.save();
      logger.info('Created first user!');
    }
  }

  private async getTokens() {
    await EditorModel.find({}).select(['tokens']).then(
      async (docs: Array<{ tokens?: Tokens; _id: any }>) => {
        // if no EditorSettings are found, create a new one
        if (docs.length === 0) {
          logger.info('no EditorSettings found! creating new one!')

          this.EditorID = new mongoose.Types.ObjectId();
          const newTokens: Tokens = {
            SECRET_TOKEN: this.generateNewToken(),
            REFRESH_TOKEN: this.generateNewToken(),
            PERMISSON_USER: this.generateNewToken(),
            PERMISSON_ADMIN: this.generateNewToken(),
            PERMISSON_EDITOR: this.generateNewToken(),
          };

          // Create new EditorSettingsModel
          new EditorModel<IEditorSchema>({
            _id: this.EditorID,
            tokens: newTokens,
            latest_version: await getLatestRelease(),
            backup: {
              enabled: false,
              cronjob: '0 0 * * *',
              lastBackup: new Date(),
            },
          }).save().catch((err: CallbackError) => {
            logger.error(`Error while saving new EditorSettings!`, {
              stack: err,
            });
          });

          await this.updateUserKeys(newTokens, (permissionType: string) => {
            logger.error(`Failed to update ${permissionType} permissions`, {
              stack: "",
            });
          });

          this.tokens = newTokens;
          logger.info('New Editorsettings created');
        }
        // if there are no tokens in the database, create new ones
        else if (docs[0]?.tokens?.SECRET_TOKEN === undefined) {
          logger.info('creating new Tokens');
          const newTokens: Tokens = {
            SECRET_TOKEN: this.generateNewToken(),
            REFRESH_TOKEN: this.generateNewToken(),
            PERMISSON_USER: this.generateNewToken(),
            PERMISSON_ADMIN: this.generateNewToken(),
            PERMISSON_EDITOR: this.generateNewToken(),
          };

          await EditorModel.updateOne(
            { _id: docs[0]._id },
            { $set: { tokens: newTokens } })
            .catch((err: CallbackError) => {
              if (err) {
                logger.error(`Error while creating new Tokens!`, {
                  stack: err,
                });
              }
            }
            );

          await this.updateUserKeys(newTokens, (permissionType: string) => {
            logger.error(`Failed to update ${permissionType} permissions`, {
              stack: "",
            });
          });

          this.tokens = newTokens;
          logger.info('New Tokens created');
        } else {
          this.EditorID = docs[0]._id;

          // Insert Tokens into tokens-object via for loop
          for (const key in this.tokens) {
            //@ts-ignore
            this.tokens[key] = docs[0].tokens[key];
          }

          logger.info('Tokens loaded');
        }

        await this.checkFirstStart()

      }
    )
  }

  public getConfig() {
    return {
      ...this.tokens,
      // BACKUP: {
      //   enabled: this.isEnabled,
      //   stop: this.stopBackup,
      //   start: this.startBackup,
      //   updateState: this.updateBackupState,
      //   updateCronjob: this.updateBackupCronjob,
      // },
      EDITOR_URL: process.env.EDITOR_URL,
      FRONTEND_URL: process.env.FRONTEND_URL,
      PORT: process.env.PORT || 42069,
      MONGO_URL:
        process.env.NODE_ENV === 'development'
          ? 'mongodb://127.0.0.1:27017/admin'
          : `mongodb://${process.env.MONGO_USER}:${process.env.MONGO_PASSWORD}@mongo:27017/${process.env.MONGO_DB}?authSource=admin`,
    };
  }
}


const TokenHandlerInstance = new TokenHandler();

export const BackupHandlerInstance = new BackupHandler();
export const RefreshTokens = TokenHandlerInstance.refreshTokens;
export default () => TokenHandlerInstance.getConfig();

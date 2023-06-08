import EditorModel, { IEditorSchema, Tokens } from './src/models/environmentModel';
import { randomBytes } from 'crypto';
import UserModel from './src/models/userModel';
import { Response } from 'express';
import mongoose, { CallbackError } from 'mongoose';

import { generateNewEditorKey } from './src/tools/tools';
import { logger } from './logger-init';

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
    this.getTokens();
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
            latest_version: '0.0.0',
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
      }
    )
  }

  public getConfig() {
    return {
      ...this.tokens,
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

export const RefreshTokens = TokenHandlerInstance.refreshTokens;
export default () => TokenHandlerInstance.getConfig();

import dotenv from 'dotenv';
import { expand } from 'dotenv-expand';

expand(dotenv.config());

import mongoose from 'mongoose';
import router from './routes/router';
import express from 'express';
import bodyparser from 'body-parser';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import fileUpload from 'express-fileupload';

import config from '../config';
import { logger } from '../logger-init';
import bcrypt from 'bcrypt';
import { Request, Response, NextFunction } from 'express';
import UserModel from './models/userModel';

export const app = express();
const maxFileSize = 10 * 1024 * 1024;

mongoose
  .connect(config().MONGO_URL)
  .then(async () => {
    logger.info('Connected to MongoDB!');

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
        permissionID: config().PERMISSON_EDITOR
      });

      await user.save();
      logger.info('Created first user!');
    }

  })
  .catch((err) => {
    logger.error('Connection to MongoDB failed!');
    logger.error(err);
  });

app.use(helmet());
logger.debug("Module 'helmet' initialized!");

app.use(
  fileUpload({
    limits: { fileSize: maxFileSize },
    // TODO: Add limithandler
    // limitHandler: (req, res) => {
    // 	return res.status(400).jsonp({
    // 		access: true,
    // 		error: `Filesize is too big (>${maxFileSize} bytes)`,
    // 		res: `Filesize is too big (>${maxFileSize} bytes)`,
    // 	});
    // }
  })
);
logger.debug("Module 'fileUpload' initialized!");

app.use(bodyparser.json());
/* Logging the initialization of the bodyparser module. */
logger.debug("Module 'bodyparser' initialized!");

app.use(
  cors({
    origin: [
      process.env.EDITOR_URL || 'https://rikorick.de/editor',
      process.env.FRONTEND_URL || 'https://rikorick.de/order',
      'http://localhost:5173',
      'http://localhost:4173',
    ],
  })
);
logger.debug(`Module 'cors' initialized!`);

app.use(
  rateLimit({
    windowMs: 2 * 60 * 1000, // 2 minutes
    max: 300, // Limit each IP to 300 requests per `window` (here, per 2 minutes)
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  })
);
logger.debug(`Module 'rateLimit' initialized!`);

app.use((req: Request, res: Response, next: NextFunction) => {
  const requesturl = req.originalUrl.split('/');

  if (requesturl[1] === 'customPage') requesturl[1] = 'CSTMPG';
  if (requesturl[1] === 'statistic') requesturl[1] = 'STATS';

  logger.http(`getting ${req.method} request for /${requesturl[2]}`, {
    service: requesturl[1].toUpperCase(),
    ip: req.ip,
  });
  next();
});

app.use(router);
logger.debug(`API initialized!`);

app.listen(config().PORT, () =>
  logger.info(`API is up and running on port ${config().PORT}!`)
);

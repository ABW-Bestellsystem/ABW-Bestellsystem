import { Request, Response, Router } from 'express';
import { check, validationResult } from 'express-validator';
import { CallbackError, Types } from 'mongoose';
import bcrypt, { compare } from 'bcrypt';
import jwt, { VerifyErrors } from 'jsonwebtoken';

import UserModel, { IUserSchema } from '../../models/userModel';
import EditorModel, { IEditorSchema } from '../../models/environmentModel';
import TokenModel, { ITokenSchema } from '../../models/tokenModel';
import config from '../../../config';
import { AUTH } from './authToken';
import PERMS from './checkPerms';
import { generateNewEditorKey, permissionIDTranslator } from '../../tools/tools';
import { authRouteLogger } from '../../../logger-init';

const router = Router();

//Register new user
router.post(
  '/register',
  [
    check('forename').isLength({ min: 3 }),
    check('surname').isLength({ min: 3 }),
    check('rank').isIn([
      '1. IT',
      '2. IT',
      '3. IT',
      '1. EGS',
      '2. EGS',
      '3. EGS',
      '4. EGS',
    ]),
    check('password').isStrongPassword({ minLength: 5, minSymbols: 0 }),
    check('passwordConfirm').isStrongPassword({ minLength: 5, minSymbols: 0 }),
    PERMS.VALIDATE,
  ],
  async (req: Request, res: Response) => {
    const username =
      `${req.body.forename.toLowerCase()} ${req.body.surname.toLowerCase()}`
        .split(' ')
        .join('.');

    authRouteLogger.info(`new user ${username} registered`);

    const user: IUserSchema = <IUserSchema>(
      await UserModel.findOne({ username: username })
    );

    if (user) {
      authRouteLogger.info(`Username "${username}" already exists`);
      return res.status(400).jsonp({
        access: true,
        error: `Username "${username}" already exists`,
        res: `Username "${username}" already exists`,
      });
    }

    //TODO: test if Rank is valid

    //check if userpassword is the same as passwordConfirm
    if (req.body.password !== req.body.passwordConfirm) {
      authRouteLogger.debug(`Username "${username}" already exists`);
      return res.status(400).jsonp({
        access: true,
        error: 'Passwords do not match',
        res: 'Passwords do not match',
      });
    }

    const hashedpw = await bcrypt.hash(req.body.password, 10);

    const newUser = new UserModel({
      _id: new Types.ObjectId(),
      new: true,
      accountAdded: new Date(),
      forename: req.body.forename,
      surname: req.body.surname,
      username: username.split(' ').join('.'),
      rank: req.body.rank,
      password: hashedpw,
      permissionID: config().PERMISSON_USER,
      runnercount: 0,
      order: [],
    });

    newUser
      .save()
      .then(() => {
        authRouteLogger.info(`User ${req.body.username} registered!`);

        res.jsonp({ access: true, res: `${req.body.username} registered` });
      })
      .catch((UserModelError: CallbackError) => {
        authRouteLogger.error(`Error while saving user ${req.body.username}!`, {
          stack: UserModelError,
        });

        res.status(500).jsonp({
          access: true,
          error: `Error while saving user ${req.body.username}`,
          res: `Error while saving user ${req.body.username}`,
        });
      });
  }
);

//Login in existing user
router.post(
  '/login',
  [
    check('username').isLength({ min: 3 }),
    check('password').isLength({ min: 5 }),
    PERMS.VALIDATE,
  ],
  async (req: Request, res: Response) => {
    const user: IUserSchema = <IUserSchema>(
      await UserModel.findOne({ username: req.body.username })
    );

    if (!user) {
      authRouteLogger.error(`UserID ${req.body.username} not found`);
      return res.status(401).jsonp({
        access: false,
        error: 'Authentication failed',
        res: 'Authentication failed',
      });
    }

    if (user.new) {
      authRouteLogger.debug(`login failed: Account ${user._id} not activated`);
      return res.status(403).json({
        access: false,
        error: 'Account not activated',
        res: 'Account not activated',
      });
    }

    const validpw = await compare(req.body.password, user.password);

    if (!validpw) {
      authRouteLogger.debug(
        `${req.ip} got wrong credentials for user ${req.body.username}`
      );
      return res.status(401).jsonp({
        access: false,
        error: 'Authentication failed',
        res: 'Authentication failed',
      });
    }

    const accessToken = generateAccessToken(user._id);
    const refreshToken = jwt.sign({ _id: user._id }, config().REFRESH_TOKEN);

    // Add to MongoDB
    new TokenModel({
      refreshToken: refreshToken,
      activeSince: new Date(),
    })
      .save()
      .then(() => {
        authRouteLogger.debug('Added refreshToken to activeTokens!');
      })
      .catch((tokenError) => {
        authRouteLogger.error('Could not update activeTokens!', {
          stack: tokenError,
        });
      });

    await UserModel.updateOne(
      { _id: user._id },
      {
        curr_refreshToken: refreshToken,
      }
    ).catch((tokenError) => {
      authRouteLogger.error(
        `Could not update User ${user._id} with refreshToken ${refreshToken}!`,
        { stack: tokenError }
      );
    });

    res.header('accessToken', accessToken);
    res.status(200).jsonp({
      access: true,
      res: {
        accessToken: accessToken,
        refreshToken: refreshToken,
        user: {
          _id: user._id,
          new: user.new,
          forename: user.forename,
          surname: user.surname,
          username: user.username,
          permissionID: permissionIDTranslator(user.permissionID, config),
          rank: user.rank,
          order: user.order,
        },
      },
    });
  }
);

// //Login Editor
// router.post(
//   '/editorlogin',
//   async (req: Request, res: Response) => {
//     const errors = validationResult(req);
//     if (!errors.isEmpty()) {
//       authRouteLogger.debug(
//         'editorKey not valid! checking if Editors are in DB!'
//       );
//       const allEditors = await EditorModel.find({});

//       if (allEditors.length === 0) {
//         const FirstEditor = new EditorModel({
//           editorKey: generateNewEditorKey(),
//           firstAdded: new Date(),
//           lastUsed: new Date(),
//         });

//         return FirstEditor.save()
//           .then(() => {
//             authRouteLogger.debug('First Editor added!');
//             return res.jsonp({
//               access: true,
//               res: `First Editor added`,
//             });
//           })
//           .catch((EditorModelError: CallbackError) => {
//             authRouteLogger.error('Error while saving new Editor!', {
//               stack: EditorModelError,
//             });

//             return res.status(500).jsonp({
//               access: true,
//               error: 'Error while saving new Editor',
//               res: 'Error while saving',
//             });
//           });
//       }

//       return res.status(400).jsonp({
//         access: true,
//         error: errors.array(),
//         res: 'Pre-Check Failed',
//       });
//     }

//     const editor: IEditorSchema = <IEditorSchema>(
//       await EditorModel.findOne({})
//     );

//     if (!editor) {
//       authRouteLogger.error(`${req.ip} - got wrong credentials for Editor!`);
//       return res.status(400).jsonp({
//         access: true,
//         error: 'wrong credentials',
//         res: 'wrong credentials',
//       });
//     }

//     const accessToken = generateAccessToken(editor._id);
//     const refreshToken = jwt.sign({ _id: editor._id }, config().REFRESH_TOKEN);

//     const now = new Date();
//     // Add to MongoDB
//     new TokenModel({
//       refreshToken: refreshToken,
//       activeSince: now,
//     })
//       .save()
//       .then(() => {
//         authRouteLogger.debug('Token added for Editor!');
//       });

//     const overtime = now.getTime() - 5 * 24 * 60 * 60 * 1000;

//     if (editor.firstAdded < new Date(overtime)) {
//       authRouteLogger.debug('Editor Key expired! Generating new Key!');
//       await EditorModel.updateOne(
//         { _id: editor._id },
//         {
//           editorKey: generateNewEditorKey(),
//           firstAdded: new Date(),
//         }
//       );

//       return res.status(400).jsonp({
//         access: true,
//         error: 'Editor Key expired',
//         res: 'Editor Key expired',
//       });
//     }

//     await EditorModel.updateOne(
//       { _id: editor._id },
//       {
//         curr_refreshToken: refreshToken,
//         lastUsed: now,
//       }
//     );

//     authRouteLogger.debug(
//       'sending accessToken & refreshToken with status 200!'
//     );
//     res.header('accessToken', accessToken);
//     res.status(200).jsonp({
//       access: true,
//       res: { accessToken: accessToken, refreshToken: refreshToken },
//     });
//   }
// );

//Refresh Token
router.post(
  '/token',
  [AUTH, PERMS.USER, check('refreshToken').isJWT(), PERMS.VALIDATE],
  async (req: Request, res: Response) => {
    const refreshToken: string = req.body.refreshToken;

    if (refreshToken == null) return res.sendStatus(401);

    TokenModel.find(
      { refreshToken: refreshToken }).then((data: ITokenSchema[]) => {
        if (data.length === 0) {
          authRouteLogger.error('Refreshtoken not found!');
          return res.status(404).jsonp({
            access: true,
            error: 'Refreshtoken not found',
            res: 'Refreshtoken not found',
          });
        }
      }).catch((TokenModelError: CallbackError) => {
        authRouteLogger.error('Error while finding TokenModel!', {
          stack: TokenModelError,
        });
        return res.status(500).jsonp({
          access: true,
          error: 'Error while finding TokenModel!',
          res: 'Error while finding TokenModel!',
        });
      })

    jwt.verify(
      refreshToken,
      config().REFRESH_TOKEN,
      (VerifyErr: VerifyErrors | null, user) => {
        if (VerifyErr) {
          authRouteLogger.error('Error while verifying new accessToken!', {
            stack: VerifyErr,
          });
          return res.sendStatus(403);
        }

        const accessToken = generateAccessToken((<IUserSchema>user)._id);

        return res.setHeader('accessToken', accessToken);
      }
    );
  }
);

//Log out User
router.delete(
  '/logout',
  [AUTH, PERMS.USER, check('refreshToken').isJWT(), PERMS.VALIDATE],
  (req: Request, res: Response) => {
    //Delete from MongoDB
    TokenModel.findOneAndDelete(
      { refreshToken: req.header('refreshToken') }).then((data: ITokenSchema | null) => {
        (data: Array<ITokenSchema>) => {
          if (data === null) {
            authRouteLogger.error('Refreshtoken not found!');
            return res.status(404).jsonp({
              access: true,
              error: 'Refreshtoken not found',
              res: 'Refreshtoken not found',
            });
          }
        }
      }).catch((TokenModelError: CallbackError) => {
        authRouteLogger.error('Error while deleting Token!', {
          stack: TokenModelError,
        });
        return res.status(500).jsonp({
          access: true,
          error: 'Error while deleting Token!',
          res: 'Error while deleting Token!',
        });
      })



    UserModel.updateOne(
      { _id: req.body._id },
      { curr_refreshToken: '' }).then((updateRes) => {
        if (updateRes.matchedCount === 0 || updateRes.modifiedCount === 0) {
          authRouteLogger.error('User not found!');
          return res.status(404).jsonp({
            access: true,
            error: 'User not found',
            res: 'User not found',
          });
        } else {
          authRouteLogger.info(
            `successfully logged out User ${req.body._id}!`
          );
          return res.status(200).jsonp({
            access: true,
            res: 'Logout successfull',
          });
        }
      }).catch((UserModelError: CallbackError) => {
        authRouteLogger.error('Error while updating UserModel!', {
          stack: UserModelError,
        });
        return res.status(500).jsonp({
          access: true,
          error: 'Error while updating UserModel!',
          res: 'Error while updating UserModel!',
        });
      });
  }
);

function generateAccessToken(clientID: Types.ObjectId) {
  return jwt.sign({ _id: clientID }, config().SECRET_TOKEN, {
    expiresIn: '2h',
  });
}

export default router;

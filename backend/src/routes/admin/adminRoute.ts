import bcrypt from 'bcrypt';
import { Request, Response, Router } from 'express';
import { body, check } from 'express-validator';
import hbs from 'handlebars';
import { CallbackError, MongooseError } from 'mongoose';
import nodemailer from 'nodemailer';

import { AUTH } from '../auth/authToken';
import PERMS from '../auth/checkPerms';
import { formatToCurrent, generatePDF, getUserRank } from './adminTools';

import mongoose from 'mongoose';
import { adminRouteLogger } from '../../../logger-init';
import PDFModel, { IpdfSchema } from '../../models/pdfModel';
import SiteSettingsModel, { ISiteSettingsSchema } from '../../models/siteSettingsModel';
import UserModel, { IUserSchema } from '../../models/userModel';
import UserSettingsModel, {
  IUserSettings,
  Runners
} from '../../models/userSettingsModel';

interface IrunnerSchema {
  _id: any;
  rank: string;
  forename: string;
  surname: string;
  runnercount: number;
}

const router = Router();

/**
 * @param users Userpool aus dem der Runner ausgewählt wird!
 * ```
 * Grundformel: max(runnercounts) - runnercountOfCurrentUser + 1
 * ```
 * @field max(runnercounts)         : Die höchste Zahl an Läufen von den Nutzern die bestellt haben
 * @field runnercountOfCurrentUser  : Die Anzahl an Läufen von dem aktuellen Nutzer
 * @field + 1                       : Addieren von 1, da bei 0 kein Läufer gewählt werden kann!
 *
 * @returns new random runner
 */
function getRandomUserWithWeight(users: IrunnerSchema[]) {
  if (users.length === 0) return;

  adminRouteLogger.debug(`Getting random Runner!`);

  const maxRunnerCount =
    Math.max(...users.flatMap((user) => user.runnercount)) + 1;

  let total = 0;

  users.map((user) => {
    user.runnercount = maxRunnerCount - user.runnercount;
    total += user.runnercount;
  });

  adminRouteLogger.debug(`Runnercount in total + ${users.length} : ${total}`);

  const threshold = Math.random() * total;
  adminRouteLogger.debug(`Runnercount-Threshold ${threshold}`);

  total = 0;

  for (const user of users) {
    total += user.runnercount;

    if (total >= threshold) {
      adminRouteLogger.debug(`New Runner is ${user.forename} ${user.surname}`);
      return user;
    }
  }

  adminRouteLogger.debug(
    `New Runner is ${users[users.length - 1].forename} ${users[users.length - 1].surname
    }`
  );
  return users[users.length - 1];
}

function ArrayEquals(a: Array<any>, b: Array<any>) {
  a = a.sort();
  b.sort();

  return (
    Array.isArray(b) &&
    Array.isArray(a) &&
    a.length === b.length &&
    a.every((val, index) => val === b[index])
  );
}

function countCommentDuplicates(
  CommentArray: Array<Icomment>,
  CommentToEqual: Icomment
) {
  let count = 0;

  CommentArray.forEach((comment: Icomment, indexOfArrayToEqual: number) => {
    if (ArrayEquals(comment.order, CommentToEqual.order))
      count += CommentArray[indexOfArrayToEqual].count;
  });

  return count;
}

// --------------------------- HBS Helper ---------------------------

hbs.registerHelper('add', function (value, options) {
  return parseInt(value) + 1;
});

hbs.registerHelper('deleteZero', function (value) {
  return value === 0 ? null : value;
});

interface Icomment {
  count: number;
  order: Array<string>;
}

hbs.registerHelper('sliceComments', function (comments: Array<Icomment>) {
  comments = comments.map((comment) => {
    comment.order.sort();
    return comment;
  });

  const newComment = countEquals(comments)
    // removes empty orders
    .filter((comment) => comment.order.length > 0)
    .map((comment) => {
      return `${comment.count}x ${comment.order.join(', ')}`;
    });

  return [...new Set(newComment)].join('<hr noshadow color=black>');
});

/**
 * Counts equal orders and summarises them in an Object
 *
 * @param comments Object-Array with orders of type Icomment
 * @returns new sorted Array
 */
function countEquals(comments: Icomment[]) {
  let newOrder: Array<{ order: string[]; count: number }> = [];

  comments.map((comment) => {
    newOrder.push({
      order: comment.order,
      count: countCommentDuplicates(comments, comment),
    });
  });

  return newOrder;
}

hbs.registerHelper('multiplyToCurrent', function (value, value2) {
  const number = Number(value) * Number(value2);
  return number === 0 ? null : formatToCurrent(number);
});

hbs.registerHelper('formatToCurrent', function (value) {
  return formatToCurrent(value);
});

// --------------------------- Routes ---------------------------

router.get(
  '/runner',
  AUTH,
  PERMS.ADMIN,
  async (req: Request, res: Response) => {

    const userSettings: {
      _id: mongoose.Types.ObjectId;
      runners: Runners[];
    } | null = await UserSettingsModel.findOne({ rank: req.body.rank }).select(
      'runners'
    );

    if (!userSettings) {
      adminRouteLogger.debug('No userSettings found! creating new one!');
      await new UserSettingsModel({
        rank: req.body.rank,
        ordered: [],
        runners: [
          {
            //TODO: check if siteID exists
            siteID: new mongoose.Types.ObjectId(req.headers.siteid as string),
            runner: '',
            runnerID: '',
            lastrunner: '',
            lastrunnerID: '',
          },
        ],
      }).save();

      return res.status(200).jsonp({
        access: true,
        res: 'UserSettings created! Please try again',
      });
    }

    let filteredRunner: Runners | undefined = userSettings.runners.find(
      (item) => item.siteID.toString() === req.headers.siteid
    );

    if (!filteredRunner) {
      adminRouteLogger.debug('No Runners found! using None!');
      filteredRunner = {
        siteID: new mongoose.Types.ObjectId(req.headers.siteid as string),
        runner: '',
        runnerID: '',
        lastrunner: '',
        lastrunnerID: '',
      };
    }

    const userModelFilter = {
      $ne: new mongoose.Types.ObjectId(
        filteredRunner.lastrunnerID.length > 5
          ? filteredRunner.lastrunnerID
          : undefined
      ),
    };

    UserModel.find(
      // search for all users with specified rank, where the ID is not the ID of the last runner and where someone has ordered
      {
        rank: req.body.rank,
        _id: userModelFilter,
        'order.0': { $exists: true },
      }).select(['forename', 'surname', 'runnercount', 'rank'])
      .then((users: Array<IrunnerSchema>) => {
        if (!filteredRunner)
          return res.status(404).jsonp({
            access: true,
            error: 'Keine Läufer verfügbar',
            res: 'Keine Läufer verfügbar',
          });

        if (users.length === 0 && filteredRunner.lastrunnerID.length === 0) {
          adminRouteLogger.debug('No Runners found!');
          return res.status(404).jsonp({
            access: true,
            error: 'Keine Läufer verfügbar',
            res: 'Keine Läufer verfügbar',
          });
        }
        // Get random user except the current lastrunner
        const current_runner: IrunnerSchema | any = getRandomUserWithWeight(
          users
        ) ?? {
          _id: filteredRunner.lastrunnerID,
          forename: filteredRunner.lastrunner.split(' ')[0],
          surname: filteredRunner.lastrunner.split(' ')[1],
        };

        if (userSettings.runners.length === 0) {
          UserSettingsModel.updateOne(
            {
              rank: req.body.rank,
            },
            {
              $set: {
                runners: [
                  {
                    //TODO: check if siteID exists
                    siteID: new mongoose.Types.ObjectId(
                      req.headers.siteid as string
                    ),
                    runner: `${current_runner.forename} ${current_runner.surname}`,
                    runnerID: current_runner._id,
                    lastrunner: '',
                    lastrunnerID: '',
                  },
                ],
              },
            }
          ).catch((UserSettingsError: CallbackError) => {
            if (UserSettingsError) {
              adminRouteLogger.error('Error while updating usersettings', {
                stack: UserSettingsError,
              });
              return res.status(500).jsonp({
                access: false,
                error: UserSettingsError,
                res: 'Error while updating usersettings',
              });
            }
          });

          adminRouteLogger.debug(
            `Found new runner (${current_runner._id})! sending status 200`
          );

          return res.status(200).jsonp({
            access: true,
            res: {
              runner: `${current_runner.forename} ${current_runner.surname}`,
              runnerID: current_runner._id,
            },
          });
        }

        UserSettingsModel.updateOne(
          {
            rank: req.body.rank,
            'runners.siteID': new mongoose.Types.ObjectId(
              req.headers.siteid as string
            ),
          },
          {
            $set: {
              'runners.$.runnerID': current_runner._id,
              'runners.$.runner': `${current_runner.forename} ${current_runner.surname}`,
            },
          }).catch((UserSettingsModelError: CallbackError) => {
            adminRouteLogger.error('Error while updating user settings', {
              stack: UserSettingsModelError,
            });
            return res.status(500).jsonp({
              access: false,
              error: UserSettingsModelError,
              res: 'Error while updating user settings',
            });
          }
          );

        adminRouteLogger.debug(
          'sending new random runner to client with status 200'
        );
        return res.status(200).jsonp({
          access: true,
          res: {
            runner: `${current_runner.forename} ${current_runner.surname}`,
            runnerID: current_runner._id,
          },
        });

      }).catch((userModelError: MongooseError) => {
        adminRouteLogger.error('Error while finding users!', {
          stack: userModelError,
        });

        return res.status(400).jsonp({
          access: false,
          error: 'Error while finding users',
          res: userModelError,
        });
      })
  }
);

router.get('/access', [AUTH, PERMS.USER], (req: Request, res: Response) => {
  adminRouteLogger.debug('Adminaccess Granted!');
  res.status(200).jsonp({ access: true, res: { isEditor: req.body.isEditor, isAdmin: req.body.isAdmin } });
});

router.get(
  '/pdf',
  [
    AUTH,
    PERMS.ADMIN,
    check('siteID').optional({ checkFalsy: true }).isMongoId(),
    PERMS.VALIDATE,
  ],
  async (req: Request, res: Response) => {
    if (!req.body.rank) {
      adminRouteLogger.error(`User ${req.body._id} doesnt have a rank`);

      return res.status(400).jsonp({
        access: true,
        error: 'User doesnt have a rank',
        res: 'User doesnt have a rank',
      });
    }

    adminRouteLogger.debug(
      `sending base64-pdf with siteID (${req.headers.siteid}) to client with status 200`
    );

    res.send({
      access: true,
      res: (
        await generatePDF(req.body.rank, req.headers.siteid as string | undefined)
      ).toString('base64'),
    });
  }
);

router.get(
  '/pdfdata',
  [AUTH, PERMS.ADMIN],
  async (req: Request, res: Response) => {
    PDFModel.findOne(
      { rank: req.body.rank }).then((pdfdata: IpdfSchema | null) => {
        adminRouteLogger.debug('sending pdfdata to client with status 200');
        res.jsonp({
          access: true,
          res: pdfdata,
        });
      }).catch((PDFModelError: CallbackError) => {
        adminRouteLogger.error('Error while getting pdfdata!', {
          stack: PDFModelError,
        });
        return res.status(500).jsonp({
          access: false,
          error: 'Error while getting pdfdata',
          res: 'Error while getting pdfdata!',
        });
      }
      );
  }
);

router.get(
  '/usersettings',
  [AUTH, PERMS.ADMIN, check('siteid').isMongoId(), PERMS.VALIDATE],
  async (req: Request, res: Response) => {

    UserSettingsModel.findOne({ rank: req.body.rank }).select(["-_id", "-runners._id"]).then((userSettings: IUserSettings | null) => {
      if (userSettings === null) {
        adminRouteLogger.debug('No userSettings found! creating new one!');
        new UserSettingsModel({
          rank: req.body.rank,
          ordered: [],
          runners: [
            {
              siteID: new mongoose.Types.ObjectId(req.headers.siteid as string),
              runner: '',
              runnerID: '',
              lastrunner: '',
              lastrunnerID: '',
            },
          ],
        })
          .save()
          .then((newusersettings: IUserSettings) => {
            adminRouteLogger.debug('sending new userSettings to client with status 200');
            return res.status(200).jsonp({
              access: true,
              res: newusersettings,
            });
          })
          .catch((userSettingsModelError: MongooseError) => {
            adminRouteLogger.error('Error while creating new userSettings!', {
              stack: userSettingsModelError,
            });

            return res.status(400).jsonp({
              access: false,
              error: 'Error while creating new userSettings',
              res: userSettingsModelError,
            });
          });
      } else {
        adminRouteLogger.debug('sending userSettings to client with status 200');
        return res.status(200).jsonp({
          access: true,
          res: userSettings,
        });
      }

    }).catch((userModelError: MongooseError) => {
      adminRouteLogger.error('Error while finding users!', {
        stack: userModelError,
      });

      return res.status(400).jsonp({
        access: false,
        error: 'Error while finding users',
        res: userModelError,
      });
    });
  }
);

//TODO: Why is check('accept').isBoolean() not working?
router.put(
  '/acceptuser',
  [
    AUTH,
    check('accept').notEmpty(),
    check('userID').isMongoId(),
    PERMS.VALIDATE,
  ],
  PERMS.ADMIN,
  (req: Request, res: Response) => {
    if (req.body.accept) {
      UserModel.findByIdAndUpdate(
        req.body.userID,
        { new: false }).then((doc: any) => {
          adminRouteLogger.debug(`user ${req.body.userID} accepted!`);
        }).catch(
          (UserModelError: CallbackError) => {
            adminRouteLogger.error('Error while accepting user!', {
              stack: UserModelError,
            });
            return res.status(500).jsonp({
              access: false,
              error: 'Error while accepting user!',
              res: 'Error while accepting user!',
            });
          }
        );
    } else {
      UserModel.deleteOne(
        { _id: req.body.userID }).then((doc: any) => {
          adminRouteLogger.debug(`user ${req.body.userID} deleted!`);
        }).catch(
          (UserModelError: CallbackError) => {
            adminRouteLogger.error('Error while deleting user!', {
              stack: UserModelError,
            });
            return res.status(500).jsonp({
              access: false,
              error: 'Error while deleting user!',
              res: 'Error while deleting user!',
            });
          }
        );
    }

    res.status(200).jsonp({ access: true, res: req.body.accept });
  }
);

router.put(
  '/pwreset',
  [
    AUTH,
    PERMS.ADMIN,
    check('updateID').isLength({ min: 10 }).isMongoId(),
    body('password').isLength({ min: 5 }),
    PERMS.VALIDATE,
  ],
  async (req: Request, res: Response) => {
    const user: IUserSchema =
      <IUserSchema>await UserModel.findOne({ _id: req.body.updateID })
        .catch((UserModelError: CallbackError) => {
          if (UserModelError) {
            adminRouteLogger.error('Error while finding user!', {
              stack: UserModelError,
            });
            return res.status(500).jsonp({
              access: false,
              error: 'Error while finding user!',
              res: 'Error while finding user!',
            });
          }
        });

    if (!user) {
      adminRouteLogger.error('UserID not found');
      return res.status(404).jsonp({
        access: true,
        error: 'UserID not found',
        res: 'UserID not found',
      });
    }

    const hashedpw = await bcrypt.hash(req.body.password, 10);

    UserModel.updateOne(
      { _id: req.body.updateID },
      { password: hashedpw }).then((data) => {
        return res.status(200).jsonp({
          access: true,
          res: 'Password updated',
        });
      }).catch(
        (UserModelError: CallbackError) => {
          adminRouteLogger.error('Error while updating user!', {
            stack: UserModelError,
          });
          return res.status(500).jsonp({
            access: false,
            error: 'Error while updating user!',
            res: 'Error while updating user!',
          });
        }
      );
  }
);

router.post(
  '/mailorder',
  [
    AUTH,
    check('email').isEmail(),
    check('password').isString().isLength({ min: 5 }),
    check('siteid').isMongoId(),
    PERMS.VALIDATE,
  ],
  PERMS.ADMIN,
  async (req: Request, res: Response) => {
    const user: IUserSchema | null = await UserModel.findById({
      _id: req.body._id,
    }).select(['rank', 'forename', 'surname']);

    if (!user) {
      adminRouteLogger.error('UserID not found');
      return res.status(404).jsonp({
        access: true,
        error: 'UserID not found',
        res: 'UserID not found',
      });
    }

    adminRouteLogger.info(`Trying to send Email with user ${req.body._id}!`);

    // check if already ordered
    const ordered = (
      await UserSettingsModel.find({ rank: user.rank }).select(['ordered'])
    )[0].ordered;

    if (ordered && ordered.includes((new mongoose.Types.ObjectId(req.headers.siteid as string ?? '')))) {
      adminRouteLogger.info('Message not sent: Already ordered');
      return res.status(400).jsonp({
        access: true,
        error: 'Message not sent: Already ordered',
        res: 'Bestellung bereits verschickt',
      });
    }

    const pdf = await generatePDF(user.rank, req.headers.siteid as string | undefined);


    // get list of receivers from database
    //TODO: check which site is send (currenty site [0])
    const receivers: ISiteSettingsSchema | null = (
      await SiteSettingsModel.findById(req.headers.siteid).select(['emails', 'emailhost', 'emailport'])
    );

    if (!receivers?.emails || receivers.emails.length === 0) {
      adminRouteLogger.error(`No receivers found!`);
      return res.status(400).jsonp({
        access: true,
        error: `No receivers found! Please notifiy your administrator.`,
        res: `No receivers found`,
      });
    }

    const transporter = nodemailer.createTransport({
      host: receivers.emailhost, // hostname
      port: receivers.emailport, // port for secure SMTP
      secure: true,
      auth: {
        user: req.body.email,
        pass: req.body.password,
      },
      tls: {
        rejectUnauthorized: false,
      },
    });

    transporter.sendMail({
      from: `${user.forename} ${user.surname} <${req.body.email}>`, // sender address
      to: [...receivers.emails, req.body.email],
      subject: `Vorbestellung - ABW ${user.rank}`, // Subject line
      html: `<p>
					Sehr geehrte Damen und Herren,<br>
					anbei finden Sie die Vorbestellungen für heute, den ${new Date().toLocaleDateString(
        'de-DE',
        {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        }
      )}<br>
					<br>
					Mit freundlichen Grüßen<br>
					<br>
					${user.forename} ${user.surname}, ${user.rank}
					</p>
				`, // html body
      attachments: [
        {
          filename: `bestellung.pdf`,
          content: pdf,
          encoding: 'base64',
        },
      ],
    }).then((info) => {
      UserSettingsModel.updateOne(
        { rank: user.rank },
        { $addToSet: { ordered: req.headers.siteid } },
        { upsert: true })
        .then((mongores) => {
          adminRouteLogger.debug(`Message sent: ${info.messageId}`);
          return res.status(200).jsonp({
            access: true,
            res: `Message sent: ${info.messageId}`,
          });
        }).catch((UserSettingsModelError: CallbackError) => {
          adminRouteLogger.error('Error while updating user!', {
            stack: UserSettingsModelError,
          });
          return res.status(500).jsonp({
            access: false,
            error: 'Error while updating user!',
            res: 'Error while updating user!',
          });
        })
    }).catch((err) => {
      adminRouteLogger.error('Error while sending email!', {
        stack: err,
      })
      res.status(400).jsonp({
        access: true,
        error: err,
        res: `Message not sent: ${err}`,
      });
    });
  }
);

router.post(
  '/pdfdata',
  [AUTH, PERMS.ADMIN, check('data').notEmpty(), PERMS.VALIDATE],
  async (req: Request, res: Response) => {
    const rank = await getUserRank(req.body._id);

    PDFModel.updateOne(
      { rank: rank },
      { $set: req.body.data },
      { upsert: true }).then((mongores) => {
        adminRouteLogger.debug(
          `Updated pdfdata of ${rank}! sending to client with status 200`
        );

        return res.jsonp({
          access: true,
          res: 'Updated PDFData!',
        });
      }).catch((PDFModelError: CallbackError) => {
        if (PDFModelError) {
          adminRouteLogger.error('Error while updating pdfdata!', {
            stack: PDFModelError,
          });
          return res.status(500).jsonp({
            access: false,
            error: 'Error while updating pdfdata!',
            res: 'Error while updating pdfdata!',
          });
        }
      })
  }
);

export default router;

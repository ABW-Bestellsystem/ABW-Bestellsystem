import { Request, Response, Router } from 'express';
import { header, check, validationResult, body } from 'express-validator';
import { CallbackError, Error, mongo } from 'mongoose';

import config, { TokenHandlerInstance } from '../../../config';
import EditorModel from '../../models/environmentModel';
import UserModel from '../../models/userModel';
import NotifyModel, { INotifySchema } from '../../models/notifyModel';

import { AUTH } from '../auth/authToken';
import { generateNewEditorKey } from '../../tools/tools';
import PERMS from '../auth/checkPerms';
import { getUserRank } from '../admin/adminTools';
import { editorRouteLogger } from '../../../logger-init';

const router = Router();

router.get(
  '/notifications',
  [AUTH, PERMS.USER],
  async (req: Request, res: Response) => {
    const rank = await getUserRank(req.body._id);

    const notifications = await NotifyModel.find(
      //TODO fix if user not in editorpage display only rank notifications
      req.body.isEditor && !req.body.filter
        ? {}
        : {
          $or: [{ rank: { $exists: false } }, { rank: { $eq: rank } }],
          $and: [
            { start: { $lte: new Date() } },
            { end: { $gte: new Date() } }
          ]
        }
    ).select('-__v');

    if (!notifications) editorRouteLogger.debug('No notifications found!');

    return res.status(200).jsonp({
      access: true,
      res: notifications,
    });
  }
);

router.post(
  '/notification',
  [
    AUTH, PERMS.EDITOR,
    check('start').isDate(),
    check('end').isDate(),
    check('text').isString(),
    check('title').isString(),
    check('notifyrank')
      .optional()
      .isIn([
        '1. IT',
        '2. IT',
        '3. IT',
        '1. EGS',
        '2. EGS',
        '3. EGS',
        '4. EGS',
      ]),
    PERMS.VALIDATE,
  ],
  async (req: Request, res: Response) => {
    if (req.body.start > req.body.end) {
      editorRouteLogger.debug('enddate is greater then startdate!');
      return res.status(304).jsonp({
        access: true,
        res: 'Startdatum ist über Enddatum',
      });
    }

    new NotifyModel<INotifySchema>({
      start: req.body.start,
      end: req.body.end,
      text: req.body.text,
      title: req.body.title,
      rank: req.body.notifyrank,
    }).save().then(() => {
      editorRouteLogger.info(`saved notification ${req.body.title}`);
      res.status(200).jsonp({
        access: true,
        res: `saved notification ${req.body.title}`,
      });
    }).catch((err: CallbackError) => {
      editorRouteLogger.error('Error while saving notification!', {
        stack: err,
      });
      return res.status(500).jsonp({
        access: true,
        error: 'Error while saving notification',
        res: 'Error while saving notification',
      });
    });
  }
);

router.delete(
  '/notification',
  [AUTH, PERMS.EDITOR, check('notifyID').isMongoId(), PERMS.VALIDATE],
  async (req: Request, res: Response) => {
    NotifyModel.deleteOne(
      {
        _id: req.body.notifyID,
      }).then(() => {
        editorRouteLogger.info(`deleted notification ${req.body.notifyID}`);
        res.status(200).jsonp({
          access: true,
          res: `deleted notification ${req.body.notifyID}`,
        });
      }).catch((err: CallbackError) => {
        editorRouteLogger.error('Error while deleting notification!', {
          stack: err,
        });
        return res.status(500).jsonp({
          access: true,
          error: 'Error while deleting notification',
          res: 'Error while deleting notification',
        });
      }
    );
  }
);

// deleteUser Route
router.delete(
  '/user',
  [AUTH, PERMS.EDITOR, check('userID').isMongoId(), PERMS.VALIDATE],
  async (req: Request, res: Response) => {
    await UserModel.deleteOne({
      _id: req.body.userID,
    })
      .then((result) => {
        editorRouteLogger.info(`deleted user ${req.body.userID}`);
        res.status(200).jsonp({
          access: true,
          res: `deleted user ${req.body.userID}`,
        });
      })
      .catch((err) => {
        editorRouteLogger.error(`Error while deleting User`, {
          stack: err,
        });
        return res.status(500).jsonp({
          access: true,
          error: `Error while deleting User`,
          res: `Error while deleting User`,
        });
      });
  }
);

/**
 * Promotes Users to Admin or vice versa
 */
router.put(
  '/promoteadmin',
  [
    AUTH, PERMS.EDITOR,
    check('userID').isString(),
    check('promote').exists(),
    PERMS.VALIDATE,
  ],
  async (req: Request, res: Response) => {
    let promoteToRank = ''

    switch (req.body.promote) {
      case "User": promoteToRank = config().PERMISSON_USER; break;
      case "Admin": promoteToRank = config().PERMISSON_ADMIN; break;
      case "Editor": promoteToRank = config().PERMISSON_EDITOR; break;
      default: return res.status(500).jsonp({
        access: true,
        error: `Error while promoting user ${req.body.userID}!`,
        res: `Error while promoting user ${req.body.userID}!`,
      });
    }

    UserModel.updateOne(
      { _id: req.body.userID },
      { permissionID: promoteToRank }).catch(
      (err: CallbackError) => {
        if (err) {
          editorRouteLogger.error(
            `Error while promoting user ${req.body.userID}!`,
            {
              stack: err,
            }
          );
          return res.status(500).jsonp({
            access: true,
            error: `Error while promoting user ${req.body.userID}!`,
            res: `Error while promoting user ${req.body.userID}!`,
          });
        } else {
          editorRouteLogger.info(
            `promoted user ${req.body.userID} to ${promoteToRank.slice(
              0,
              10
            )}...`
          );
          res.status(200).jsonp({
            access: true,
            res: `promoted user ${req.body.userID}`,
          });
        }
      }
    );
  }
);

/**
 * Refreshes all Tokens for all roles
 *
 * @param {string} editorKey
 */
router.put('/keys', [AUTH, PERMS.EDITOR], async (req: Request, res: Response) => {
  await TokenHandlerInstance.refreshTokens(res).catch((err: Error) => {
    if (err) {
      editorRouteLogger.error(`Error while refreshing tokens!`, {
        stack: err,
      });
      return res.status(500).jsonp({
        access: true,
        res: 'Error while refreshing tokens',
        error: 'Error while refreshing tokens',
      });
    }
  });
});

router.put(
  '/promoteranks',
  [AUTH, PERMS.EDITOR],
  async (req: Request, res: Response) => {
    const changes = {
      $set: {
        rank: {
          $switch: {
            branches: [
              {
                case: { $eq: ['$rank', '1. IT'] },
                then: '2. IT',
              },
              {
                case: { $eq: ['$rank', '2. IT'] },
                then: '3. IT',
              },
              { case: { $eq: ['$rank', '3. IT'] }, then: '' },
              {
                case: { $eq: ['$rank', '1. EGS'] },
                then: '2. EGS',
              },
              {
                case: { $eq: ['$rank', '2. EGS'] },
                then: '3. EGS',
              },
              {
                case: { $eq: ['$rank', '3. EGS'] },
                then: '4. EGS',
              },
              { case: { $eq: ['$rank', '4. EGS'] }, then: '' },
            ],
            default: '',
          },
        },
      },
    };

    //TODO: Update PDFData for each User-Rank to migrate data

    /**
     * Update User-Rank
     *
     * if the rank-state changes to "", it automaticly blocks the user but doesnt immediately delete them (for savety)
     */
    UserModel.updateMany(
      {},
      [changes, { $set: { new: { $eq: ['$rank', ''] } } }]).catch(
      (err: CallbackError) => {
        if (err) {
          editorRouteLogger.error(`Error while updating ranks!`, {
            stack: err,
          });
          return res.status(500).jsonp({
            access: true,
            error: `Error while updating ranks`,
            res: `Error while updating ranks`,
          });
        } else {
          editorRouteLogger.info('updated ranks!');
          res.status(200).jsonp({
            access: true,
            res: 'updated ranks!',
          });
        }
      }
    );
  }
);

/**
 * Refreshes Tokens for all Editors
 */
router.put(
  '/refreshtokens',
  [AUTH, PERMS.EDITOR],
  async (req: Request, res: Response) => {
    const allEditors = await EditorModel.find({});

    for (let i = 0; i < allEditors.length; i++) {
      await EditorModel.updateOne(
        { _id: [allEditors[i]._id] },
        { editorKey: generateNewEditorKey() }).catch(
        (err: CallbackError) => {
          if (err) {
            editorRouteLogger.error(
              `Error while updating Tokens for Editors!`,
              {
                stack: err,
              }
            );
            return res.status(500).jsonp({
              access: true,
              error: `Error while updating Tokens for Editors!`,
              res: `Error while updating Tokens for Editors!`,
            });
          } else {
            editorRouteLogger.info('updated Tokens for Editors!');
            res.status(200).jsonp({
              access: true,
              res: 'updated Tokens for Editors!',
            });
          }
        }
      );
    }
  }
);

export default router;

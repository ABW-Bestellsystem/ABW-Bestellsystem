import UserModel, { IUserSchema } from '../../models/userModel';
import EditorModel, { IEditorSchema } from '../../models/environmentModel';

import { Request, Response, NextFunction } from 'express';
import config from '../../../config';
import { validationResult } from 'express-validator';
import { logger } from '../../../logger-init';

const getPermissionKey = async (UserID: String) => {
  const USER: IUserSchema | null = await UserModel.findById(UserID);

  return {
    permissionKey: USER?.permissionID,
    rank: USER?.rank,
  };
};

const checkUser = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<any> => {
  const { permissionKey, rank } = await getPermissionKey(req.body._id);

  if (rank) req.body.rank = rank;

  switch (permissionKey) {
    case config().PERMISSON_USER: next(); break;
    case config().PERMISSON_ADMIN: req.body.isAdmin = true; next(); break;
    case config().PERMISSON_EDITOR: req.body = { ...req.body, isAdmin: true, isEditor: true }; next(); break;
    default: return res.status(401).jsonp({
      access: false,
      res: 'Unauthorized',
    });
  }
};

const checkAdmin = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<any> => {
  const { permissionKey, rank } = await getPermissionKey(req.body._id);

  if (rank) req.body.rank = rank;

  switch (permissionKey) {
    case config().PERMISSON_ADMIN: req.body.isAdmin = true; next(); break;
    case config().PERMISSON_EDITOR: req.body = { ...req.body, isAdmin: true, isEditor: true }; next(); break;
    default: return res.status(401).jsonp({
      access: false,
      res: 'Unauthorized',
    });
  }
};

const checkEditor = async (req: Request, res: Response, next: NextFunction) => {
  const { permissionKey, rank } = await getPermissionKey(req.body._id);

  if (rank) req.body.rank = rank;

  if (permissionKey === config().PERMISSON_EDITOR) { req.body = { ...req.body, isAdmin: true, isEditor: true }; return next(); }
  else
    return res.status(401).jsonp({
      access: false,
      res: 'Unauthorized',
    });
};

const vaildateRequests = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<any> => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const errorstack = errors
      .array()
      .map((value) => {

        if (value.type === "field")
          return `${value.msg} : ${value.path} ('${req[value.location ?? 'body'][value.path]}')`;

        return `${value.msg}`;

      }).join(' | ');

    logger.warn(`Pre-Check Failed: ${errorstack}`, { service: 'CHECK' });
    return res.status(400).jsonp({
      access: true,
      error: errors.array(),
      res: 'Pre-Check Failed',
    });
  }

  next();
};

export default {
  USER: checkUser,
  ADMIN: checkAdmin,
  EDITOR: checkEditor,
  VALIDATE: vaildateRequests,
};

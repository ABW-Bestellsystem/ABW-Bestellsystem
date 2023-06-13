import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
//Import Config
import config from '../../../config';
import EditorModel from '../../models/environmentModel';

const authUser = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const token = req.header('accessToken');

  if (!token)
    return res.status(401).jsonp({
      access: false,
      res: 'You are not logged in',
      error: 'You are not logged in',
    });

  jwt.verify(token, config().SECRET_TOKEN, (err, user: any) => {
    // TODO: TokenExpiredError: jwt expired ==> Remove Token from database
    if (err)
      return res.status(403).jsonp({
        access: false,
        res: 'Sitzung abgelaufen',
        error: 419,
      });


    req.body = { ...req.body, ...req.query, ...user };

    next();
  });
};

export const AUTH = (req: Request, res: Response, next: NextFunction) => {
  authUser(req, res, next);
};
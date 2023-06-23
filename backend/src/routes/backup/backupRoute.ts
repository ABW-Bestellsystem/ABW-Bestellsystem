import { Request, Response, Router } from 'express';
import { AUTH } from '../auth/authToken';
import PERMS from '../auth/checkPerms';
import EditorModel, { IBackup } from '../../models/environmentModel';
import { check } from 'express-validator';
import { backupPageLogger } from '../../../logger-init';
import config, { BackupHandlerInstance } from '../../../config';
import { UploadedFile } from 'express-fileupload';
import mongoose from 'mongoose';
import { createReadStream } from 'fs';

const router = Router();

interface IBackupSettings {
   settings: {
      autoBackupTime?: string;
      autoBackup?: boolean;
   }
}

router.put('/settings', [AUTH, PERMS.EDITOR,
   check('settings.autoBackup').optional().notEmpty(),
   check('settings.autoBackupTime').optional().notEmpty(), PERMS.VALIDATE], async (req: Request, res: Response) => {

      let { settings }: IBackupSettings = req.body;

      let updateItem: { [key: string]: any } = {}; // add type for updateItem

      if (settings.autoBackup !== undefined) {
         updateItem = { ...updateItem, 'backup.enabled': settings.autoBackup };
      }
      if (settings.autoBackupTime !== undefined) {
         updateItem = { ...updateItem, 'backup.cronjob': settings.autoBackupTime };
      }

      // update site settings
      await EditorModel.updateOne({}, { $set: updateItem }).then((result) => {

         // log every item that was updated in a loop
         for (let key in updateItem) {
            backupPageLogger.info(`updateEditorBackupSettings: ${key} with ${updateItem[key]} updated`);
         }

         if (settings.autoBackup !== undefined) { BackupHandlerInstance.updateBackupState(settings.autoBackup) }
         if (settings.autoBackupTime !== undefined) { BackupHandlerInstance.updateBackupCronjob(settings.autoBackupTime) }

         return res.status(200).json({ message: `${Object.keys(updateItem)[0]} updated!` });

      }).catch((err) => {
         return res.status(500).json({ message: 'failed to update editor backup settings', error: err });
      });
   });

router.get('/settings', [AUTH, PERMS.EDITOR], async (req: Request, res: Response) => {

   // get Editor Backup Settings
   await EditorModel.findOne({}, { 'backup.enabled': 1, 'backup.cronjob': 1 }).then((result) => {
      backupPageLogger.debug('returning editor backup settings');

      return res.status(200).json({
         access: true,
         res: result?.backup as IBackup,
      });
   }).catch((err) => {
      return res.status(500).json({ access: true, res: 'failed to get editor backup settings', error: err });
   });

});

router.get('/all', [AUTH, PERMS.EDITOR], async (req: Request, res: Response) => {

});

router.get('/create', async (req: Request, res: Response) => {
   BackupHandlerInstance.createBackupWithBuffer().then(value => {

      // set headers for file download
      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader('Content-Disposition', 'attachment; filename=backup.dump');
      res.write(value);
      res.end();

   }).catch(err => {
      return res.status(500).json({ access: true, res: 'failed to create backup', error: err });
   });
});

router.post('/restore', [AUTH, PERMS.EDITOR], async (req: Request, res: Response) => {

   // extract file from request
   const { data } = req.files ? (req.files.saveFile as UploadedFile) : { data: '' };

   // check if file is empty
   if (typeof data === 'string') {
      return res.status(400).json({
         access: true,
         res: 'Keine Datei hochgeladen',
         error: 'No file uploaded',
      });
   }
   
   // try to restore backup
   BackupHandlerInstance.restoreBackup(data).then(async () => {
      // clear database
      await BackupHandlerInstance.clearWholeDatabase();
      // restore backup
      BackupHandlerInstance.restoreBackup(data).then(() => {
         return res.status(200).json({
            access: true,
            res: 'Datenbank erfolgreich wiederhergestellt',
         });
      });
   }).catch((err) => {
      return res.status(500).json({
         access: true,
         res: 'Fehler beim Wiederherstellen der Datenbank',
         error: 'Failed to restore database',
      });
   });
});




export default router;

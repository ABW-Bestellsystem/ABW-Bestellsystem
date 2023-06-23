import { format, createLogger, transports, addColors } from 'winston';

const logFormat = format.printf((info) => {
  return `${info.timestamp} | ${info.service}\t| ${info.level}\t: ${
    info.stack || info.message
  }`;
});

addColors({
  http: 'magenta'
})

const logConfig = {
  level: 'debug',
  format: format.combine(
    format((info) => {
      info.level = info.level.toUpperCase();
      return info;
    })(),
    format.errors({ stack: true }),
    format.colorize(),
    format.timestamp({ format: 'DD.MM.YYYY | HH:mm:ss' }),
    logFormat
  ),
  defaultMeta: { service: 'GENERAL' },
  transports: [new transports.Console()],
};

const logger = createLogger(logConfig);

const backupPageLogger = createLogger({
  ...logConfig,
  defaultMeta: { service: 'BACKUP' },
});

const adminRouteLogger = createLogger({
  ...logConfig,
  defaultMeta: { service: 'MANAGE' },
});

const authRouteLogger = createLogger({
  ...logConfig,
  defaultMeta: { service: 'AUTH' },
});

const customPageLogger = createLogger({
  ...logConfig,
  defaultMeta: { service: 'CUSTOMPAGE' },
});

const editorRouteLogger = createLogger({
  ...logConfig,
  defaultMeta: { service: 'EDITOR' },
});

const menuRouteLogger = createLogger({
  ...logConfig,
  defaultMeta: { service: 'MENU' },
});

const userRouteLogger = createLogger({
  ...logConfig,
  defaultMeta: { service: 'USERS' },
});

export {
  logger,
  adminRouteLogger,
  authRouteLogger,
  customPageLogger,
  editorRouteLogger,
  menuRouteLogger,
  backupPageLogger,
  userRouteLogger,
};

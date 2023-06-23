import express, { Request, Response } from "express";
import menuRoute from "./menu/menuRoute";
import authRoute from "./auth/authRoute";
import userRoute from "./user/userRoute";
import adminRoute from "./admin/adminRoute";
import editorRoute from "./editor/editorRoute";
import customPageRoute from "./customPage/customPageRoute";
import statisticRoute from "./statistic/statisticRoute";
import { logger } from "../../logger-init";
import backupRoute from "./backup/backupRoute";

const app = express()


app.use("/menu/", menuRoute)
logger.debug("subroute 'menu' registered!")

app.use("/auth/", authRoute)
logger.debug("subroute 'auth' registered!")

app.use("/users/", userRoute)
logger.debug("subroute 'users' registered!")

app.use("/manage/", adminRoute)
logger.debug("subroute 'manage' registered!")

app.use("/editor/", editorRoute)
logger.debug("subroute 'editor' registered!")

app.use("/customPage/", customPageRoute)
logger.debug("subroute 'customPage' registered!")

app.use("/statistic/", statisticRoute)
logger.debug("subroute 'statistic' registered!")

app.use("/backup", backupRoute);
logger.debug("subroute 'backup' registered!");

app.get("/", (req: Request, res: Response) => {
      res.status(418).send("I'm a teapot! cheers☕")
      logger.debug(`I'm a teapot! cheers☕ | IP: ${req.ip}`)
})

export default app;
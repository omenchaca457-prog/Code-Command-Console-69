import { Router, type IRouter } from "express";
import healthRouter from "./health";
import executeRouter from "./execute";
import snippetsRouter from "./snippets";
import aiRouter from "./ai";
import autorunRouter from "./autorun";
import deepseekRouter from "./deepseek";
import neuralEventsRouter from "./neural-events";
import messagesRouter from "./messages";

const router: IRouter = Router();

router.use(healthRouter);
router.use(executeRouter);
router.use(snippetsRouter);
router.use(aiRouter);
router.use(deepseekRouter);
router.use(neuralEventsRouter);
router.use(messagesRouter);
router.use(autorunRouter);

export default router;

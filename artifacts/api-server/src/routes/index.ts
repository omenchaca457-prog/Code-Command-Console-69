import { Router, type IRouter } from "express";
import healthRouter from "./health";
import executeRouter from "./execute";
import snippetsRouter from "./snippets";
import aiRouter from "./ai";
import autorunRouter from "./autorun";

const router: IRouter = Router();

router.use(healthRouter);
router.use(executeRouter);
router.use(snippetsRouter);
router.use(aiRouter);
router.use(autorunRouter);

export default router;

import { Router, type IRouter } from "express";
import healthRouter from "./health";
import executeRouter from "./execute";
import snippetsRouter from "./snippets";

const router: IRouter = Router();

router.use(healthRouter);
router.use(executeRouter);
router.use(snippetsRouter);

export default router;

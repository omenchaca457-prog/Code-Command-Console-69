import { Router, type IRouter } from "express";
import healthRouter from "./health";
import executeRouter from "./execute";
import snippetsRouter from "./snippets";
import aiRouter from "./ai";
import autorunRouter from "./autorun";
import deepseekRouter from "./deepseek";
import geminiRouter from "./gemini";
import neuralEventsRouter from "./neural-events";
import messagesRouter from "./messages";
import diagnosticsRouter from "./diagnostics";
import cortexRouter from "./cortex";
import openAiRouter from "./openai";
import coherenceSimulationRouter from "./coherence-simulation";
import agentsSimulationRouter from "./agents-simulation";

const router: IRouter = Router();

router.use(healthRouter);
router.use(executeRouter);
router.use(snippetsRouter);
router.use(aiRouter);
router.use(deepseekRouter);
router.use(geminiRouter);
router.use(neuralEventsRouter);
router.use(messagesRouter);
router.use(diagnosticsRouter);
router.use(cortexRouter);
router.use(openAiRouter);
router.use(coherenceSimulationRouter);
router.use(agentsSimulationRouter);
router.use(autorunRouter);

export default router;

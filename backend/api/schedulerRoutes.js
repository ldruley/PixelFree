// backend/api/schedulerRoutes.js

import express from 'express';
import * as scheduler from '../services/albumScheduler.js';

export default function mountSchedulerRoutes(app) {
    const router = express.Router();

    //GET /api/scheduler/status
    router.get('/status', (_req, res) => {
        console.log('[API] GET /api/scheduler/status');
        const status = scheduler.getStatus();
        res.json({ status });
    });

    //GET /api/scheduler/start
    router.get('/start', (_req, res) => {
        console.log('[API] GET /api/scheduler/start');
        scheduler.start();
        res.json({ status: 'Scheduler started' });
    })

    //GET /api/scheduler/stop
    router.get('/stop', (_req, res) => {
        console.log('[API] GET /api/scheduler/stop');
        scheduler.stop();
        res.json({ status: 'Scheduler stopped' });
    })

    app.use('/api/scheduler', router);
}
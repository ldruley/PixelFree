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

    //POST /api/scheduler/start
    router.post('/start', (_req, res) => {
        console.log('[API] POST /api/scheduler/start');
        scheduler.start();
        res.json({ status: 'Scheduler started' });
    })

    //POST /api/scheduler/stop
    router.post('/stop', (_req, res) => {
        console.log('[API] POST /api/scheduler/stop');
        scheduler.stop();
        res.json({ status: 'Scheduler stopped' });
    })

    app.use('/api/scheduler', router);
}